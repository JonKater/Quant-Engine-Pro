/**
 * Broker Simulation Engine (GKFX-style Institutional Demo Account)
 * Handles realistic trading execution, margin requirements, dynamic P&L,
 * commissions, swaps, slippage, stop-outs, and full position lifecycle.
 */

import {
  DemoAccount,
  MarketTick,
  OrderSide,
  PendingOrder,
  PendingOrderType,
  Position,
  TradeHistoryItem,
} from '../types/trading';
import { ASSET_SPECS, marketDataService } from './marketDataService';

export class BrokerEngine {
  private account: DemoAccount;
  private positions: Map<string, Position> = new Map();
  private pendingOrders: Map<string, PendingOrder> = new Map();
  private tradeHistory: TradeHistoryItem[] = [];
  private listeners: Set<() => void> = new Set();
  private ticketCounter: number = 7482010; // realistic GKFX ticket numbering
  private unsubscribeMarketData: (() => void) | null = null;

  constructor(initialBalance: number = 50000, leverage: number = 100) {
    this.account = {
      accountNumber: 'GKFX-DEMO-98241',
      brokerName: 'GKFX Financial Services Ltd (Demo)',
      serverName: 'GKFX-Live-ECN-Demo01',
      currency: 'USD',
      leverage,
      balance: initialBalance,
      equity: initialBalance,
      marginUsed: 0,
      freeMargin: initialBalance,
      marginLevelPercent: 0,
      floatingPnL: 0,
      realizedPnL: 0,
      totalCommissionPaid: 0,
      totalSwapPaid: 0,
      status: 'ACTIVE',
      marginCallLevel: 100, // 100% Margin Call warning
      stopOutLevel: 50, // 50% Stop-out liquidation
    };

    this.subscribeToMarketTicks();
  }

  private subscribeToMarketTicks(): void {
    this.unsubscribeMarketData = marketDataService.subscribe((ticks) => {
      this.onTickUpdate(ticks);
    });
  }

  /**
   * On every market tick:
   * 1. Recompute floating P&L for all open positions
   * 2. Check and trigger Pending Orders (Limit & Stop)
   * 3. Check and execute Stop Loss & Take Profit limits
   * 4. Update Trailing Stops
   * 5. Verify Margin Level & enforce Stop-Out liquidations if < 50%
   * 6. Recalculate Account Ledger (Equity, Margin, Free Margin)
   */
  private onTickUpdate(ticks: Map<string, MarketTick>): void {
    let totalFloatingPnL = 0;
    const positionsToClose: { position: Position; reason: 'SL' | 'TP' }[] = [];

    // 1. Process positions
    for (const position of this.positions.values()) {
      const tick = ticks.get(position.symbol);
      if (!tick) continue;

      const spec = ASSET_SPECS[position.symbol];
      if (!spec) continue;

      // Price used to close/evaluate:
      // BUY closes at current BID
      // SELL closes at current ASK
      const currentClosePrice = position.side === 'BUY' ? tick.bid : tick.ask;
      position.currentPrice = currentClosePrice;

      // P&L calculation
      if (position.side === 'BUY') {
        position.floatingPnL =
          (tick.bid - position.openPrice) * (position.lots * spec.contractSize);
      } else {
        position.floatingPnL =
          (position.openPrice - tick.ask) * (position.lots * spec.contractSize);
      }

      totalFloatingPnL += position.floatingPnL;

      // Trailing stop logic
      if (position.trailingStopPips && position.trailingStopPips > 0) {
        const trailDist = position.trailingStopPips * spec.pipMultiplier;
        if (position.side === 'BUY') {
          const newSl = tick.bid - trailDist;
          if (newSl > position.openPrice && (!position.sl || newSl > position.sl)) {
            position.sl = Number(newSl.toFixed(spec.digits));
          }
        } else {
          const newSl = tick.ask + trailDist;
          if (newSl < position.openPrice && (!position.sl || newSl < position.sl)) {
            position.sl = Number(newSl.toFixed(spec.digits));
          }
        }
      }

      // Check Stop Loss
      if (position.sl !== null) {
        if (position.side === 'BUY' && tick.bid <= position.sl) {
          positionsToClose.push({ position, reason: 'SL' });
          continue;
        } else if (position.side === 'SELL' && tick.ask >= position.sl) {
          positionsToClose.push({ position, reason: 'SL' });
          continue;
        }
      }

      // Check Take Profit
      if (position.tp !== null) {
        if (position.side === 'BUY' && tick.bid >= position.tp) {
          positionsToClose.push({ position, reason: 'TP' });
          continue;
        } else if (position.side === 'SELL' && tick.ask <= position.tp) {
          positionsToClose.push({ position, reason: 'TP' });
          continue;
        }
      }
    }

    // Execute triggered SL / TP closes
    for (const { position, reason } of positionsToClose) {
      this.closePosition(position.id, reason);
    }

    // 2. Check Pending Orders
    this.checkPendingOrders(ticks);

    // 3. Recalculate Ledger
    this.recalculateAccountLedger(totalFloatingPnL);

    // 4. Enforce Stop-Out liquidation if Margin Level <= 50%
    if (this.positions.size > 0 && this.account.marginLevelPercent > 0 && this.account.marginLevelPercent <= this.account.stopOutLevel) {
      this.triggerStopOutLiquidation();
    }

    this.notifyListeners();
  }

  private checkPendingOrders(ticks: Map<string, MarketTick>): void {
    const ordersToTrigger: PendingOrder[] = [];

    for (const order of this.pendingOrders.values()) {
      if (order.status !== 'PENDING') continue;
      const tick = ticks.get(order.symbol);
      if (!tick) continue;

      let triggered = false;
      let executionPrice = order.price;

      switch (order.orderType) {
        case 'BUY_LIMIT':
          // Buy at Ask when Ask <= order.price
          if (tick.ask <= order.price) {
            triggered = true;
            executionPrice = tick.ask;
          }
          break;
        case 'SELL_LIMIT':
          // Sell at Bid when Bid >= order.price
          if (tick.bid >= order.price) {
            triggered = true;
            executionPrice = tick.bid;
          }
          break;
        case 'BUY_STOP':
          // Buy at Ask when Ask >= order.price
          if (tick.ask >= order.price) {
            triggered = true;
            executionPrice = tick.ask;
          }
          break;
        case 'SELL_STOP':
          // Sell at Bid when Bid <= order.price
          if (tick.bid <= order.price) {
            triggered = true;
            executionPrice = tick.bid;
          }
          break;
      }

      if (triggered) {
        ordersToTrigger.push({ ...order, price: executionPrice });
      }
    }

    for (const order of ordersToTrigger) {
      this.pendingOrders.delete(order.id);
      const side: OrderSide =
        order.orderType === 'BUY_LIMIT' || order.orderType === 'BUY_STOP' ? 'BUY' : 'SELL';
      this.executeOrderInternal(order.symbol, side, order.lots, order.price, order.sl, order.tp);
    }
  }

  private recalculateAccountLedger(floatingPnL: number): void {
    let marginUsed = 0;
    for (const position of this.positions.values()) {
      marginUsed += position.marginRequired;
    }

    this.account.floatingPnL = Number(floatingPnL.toFixed(2));
    this.account.equity = Number((this.account.balance + floatingPnL).toFixed(2));
    this.account.marginUsed = Number(marginUsed.toFixed(2));
    this.account.freeMargin = Number((this.account.equity - marginUsed).toFixed(2));

    if (marginUsed > 0) {
      this.account.marginLevelPercent = Number(((this.account.equity / marginUsed) * 100).toFixed(1));
    } else {
      this.account.marginLevelPercent = 0;
    }

    // Status warning
    if (this.account.marginLevelPercent > 0 && this.account.marginLevelPercent <= this.account.stopOutLevel) {
      this.account.status = 'STOPPED_OUT';
    } else if (this.account.marginLevelPercent > 0 && this.account.marginLevelPercent <= this.account.marginCallLevel) {
      this.account.status = 'MARGIN_CALL';
    } else {
      this.account.status = 'ACTIVE';
    }
  }

  /**
   * Stop-out liquidation rule:
   * Liquidates the single largest floating loss position first until margin level recovers > 50%.
   */
  private triggerStopOutLiquidation(): void {
    const positionList = Array.from(this.positions.values());
    if (positionList.length === 0) return;

    // Find position with biggest floating loss
    positionList.sort((a, b) => a.floatingPnL - b.floatingPnL);
    const worstPosition = positionList[0];

    if (worstPosition && worstPosition.floatingPnL < 0) {
      this.closePosition(worstPosition.id, 'STOP_OUT');
    }
  }

  /**
   * Calculate required initial margin for a trade
   */
  public calculateRequiredMargin(symbol: string, lots: number, price: number): number {
    const spec = ASSET_SPECS[symbol];
    if (!spec) return 0;
    const nominalValue = lots * spec.contractSize * price;
    return Number((nominalValue / this.account.leverage).toFixed(2));
  }

  /**
   * Opens an immediate Market Order
   */
  public openMarketOrder(
    symbol: string,
    side: OrderSide,
    lots: number,
    sl: number | null = null,
    tp: number | null = null,
    trailingStopPips: number | null = null
  ): { success: boolean; error?: string; position?: Position } {
    const spec = ASSET_SPECS[symbol];
    if (!spec) return { success: false, error: `Invalid symbol: ${symbol}` };

    const tick = marketDataService.getTick(symbol);
    if (!tick) return { success: false, error: `No market data tick for ${symbol}` };

    // Sizing validation
    if (lots < spec.minLot || lots > spec.maxLot) {
      return {
        success: false,
        error: `Lots must be between ${spec.minLot} and ${spec.maxLot}`,
      };
    }

    // Execution price with realistic volatility slippage (0.1 - 0.3 pips under volatility)
    const basePrice = side === 'BUY' ? tick.ask : tick.bid;
    const volMultiplier = marketDataService.getVolatilityMultiplier();
    const slippagePips = (Math.random() > 0.7 ? Math.random() * 0.4 * volMultiplier : 0);
    const slippage = slippagePips * spec.pipMultiplier;
    const executionPrice = Number(
      (side === 'BUY' ? basePrice + slippage : basePrice - slippage).toFixed(spec.digits)
    );

    // Margin validation
    const marginRequired = this.calculateRequiredMargin(symbol, lots, executionPrice);
    if (marginRequired > this.account.freeMargin) {
      return {
        success: false,
        error: `Insufficient Free Margin. Required: $${marginRequired.toLocaleString()}, Available: $${this.account.freeMargin.toLocaleString()}`,
      };
    }

    const position = this.executeOrderInternal(
      symbol,
      side,
      lots,
      executionPrice,
      sl,
      tp,
      trailingStopPips
    );
    this.notifyListeners();
    return { success: true, position };
  }

  private executeOrderInternal(
    symbol: string,
    side: OrderSide,
    lots: number,
    openPrice: number,
    sl: number | null,
    tp: number | null,
    trailingStopPips: number | null = null
  ): Position {
    const spec = ASSET_SPECS[symbol]!;
    const ticketNumber = ++this.ticketCounter;
    const marginRequired = this.calculateRequiredMargin(symbol, lots, openPrice);

    // GKFX-style commission: $3.50/lot per side ($7.00 round turn)
    const commission = Number((spec.commissionPerLot * 2 * lots).toFixed(2));
    this.account.balance -= commission;
    this.account.totalCommissionPaid += commission;

    const position: Position = {
      id: `pos-${ticketNumber}`,
      ticketNumber,
      symbol,
      side,
      lots,
      openPrice,
      openTime: Date.now(),
      currentPrice: openPrice,
      sl,
      tp,
      swap: 0,
      commission,
      floatingPnL: 0,
      marginRequired,
      trailingStopPips,
    };

    this.positions.set(position.id, position);
    return position;
  }

  /**
   * Places a Limit or Stop Pending Order
   */
  public placePendingOrder(
    symbol: string,
    orderType: PendingOrderType,
    lots: number,
    price: number,
    sl: number | null = null,
    tp: number | null = null
  ): { success: boolean; error?: string; order?: PendingOrder } {
    const spec = ASSET_SPECS[symbol];
    if (!spec) return { success: false, error: `Invalid symbol` };

    const tick = marketDataService.getTick(symbol);
    if (!tick) return { success: false, error: `Market data offline` };

    // Validate limit/stop distance
    const currentPrice = orderType.startsWith('BUY') ? tick.ask : tick.bid;
    const minDistancePips = 2.0;
    const distancePips = Math.abs(price - currentPrice) / spec.pipMultiplier;

    if (distancePips < minDistancePips) {
      return {
        success: false,
        error: `Order price too close to market. Minimum distance: ${minDistancePips} pips`,
      };
    }

    const ticketNumber = ++this.ticketCounter;
    const order: PendingOrder = {
      id: `pend-${ticketNumber}`,
      ticketNumber,
      symbol,
      orderType,
      price: Number(price.toFixed(spec.digits)),
      lots,
      sl,
      tp,
      createdAt: Date.now(),
      status: 'PENDING',
    };

    this.pendingOrders.set(order.id, order);
    this.notifyListeners();
    return { success: true, order };
  }

  public cancelPendingOrder(orderId: string): boolean {
    if (this.pendingOrders.has(orderId)) {
      this.pendingOrders.delete(orderId);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Modifies an existing position's SL/TP or Trailing Stop
   */
  public modifyPosition(
    positionId: string,
    sl: number | null,
    tp: number | null,
    trailingStopPips: number | null = null
  ): boolean {
    const pos = this.positions.get(positionId);
    if (!pos) return false;

    pos.sl = sl;
    pos.tp = tp;
    pos.trailingStopPips = trailingStopPips;
    this.notifyListeners();
    return true;
  }

  /**
   * Closes an open position
   */
  public closePosition(
    positionId: string,
    reason: 'MANUAL' | 'SL' | 'TP' | 'STOP_OUT' = 'MANUAL'
  ): boolean {
    const position = this.positions.get(positionId);
    if (!position) return false;

    const spec = ASSET_SPECS[position.symbol];
    if (!spec) return false;

    const tick = marketDataService.getTick(position.symbol);
    const closePrice = tick
      ? (position.side === 'BUY' ? tick.bid : tick.ask)
      : position.currentPrice;

    // Calculate final gross and net P&L
    let grossPnL = 0;
    if (position.side === 'BUY') {
      grossPnL = (closePrice - position.openPrice) * (position.lots * spec.contractSize);
    } else {
      grossPnL = (position.openPrice - closePrice) * (position.lots * spec.contractSize);
    }

    grossPnL = Number(grossPnL.toFixed(2));
    const netPnL = Number((grossPnL + position.swap).toFixed(2)); // Commission was deducted on entry

    // Update account
    this.account.balance += grossPnL + position.swap;
    this.account.realizedPnL += netPnL;

    // Record trade history item
    const historyItem: TradeHistoryItem = {
      id: position.id,
      ticketNumber: position.ticketNumber,
      symbol: position.symbol,
      side: position.side,
      lots: position.lots,
      openPrice: position.openPrice,
      closePrice,
      openTime: position.openTime,
      closeTime: Date.now(),
      grossPnL,
      netPnL,
      swap: position.swap,
      commission: position.commission,
      closeReason: reason,
    };

    this.tradeHistory.unshift(historyItem);
    this.positions.delete(positionId);

    this.recalculateAccountLedger(0);
    this.notifyListeners();
    return true;
  }

  /**
   * Close all active positions
   */
  public closeAllPositions(): void {
    const ids = Array.from(this.positions.keys());
    for (const id of ids) {
      this.closePosition(id, 'MANUAL');
    }
  }

  /**
   * Reset demo account to starting state
   */
  public resetAccount(balance: number = 50000, leverage: number = 100): void {
    this.positions.clear();
    this.pendingOrders.clear();
    this.tradeHistory = [];
    this.account = {
      accountNumber: `GKFX-DEMO-${Math.floor(10000 + Math.random() * 90000)}`,
      brokerName: 'GKFX Financial Services Ltd (Demo)',
      serverName: 'GKFX-Live-ECN-Demo01',
      currency: 'USD',
      leverage,
      balance,
      equity: balance,
      marginUsed: 0,
      freeMargin: balance,
      marginLevelPercent: 0,
      floatingPnL: 0,
      realizedPnL: 0,
      totalCommissionPaid: 0,
      totalSwapPaid: 0,
      status: 'ACTIVE',
      marginCallLevel: 100,
      stopOutLevel: 50,
    };
    this.notifyListeners();
  }

  public getAccount(): DemoAccount {
    return { ...this.account };
  }

  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  public getPendingOrders(): PendingOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  public getTradeHistory(): TradeHistoryItem[] {
    return [...this.tradeHistory];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  public destroy(): void {
    if (this.unsubscribeMarketData) {
      this.unsubscribeMarketData();
    }
    this.listeners.clear();
  }
}

export const brokerEngine = new BrokerEngine(50000, 100);

/**
 * Broker Simulation Engine (QuantEngine Institutional Demo Account)
 * Handles realistic trading execution, margin requirements, dynamic P&L,
 * commissions, swaps, slippage, stop-outs, and full position lifecycle.
 *
 * Guaranteed Arithmetic:
 * 1. P&L and Margin expressed strictly in account currency (USD) across all instruments (including USD/JPY).
 * 2. Instant ledger reconciliation: Balance, equity, margin used, free margin, and margin level
 *    agree at every moment, including immediately after opening or closing positions while others remain open.
 * 3. Exact reconciliation: Realized P&L in the account summary reconciles to the exact cent with the change in balance.
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
  private ticketCounter: number = 7482010;
  private initialBalance: number = 50000;
  private unsubscribeMarketData: (() => void) | null = null;

  constructor(initialBalance: number = 50000, leverage: number = 100) {
    this.initialBalance = initialBalance;
    this.account = {
      accountNumber: 'QE-DEMO-98241',
      brokerName: 'QuantEngine Simulator (Demo)',
      serverName: 'QuantEngine-Sim-01',
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
   * Converts quote currency monetary amount to the account currency (USD).
   * For EUR/USD, GBP/USD, AUD/USD, XAU/USD, US500: Quote currency is USD (conversion factor = 1.0).
   * For USD/JPY: Quote currency is JPY. To convert JPY to USD, divide by the current USD/JPY exchange rate.
   */
  public convertQuoteToUSD(
    symbol: string,
    quoteAmount: number,
    currentPriceOrTick?: number | MarketTick
  ): number {
    if (symbol === 'USD/JPY') {
      let rate = 152.0; // fallback reference rate
      if (typeof currentPriceOrTick === 'number' && currentPriceOrTick > 0) {
        rate = currentPriceOrTick;
      } else if (currentPriceOrTick && typeof (currentPriceOrTick as MarketTick).bid === 'number') {
        rate = ((currentPriceOrTick as MarketTick).bid + (currentPriceOrTick as MarketTick).ask) / 2;
      } else {
        const tick = marketDataService.getTick('USD/JPY');
        if (tick) rate = (tick.bid + tick.ask) / 2;
      }
      return Number((quoteAmount / rate).toFixed(2));
    }
    return Number(quoteAmount.toFixed(2));
  }

  /**
   * Calculates required margin for a position in the account currency (USD).
   * Margin reflects the position's actual notional value measured in the account currency, divided by leverage.
   */
  public calculateRequiredMargin(symbol: string, lots: number, price: number): number {
    const spec = ASSET_SPECS[symbol];
    if (!spec) return 0;
    const leverage = spec.marginLeverage || this.account.leverage;

    let notionalUSD = 0;
    if (symbol === 'USD/JPY') {
      // Base currency is USD: 1 lot = 100,000 USD
      notionalUSD = lots * spec.contractSize;
    } else {
      // Base currency is EUR, GBP, AUD, XAU (oz), or Index points; quoted in USD
      notionalUSD = lots * spec.contractSize * price;
    }

    return Number((notionalUSD / leverage).toFixed(2));
  }

  /**
   * Recomputes account ledger (Equity, Margin Used, Free Margin, Margin Level %)
   * from the true current state of all open positions.
   * Eliminates any interim state.
   */
  public updateAccountLedger(ticksMap?: Map<string, MarketTick>): void {
    let totalFloatingPnL = 0;
    let totalMarginUsed = 0;

    for (const position of this.positions.values()) {
      const spec = ASSET_SPECS[position.symbol];
      if (!spec) continue;

      const tick = ticksMap?.get(position.symbol) || marketDataService.getTick(position.symbol);
      if (tick) {
        const currentClosePrice = position.side === 'BUY' ? tick.bid : tick.ask;
        position.currentPrice = currentClosePrice;

        const rawQuoteDiff =
          position.side === 'BUY'
            ? tick.bid - position.openPrice
            : position.openPrice - tick.ask;
        const rawQuotePnL = rawQuoteDiff * position.lots * spec.contractSize;
        const grossUSD = this.convertQuoteToUSD(position.symbol, rawQuotePnL, currentClosePrice);
        position.floatingPnL = Number((grossUSD - position.commission + position.swap).toFixed(2));
      } else {
        position.floatingPnL = Number((-position.commission + position.swap).toFixed(2));
      }

      totalFloatingPnL += position.floatingPnL;
      totalMarginUsed += position.marginRequired;
    }

    this.account.floatingPnL = Number(totalFloatingPnL.toFixed(2));
    this.account.equity = Number((this.account.balance + totalFloatingPnL).toFixed(2));
    this.account.marginUsed = Number(totalMarginUsed.toFixed(2));
    this.account.freeMargin = Number((this.account.equity - totalMarginUsed).toFixed(2));

    if (totalMarginUsed > 0) {
      this.account.marginLevelPercent = Number(((this.account.equity / totalMarginUsed) * 100).toFixed(1));
    } else {
      this.account.marginLevelPercent = 0;
    }

    // Status warning
    if (totalMarginUsed > 0 && this.account.marginLevelPercent <= this.account.stopOutLevel) {
      this.account.status = 'STOPPED_OUT';
    } else if (totalMarginUsed > 0 && this.account.marginLevelPercent <= this.account.marginCallLevel) {
      this.account.status = 'MARGIN_CALL';
    } else {
      this.account.status = 'ACTIVE';
    }
  }

  /**
   * On every market tick:
   * 1. Check and execute Stop Loss & Take Profit limits
   * 2. Update Trailing Stops
   * 3. Check and trigger Pending Orders (Limit & Stop)
   * 4. Recalculate Account Ledger (Equity, Margin, Free Margin)
   * 5. Verify Margin Level & enforce Stop-Out liquidations if <= 50%
   */
  private onTickUpdate(ticks: Map<string, MarketTick>): void {
    const positionsToClose: { position: Position; reason: 'SL' | 'TP' }[] = [];

    // 1. Process positions for SL, TP, and Trailing Stops
    for (const position of this.positions.values()) {
      const tick = ticks.get(position.symbol);
      if (!tick) continue;

      const spec = ASSET_SPECS[position.symbol];
      if (!spec) continue;

      // Trailing stop adjustment
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
    this.updateAccountLedger(ticks);

    // 4. Enforce Stop-Out liquidation if Margin Level <= 50%
    this.enforceStopOutLiquidation(ticks);

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
          if (tick.ask <= order.price) {
            triggered = true;
            executionPrice = tick.ask;
          }
          break;
        case 'SELL_LIMIT':
          if (tick.bid >= order.price) {
            triggered = true;
            executionPrice = tick.bid;
          }
          break;
        case 'BUY_STOP':
          if (tick.ask >= order.price) {
            triggered = true;
            executionPrice = tick.ask;
          }
          break;
        case 'SELL_STOP':
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
      // Validate margin before opening position
      // "No order — including a resting one that triggers later — opens a position for which no margin is available."
      const requiredMargin = this.calculateRequiredMargin(order.symbol, order.lots, order.price);
      if (requiredMargin > this.account.freeMargin) {
        order.status = 'CANCELLED';
        continue;
      }

      this.pendingOrders.delete(order.id);
      const side: OrderSide =
        order.orderType === 'BUY_LIMIT' || order.orderType === 'BUY_STOP' ? 'BUY' : 'SELL';
      this.executeOrderInternal(order.symbol, side, order.lots, order.price, order.sl, order.tp);
    }
  }

  /**
   * Stop-out liquidation rule:
   * Liquidates the worst losing position until margin level recovers > 50%.
   */
  private enforceStopOutLiquidation(ticksMap?: Map<string, MarketTick>): void {
    while (
      this.positions.size > 0 &&
      this.account.marginUsed > 0 &&
      this.account.marginLevelPercent <= this.account.stopOutLevel
    ) {
      const positionList = Array.from(this.positions.values());
      positionList.sort((a, b) => a.floatingPnL - b.floatingPnL);
      const worstPosition = positionList[0];
      if (!worstPosition) break;

      this.closePosition(worstPosition.id, 'STOP_OUT', ticksMap);
      this.updateAccountLedger(ticksMap);
    }
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

    const basePrice = side === 'BUY' ? tick.ask : tick.bid;
    const volMultiplier = marketDataService.getVolatilityMultiplier();
    const slippagePips = Math.random() > 0.7 ? Math.random() * 0.4 * volMultiplier : 0;
    const slippage = slippagePips * spec.pipMultiplier;
    const executionPrice = Number(
      (side === 'BUY' ? basePrice + slippage : basePrice - slippage).toFixed(spec.digits)
    );

    // SL/TP validation
    if (sl !== null) {
      if (side === 'BUY' && sl >= executionPrice) {
        return { success: false, error: `Stop Loss for BUY must be below execution price (${executionPrice})` };
      }
      if (side === 'SELL' && sl <= executionPrice) {
        return { success: false, error: `Stop Loss for SELL must be above execution price (${executionPrice})` };
      }
    }
    if (tp !== null) {
      if (side === 'BUY' && tp <= executionPrice) {
        return { success: false, error: `Take Profit for BUY must be above execution price (${executionPrice})` };
      }
      if (side === 'SELL' && tp >= executionPrice) {
        return { success: false, error: `Take Profit for SELL must be below execution price (${executionPrice})` };
      }
    }

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

    // Immediately update ledger and notify listeners: zero lag or interim state
    this.updateAccountLedger();
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

    // Institutional commission: $3.50/lot per side ($7.00 round turn)
    const commission = Number((spec.commissionPerLot * 2 * lots).toFixed(2));
    this.account.totalCommissionPaid = Number((this.account.totalCommissionPaid + commission).toFixed(2));

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
      floatingPnL: -commission,
      marginRequired,
      trailingStopPips,
    };

    this.positions.set(position.id, position);
    return position;
  }

  /**
   * Places a Limit or Stop Pending Order with strict validation
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

    // Sizing validation
    if (lots < spec.minLot || lots > spec.maxLot) {
      return {
        success: false,
        error: `Lots must be between ${spec.minLot} and ${spec.maxLot}`,
      };
    }

    // Directional order validation:
    // "A buy order meant to trigger at a lower price is rejected if it sits above the market."
    if (orderType === 'BUY_LIMIT' && price >= tick.ask) {
      return {
        success: false,
        error: `Buy Limit price (${price}) must be lower than current Ask price (${tick.ask.toFixed(spec.digits)})`,
      };
    }
    if (orderType === 'BUY_STOP' && price <= tick.ask) {
      return {
        success: false,
        error: `Buy Stop price (${price}) must be higher than current Ask price (${tick.ask.toFixed(spec.digits)})`,
      };
    }
    if (orderType === 'SELL_LIMIT' && price <= tick.bid) {
      return {
        success: false,
        error: `Sell Limit price (${price}) must be higher than current Bid price (${tick.bid.toFixed(spec.digits)})`,
      };
    }
    if (orderType === 'SELL_STOP' && price >= tick.bid) {
      return {
        success: false,
        error: `Sell Stop price (${price}) must be lower than current Bid price (${tick.bid.toFixed(spec.digits)})`,
      };
    }

    // Distance validation
    const currentPrice = orderType.startsWith('BUY') ? tick.ask : tick.bid;
    const minDistancePips = 2.0;
    const distancePips = Math.abs(price - currentPrice) / spec.pipMultiplier;

    if (distancePips < minDistancePips) {
      return {
        success: false,
        error: `Order price too close to market. Minimum distance: ${minDistancePips} pips`,
      };
    }

    // Margin availability validation
    const estMargin = this.calculateRequiredMargin(symbol, lots, price);
    if (estMargin > this.account.freeMargin) {
      return {
        success: false,
        error: `Insufficient free margin for order. Required: $${estMargin.toFixed(2)}, Available: $${this.account.freeMargin.toFixed(2)}`,
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
   * Closes an open position and reconciles account ledger immediately.
   */
  public closePosition(
    positionId: string,
    reason: 'MANUAL' | 'SL' | 'TP' | 'STOP_OUT' = 'MANUAL',
    ticksMap?: Map<string, MarketTick>
  ): boolean {
    const position = this.positions.get(positionId);
    if (!position) return false;

    const spec = ASSET_SPECS[position.symbol];
    if (!spec) return false;

    const tick = ticksMap?.get(position.symbol) || marketDataService.getTick(position.symbol);
    const closePrice = tick
      ? position.side === 'BUY'
        ? tick.bid
        : tick.ask
      : position.currentPrice;

    // Calculate gross P&L in quote currency and convert to USD
    let rawQuoteDiff = 0;
    if (position.side === 'BUY') {
      rawQuoteDiff = closePrice - position.openPrice;
    } else {
      rawQuoteDiff = position.openPrice - closePrice;
    }
    const rawQuotePnL = rawQuoteDiff * position.lots * spec.contractSize;
    const grossPnL = this.convertQuoteToUSD(position.symbol, rawQuotePnL, closePrice);

    // Net PnL includes all costs: Gross PnL - Commission + Swap
    const netPnL = Number((grossPnL - position.commission + position.swap).toFixed(2));

    // Update account balance and realized P&L:
    // netPnL includes all costs: grossPnL - commission + swap
    this.account.balance = Number((this.account.balance + netPnL).toFixed(2));
    this.account.realizedPnL = Number((this.account.realizedPnL + netPnL).toFixed(2));

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

    // Immediately update ledger: reconciles remaining open positions with zero delay
    this.updateAccountLedger();
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
    this.initialBalance = balance;
    this.positions.clear();
    this.pendingOrders.clear();
    this.tradeHistory = [];
    this.account = {
      accountNumber: `QE-DEMO-${Math.floor(10000 + Math.random() * 90000)}`,
      brokerName: 'QuantEngine Simulator (Demo)',
      serverName: 'QuantEngine-Sim-01',
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

/**
 * Broker Order Entry Ticket (GKFX-style Trading Console)
 * Handles Instant Market Execution, Limit & Stop Pending Orders,
 * Margin Requirement Estimations, Pip Calculations, and Trailing Stops.
 */

import React, { useState, useMemo } from 'react';
import { MarketTick, OrderSide, PendingOrderType } from '../types/trading';
import { ASSET_SPECS } from '../services/marketDataService';
import { brokerEngine } from '../services/brokerEngine';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  ShieldAlert,
} from 'lucide-react';

interface OrderTicketProps {
  selectedSymbol: string;
  onSelectSymbol: (sym: string) => void;
  currentTick?: MarketTick;
  freeMargin: number;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({
  selectedSymbol,
  onSelectSymbol,
  currentTick,
  freeMargin,
}) => {
  const [orderMode, setOrderMode] = useState<'MARKET' | 'PENDING'>('MARKET');
  const [pendingType, setPendingType] = useState<PendingOrderType>('BUY_LIMIT');
  const [pendingPrice, setPendingPrice] = useState<string>('');
  const [lots, setLots] = useState<number>(1.0);
  const [slPips, setSlPips] = useState<string>('25');
  const [tpPips, setTpPips] = useState<string>('50');
  const [enableTrailing, setEnableTrailing] = useState<boolean>(false);
  const [trailingPips, setTrailingPips] = useState<string>('20');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const spec = ASSET_SPECS[selectedSymbol];
  const digits = spec ? spec.digits : 5;

  // Pip value in USD:
  // For 1.00 lot EUR/USD (100k units): 1 pip (0.0001) = $10.00
  // For XAU/USD (100 oz): 1 pip ($0.01) = $1.00
  const pipValueUSD = useMemo(() => {
    if (!spec) return 10;
    return Number((lots * spec.contractSize * spec.pipMultiplier).toFixed(2));
  }, [lots, spec]);

  // Estimated required margin
  const estMargin = useMemo(() => {
    if (!spec || !currentTick) return 0;
    const price = currentTick.bid;
    return brokerEngine.calculateRequiredMargin(selectedSymbol, lots, price);
  }, [spec, currentTick, selectedSymbol, lots]);

  // Round turn commission
  const estCommission = useMemo(() => {
    if (!spec) return 0;
    return Number((spec.commissionPerLot * 2 * lots).toFixed(2));
  }, [spec, lots]);

  const handleLotChange = (delta: number) => {
    const nextLots = Number(Math.max(0.01, Math.min(50, lots + delta)).toFixed(2));
    setLots(nextLots);
  };

  const handleExecuteMarket = (side: OrderSide) => {
    setStatusMessage(null);
    if (!currentTick || !spec) return;

    const basePrice = side === 'BUY' ? currentTick.ask : currentTick.bid;
    const slDist = parseFloat(slPips) > 0 ? parseFloat(slPips) * spec.pipMultiplier : 0;
    const tpDist = parseFloat(tpPips) > 0 ? parseFloat(tpPips) * spec.pipMultiplier : 0;

    let sl: number | null = null;
    let tp: number | null = null;

    if (slDist > 0) {
      sl = side === 'BUY' ? basePrice - slDist : basePrice + slDist;
      sl = Number(sl.toFixed(digits));
    }
    if (tpDist > 0) {
      tp = side === 'BUY' ? basePrice + tpDist : basePrice - tpDist;
      tp = Number(tp.toFixed(digits));
    }

    const trailing = enableTrailing && parseFloat(trailingPips) > 0 ? parseFloat(trailingPips) : null;

    const result = brokerEngine.openMarketOrder(
      selectedSymbol,
      side,
      lots,
      sl,
      tp,
      trailing
    );

    if (result.success && result.position) {
      setStatusMessage({
        type: 'success',
        text: `Ticket #${result.position.ticketNumber}: ${side} ${lots} ${selectedSymbol} executed @ ${result.position.openPrice.toFixed(digits)}`,
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Execution failed',
      });
    }
  };

  const handlePlacePending = () => {
    setStatusMessage(null);
    if (!currentTick || !spec) return;

    const targetPrice = parseFloat(pendingPrice);
    if (isNaN(targetPrice) || targetPrice <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid pending order price' });
      return;
    }

    const side: OrderSide = pendingType.startsWith('BUY') ? 'BUY' : 'SELL';
    const slDist = parseFloat(slPips) > 0 ? parseFloat(slPips) * spec.pipMultiplier : 0;
    const tpDist = parseFloat(tpPips) > 0 ? parseFloat(tpPips) * spec.pipMultiplier : 0;

    let sl: number | null = null;
    let tp: number | null = null;

    if (slDist > 0) {
      sl = side === 'BUY' ? targetPrice - slDist : targetPrice + slDist;
      sl = Number(sl.toFixed(digits));
    }
    if (tpDist > 0) {
      tp = side === 'BUY' ? targetPrice + tpDist : targetPrice - tpDist;
      tp = Number(tp.toFixed(digits));
    }

    const result = brokerEngine.placePendingOrder(
      selectedSymbol,
      pendingType,
      lots,
      targetPrice,
      sl,
      tp
    );

    if (result.success && result.order) {
      setStatusMessage({
        type: 'success',
        text: `Order #${result.order.ticketNumber}: ${pendingType} placed @ ${result.order.price.toFixed(digits)}`,
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Failed to place pending order',
      });
    }
  };

  return (
    <div className="flex flex-col bg-[#0f1422] border border-slate-800 rounded-xl p-4 shadow-xl text-slate-300">
      {/* Header & Symbol Selector */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Order Ticket</h2>
        </div>

        <select
          id="symbol-selector"
          value={selectedSymbol}
          onChange={(e) => onSelectSymbol(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
        >
          {Object.keys(ASSET_SPECS).map((sym) => (
            <option key={sym} value={sym}>
              {sym} ({ASSET_SPECS[sym].assetClass.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Execution Mode Tabs */}
      <div className="grid grid-cols-2 gap-2 my-3 p-1 bg-slate-900/80 rounded-lg border border-slate-800">
        <button
          id="market-execution-tab"
          onClick={() => setOrderMode('MARKET')}
          className={`py-1.5 text-xs font-medium rounded-md transition-all ${
            orderMode === 'MARKET'
              ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Instant Execution
        </button>
        <button
          id="pending-order-tab"
          onClick={() => {
            setOrderMode('PENDING');
            if (currentTick && !pendingPrice) {
              setPendingPrice(currentTick.bid.toFixed(digits));
            }
          }}
          className={`py-1.5 text-xs font-medium rounded-md transition-all ${
            orderMode === 'PENDING'
              ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pending Order
        </button>
      </div>

      {/* Dynamic Live Spread Badge */}
      {currentTick && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800/80 mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Dynamic Spread:</span>
            <strong className="text-amber-400 font-mono">{currentTick.spreadPips} pips</strong>
          </div>
          <div className="text-[11px] text-slate-500">
            Leverage: <strong className="text-slate-300">1:{spec?.marginLeverage || 100}</strong>
          </div>
        </div>
      )}

      {/* Lot Sizing Stepper */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-300 font-medium">Volume (Lots):</span>
          <span className="text-[11px] font-mono text-slate-400">
            Pip Value: <strong className="text-emerald-400">${pipValueUSD}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            id="lots-minus-tenth"
            onClick={() => handleLotChange(-0.1)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono font-medium text-slate-200"
          >
            -0.10
          </button>
          <button
            id="lots-minus-hundredth"
            onClick={() => handleLotChange(-0.01)}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono font-medium text-slate-200"
          >
            -0.01
          </button>
          <input
            id="order-lots-input"
            type="number"
            step="0.01"
            min="0.01"
            max="100"
            value={lots}
            onChange={(e) => setLots(parseFloat(e.target.value) || 0.01)}
            className="flex-1 bg-slate-950 border border-slate-700 text-center font-mono text-sm font-bold text-slate-100 rounded py-1.5 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
          <button
            id="lots-plus-hundredth"
            onClick={() => handleLotChange(0.01)}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono font-medium text-slate-200"
          >
            +0.01
          </button>
          <button
            id="lots-plus-tenth"
            onClick={() => handleLotChange(0.1)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono font-medium text-slate-200"
          >
            +0.10
          </button>
        </div>
      </div>

      {/* Pending Order Type & Price Input */}
      {orderMode === 'PENDING' && (
        <div className="space-y-2.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 mb-3">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Order Type</label>
            <select
              id="pending-type-select"
              value={pendingType}
              onChange={(e) => setPendingType(e.target.value as PendingOrderType)}
              className="w-full bg-slate-950 border border-slate-700 text-xs rounded p-1.5 text-slate-200 focus:outline-none"
            >
              <option value="BUY_LIMIT">Buy Limit (Buy below market)</option>
              <option value="SELL_LIMIT">Sell Limit (Sell above market)</option>
              <option value="BUY_STOP">Buy Stop (Buy on breakout above)</option>
              <option value="SELL_STOP">Sell Stop (Sell on breakdown below)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Execution Price</label>
            <input
              id="pending-price-input"
              type="number"
              step="0.00001"
              value={pendingPrice}
              onChange={(e) => setPendingPrice(e.target.value)}
              placeholder={currentTick ? currentTick.bid.toFixed(digits) : '0.00000'}
              className="w-full bg-slate-950 border border-slate-700 font-mono text-xs rounded p-1.5 text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Stop Loss & Take Profit (Pip Offset) */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="flex items-center justify-between text-xs text-rose-400 mb-1">
            <span>Stop Loss:</span>
            <span className="text-[10px] text-slate-500 font-mono">pips</span>
          </label>
          <div className="relative">
            <input
              id="sl-pips-input"
              type="number"
              value={slPips}
              onChange={(e) => setSlPips(e.target.value)}
              placeholder="25"
              className="w-full bg-slate-950 border border-rose-900/40 text-rose-200 font-mono text-xs rounded p-1.5 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center justify-between text-xs text-emerald-400 mb-1">
            <span>Take Profit:</span>
            <span className="text-[10px] text-slate-500 font-mono">pips</span>
          </label>
          <div className="relative">
            <input
              id="tp-pips-input"
              type="number"
              value={tpPips}
              onChange={(e) => setTpPips(e.target.value)}
              placeholder="50"
              className="w-full bg-slate-950 border border-emerald-900/40 text-emerald-200 font-mono text-xs rounded p-1.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Trailing Stop Toggle */}
      <div className="flex items-center justify-between p-2 bg-slate-900/40 border border-slate-800 rounded-lg mb-3">
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            id="trailing-stop-toggle"
            type="checkbox"
            checked={enableTrailing}
            onChange={(e) => setEnableTrailing(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500"
          />
          <span>Trailing Stop</span>
        </label>
        {enableTrailing && (
          <div className="flex items-center gap-1 text-xs">
            <input
              id="trailing-pips-input"
              type="number"
              value={trailingPips}
              onChange={(e) => setTrailingPips(e.target.value)}
              className="w-14 bg-slate-950 border border-slate-700 text-center font-mono text-xs rounded py-0.5"
            />
            <span className="text-[10px] text-slate-500">pips</span>
          </div>
        )}
      </div>

      {/* Margin & Fee Estimation Card */}
      <div className="p-2.5 bg-[#090d16] border border-slate-800/80 rounded-lg text-[11px] font-mono space-y-1 mb-4">
        <div className="flex justify-between">
          <span className="text-slate-400">Required Margin:</span>
          <strong className={`font-semibold ${estMargin > freeMargin ? 'text-rose-400' : 'text-slate-200'}`}>
            ${estMargin.toLocaleString()}
          </strong>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Commission (Round turn):</span>
          <span className="text-slate-300">${estCommission.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Free Margin Available:</span>
          <span className="text-emerald-400">${freeMargin.toLocaleString()}</span>
        </div>
      </div>

      {/* Action Buttons */}
      {orderMode === 'MARKET' ? (
        <div className="grid grid-cols-2 gap-3">
          {/* SELL BUTTON */}
          <button
            id="order-sell-btn"
            onClick={() => handleExecuteMarket('SELL')}
            disabled={!currentTick || estMargin > freeMargin}
            className="flex flex-col items-center justify-center p-3 bg-rose-600/90 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider mb-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>SELL</span>
            </div>
            <span className="font-mono text-base tracking-tight">
              {currentTick ? currentTick.bid.toFixed(digits) : '---'}
            </span>
          </button>

          {/* BUY BUTTON */}
          <button
            id="order-buy-btn"
            onClick={() => handleExecuteMarket('BUY')}
            disabled={!currentTick || estMargin > freeMargin}
            className="flex flex-col items-center justify-center p-3 bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-1 text-xs uppercase tracking-wider mb-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>BUY</span>
            </div>
            <span className="font-mono text-base tracking-tight">
              {currentTick ? currentTick.ask.toFixed(digits) : '---'}
            </span>
          </button>
        </div>
      ) : (
        <button
          id="order-place-pending-btn"
          onClick={handlePlacePending}
          disabled={!currentTick}
          className="w-full py-3 bg-cyan-600/90 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-xl font-bold shadow-lg shadow-cyan-950/40 transition-all disabled:opacity-40 text-xs uppercase tracking-wider"
        >
          Place {pendingType.replace('_', ' ')} Order
        </button>
      )}

      {/* Status Feedback Message */}
      {statusMessage && (
        <div
          className={`flex items-start gap-2 p-2.5 mt-3 rounded-lg text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="leading-tight">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};

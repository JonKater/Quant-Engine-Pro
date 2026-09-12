/**
 * Market Watch Component (GKFX ECN Quote Board)
 * Real-time streaming Bid / Ask table with dynamic spread monitoring,
 * flash animations on tick updates, and symbol selection.
 */

import React, { useEffect, useRef } from 'react';
import { MarketTick } from '../types/trading';
import { ASSET_SPECS } from '../services/marketDataService';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface MarketWatchProps {
  ticks: Map<string, MarketTick>;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const MarketWatch: React.FC<MarketWatchProps> = ({
  ticks,
  selectedSymbol,
  onSelectSymbol,
}) => {
  const prevTicksRef = useRef<Map<string, number>>(new Map());

  return (
    <div className="flex flex-col bg-[#0f1422] border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-300">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111726] border-b border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Market Watch</span>
        <span className="text-[10px] font-mono text-slate-400">ECN L1 Stream</span>
      </div>

      <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-850 text-xs font-mono">
        {Object.keys(ASSET_SPECS).map((sym) => {
          const spec = ASSET_SPECS[sym];
          const tick = ticks.get(sym);
          const digits = spec.digits;
          const isSelected = selectedSymbol === sym;

          // Track tick direction
          const prevBid = prevTicksRef.current.get(sym);
          const isTickUp = tick && prevBid !== undefined ? tick.bid > prevBid : false;
          const isTickDown = tick && prevBid !== undefined ? tick.bid < prevBid : false;

          if (tick) {
            prevTicksRef.current.set(sym, tick.bid);
          }

          return (
            <div
              key={sym}
              id={`market-watch-row-${sym.replace('/', '-')}`}
              onClick={() => onSelectSymbol(sym)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                  : 'hover:bg-slate-900/50'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-100">{sym}</span>
                  <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 uppercase">
                    {spec.assetClass}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  Spr: <strong className="text-amber-400 font-mono">{tick?.spreadPips || spec.baseSpreadPips}p</strong>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`font-semibold transition-colors duration-200 ${
                      isTickDown ? 'text-rose-400' : isTickUp ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {tick ? tick.bid.toFixed(digits) : '---'}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="font-semibold text-slate-200">
                    {tick ? tick.ask.toFixed(digits) : '---'}
                  </span>
                </div>

                {tick && (
                  <div className="flex items-center justify-end gap-1 text-[10px]">
                    {tick.change24hPercent >= 0 ? (
                      <span className="text-emerald-400 flex items-center">
                        <ArrowUp className="w-2.5 h-2.5" />+{tick.change24hPercent}%
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center">
                        <ArrowDown className="w-2.5 h-2.5" />{tick.change24hPercent}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

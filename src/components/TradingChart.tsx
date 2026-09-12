/**
 * High-Performance Financial Candlestick Chart
 * Renders Candlesticks, Dynamic Bid/Ask Spread lines, EMAs,
 * Bollinger Bands, Volume, and Positions with zero external chart library overhead.
 */

import React, { useMemo, useState } from 'react';
import { Candle, MarketTick, Position } from '../types/trading';
import { calculateBollingerBands, calculateEMA, calculateRSI } from '../services/indicators';
import { ASSET_SPECS } from '../services/marketDataService';
import { Maximize2, Minimize2, Sliders, TrendingUp } from 'lucide-react';

interface TradingChartProps {
  symbol: string;
  candles: Candle[];
  tick?: MarketTick;
  positions: Position[];
  timeframe: 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
  onTimeframeChange: (tf: 'M5' | 'M15' | 'H1' | 'H4' | 'D1') => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  candles,
  tick,
  positions,
  timeframe,
  onTimeframeChange,
}) => {
  const [showIndicators, setShowIndicators] = useState(true);
  const [showSubPanel, setShowSubPanel] = useState<'NONE' | 'RSI'>('RSI');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  const spec = ASSET_SPECS[symbol];
  const digits = spec ? spec.digits : 5;

  // Viewport slice (last 60 candles)
  const visibleCandles = useMemo(() => {
    return candles.slice(-60);
  }, [candles]);

  // Calculate overlay indicators
  const ema20 = useMemo(() => calculateEMA(visibleCandles, 20), [visibleCandles]);
  const ema50 = useMemo(() => calculateEMA(visibleCandles, 50), [visibleCandles]);
  const bb = useMemo(() => calculateBollingerBands(visibleCandles, 20, 2.0), [visibleCandles]);
  const rsi = useMemo(() => calculateRSI(visibleCandles, 14), [visibleCandles]);

  // Price bounds
  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, maxPrice: 1, maxVol: 1 };
    let min = Infinity;
    let max = -Infinity;
    let mv = 0;

    for (const c of visibleCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > mv) mv = c.volume;
    }

    // Add padding
    const padding = (max - min) * 0.08 || 0.001;
    return { minPrice: min - padding, maxPrice: max + padding, maxVol: mv || 1000 };
  }, [visibleCandles]);

  // Chart dimensions
  const width = 800;
  const height = 400;
  const subPanelHeight = showSubPanel === 'RSI' ? 90 : 0;
  const mainHeight = height - subPanelHeight;
  const candleWidth = Math.max(3, (width - 70) / (visibleCandles.length || 1));

  const getY = (price: number) => {
    if (maxPrice === minPrice) return mainHeight / 2;
    return mainHeight - ((price - minPrice) / (maxPrice - minPrice)) * (mainHeight - 30) - 15;
  };

  const getRsiY = (rsiVal: number) => {
    if (isNaN(rsiVal)) return mainHeight + subPanelHeight / 2;
    const clamped = Math.max(0, Math.min(100, rsiVal));
    return mainHeight + subPanelHeight - (clamped / 100) * (subPanelHeight - 20) - 10;
  };

  // Positions for this symbol
  const symbolPositions = positions.filter((p) => p.symbol === symbol);

  return (
    <div className="flex flex-col bg-[#0b0f19] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111726] border-b border-slate-800 text-xs select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-100 text-sm tracking-wide">{symbol}</span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-slate-800 text-slate-400">
              {spec?.assetClass}
            </span>
          </div>

          {/* Timeframe Toggles */}
          <div className="flex items-center bg-slate-900/90 rounded-md p-0.5 border border-slate-700/60">
            {(['M5', 'M15', 'H1', 'H4', 'D1'] as const).map((tf) => (
              <button
                key={tf}
                id={`tf-button-${tf}`}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Live Quote Pill */}
          {tick && (
            <div className="hidden sm:flex items-center gap-2 font-mono text-xs pl-2 border-l border-slate-700">
              <span className="text-slate-400">Bid: <strong className="text-slate-200">{tick.bid.toFixed(digits)}</strong></span>
              <span className="text-slate-400">Ask: <strong className="text-slate-200">{tick.ask.toFixed(digits)}</strong></span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                Spread: {tick.spreadPips} pips
              </span>
            </div>
          )}
        </div>

        {/* Indicator Controls */}
        <div className="flex items-center gap-2">
          <button
            id="toggle-indicators-btn"
            onClick={() => setShowIndicators(!showIndicators)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              showIndicators
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>EMA/BB</span>
          </button>

          <button
            id="toggle-subpanel-btn"
            onClick={() => setShowSubPanel(showSubPanel === 'RSI' ? 'NONE' : 'RSI')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              showSubPanel === 'RSI'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>RSI (14)</span>
          </button>
        </div>
      </div>

      {/* Hover Info Strip */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0e1320] text-[11px] font-mono text-slate-400 border-b border-slate-850">
        {hoveredCandle ? (
          <>
            <span>Time: <strong className="text-slate-200">{new Date(hoveredCandle.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
            <span>O: <strong className="text-slate-200">{hoveredCandle.open.toFixed(digits)}</strong></span>
            <span>H: <strong className="text-emerald-400">{hoveredCandle.high.toFixed(digits)}</strong></span>
            <span>L: <strong className="text-rose-400">{hoveredCandle.low.toFixed(digits)}</strong></span>
            <span>C: <strong className="text-slate-200">{hoveredCandle.close.toFixed(digits)}</strong></span>
            <span>Vol: <strong className="text-slate-300">{hoveredCandle.volume.toLocaleString()}</strong></span>
          </>
        ) : (
          <span>Hover over candles to view tick details & indicator values</span>
        )}
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative w-full overflow-x-auto select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-h-[360px] bg-[#090d16]"
          onMouseLeave={() => setHoveredCandle(null)}
        >
          <defs>
            <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="bbBandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = mainHeight * ratio;
            const priceVal = maxPrice - (ratio * (maxPrice - minPrice));
            return (
              <g key={ratio}>
                <line x1="0" y1={y} x2={width - 65} y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={width - 60} y={y + 3} fill="#64748b" fontSize="10" fontFamily="monospace">
                  {priceVal.toFixed(digits)}
                </text>
              </g>
            );
          })}

          {/* Volume bars */}
          {visibleCandles.map((c, idx) => {
            const x = idx * candleWidth + candleWidth * 0.2;
            const vHeight = (c.volume / maxVol) * 45;
            const y = mainHeight - vHeight;
            const isBull = c.close >= c.open;
            return (
              <rect
                key={`vol-${idx}`}
                x={x}
                y={y}
                width={candleWidth * 0.6}
                height={vHeight}
                fill={isBull ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}
              />
            );
          })}

          {/* Bollinger Bands Shading & Lines */}
          {showIndicators && bb.upper.length > 0 && (
            <g>
              {/* Bollinger Band outline paths */}
              <path
                d={visibleCandles
                  .map((_, idx) => {
                    const x = idx * candleWidth + candleWidth / 2;
                    const y = getY(bb.upper[idx]);
                    return isNaN(y) ? '' : `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <path
                d={visibleCandles
                  .map((_, idx) => {
                    const x = idx * candleWidth + candleWidth / 2;
                    const y = getY(bb.lower[idx]);
                    return isNaN(y) ? '' : `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            </g>
          )}

          {/* EMA Overlays */}
          {showIndicators && (
            <g>
              {/* EMA 20 (Fast) */}
              <path
                d={visibleCandles
                  .map((_, idx) => {
                    const x = idx * candleWidth + candleWidth / 2;
                    const y = getY(ema20[idx]);
                    return isNaN(y) ? '' : `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.4"
              />
              {/* EMA 50 (Slow) */}
              <path
                d={visibleCandles
                  .map((_, idx) => {
                    const x = idx * candleWidth + candleWidth / 2;
                    const y = getY(ema50[idx]);
                    return isNaN(y) ? '' : `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#eab308"
                strokeWidth="1.2"
              />
            </g>
          )}

          {/* Candlesticks */}
          {visibleCandles.map((c, idx) => {
            const x = idx * candleWidth + candleWidth * 0.15;
            const w = candleWidth * 0.7;
            const isBull = c.close >= c.open;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

            return (
              <g
                key={`candle-${idx}`}
                className="cursor-crosshair group"
                onMouseEnter={() => setHoveredCandle(c)}
              >
                {/* Wick */}
                <line
                  x1={x + w / 2}
                  y1={highY}
                  x2={x + w / 2}
                  y2={lowY}
                  stroke={isBull ? '#10b981' : '#f43f5e'}
                  strokeWidth="1"
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyY}
                  width={w}
                  height={bodyHeight}
                  fill={isBull ? '#10b981' : '#f43f5e'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Real-time Bid/Ask lines */}
          {tick && (
            <g>
              {/* Ask line (red/amber dotted) */}
              <line
                x1="0"
                y1={getY(tick.ask)}
                x2={width - 65}
                y2={getY(tick.ask)}
                stroke="#f43f5e"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <rect
                x={width - 62}
                y={getY(tick.ask) - 8}
                width="60"
                height="16"
                fill="#f43f5e"
                rx="2"
              />
              <text
                x={width - 58}
                y={getY(tick.ask) + 3}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {tick.ask.toFixed(digits)}
              </text>

              {/* Bid line (cyan/green dotted) */}
              <line
                x1="0"
                y1={getY(tick.bid)}
                x2={width - 65}
                y2={getY(tick.bid)}
                stroke="#06b6d4"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <rect
                x={width - 62}
                y={getY(tick.bid) - 8}
                width="60"
                height="16"
                fill="#06b6d4"
                rx="2"
              />
              <text
                x={width - 58}
                y={getY(tick.bid) + 3}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {tick.bid.toFixed(digits)}
              </text>
            </g>
          )}

          {/* Position Entry & SL/TP lines */}
          {symbolPositions.map((pos) => {
            const entryY = getY(pos.openPrice);
            return (
              <g key={pos.id}>
                {/* Entry line */}
                <line
                  x1="0"
                  y1={entryY}
                  x2={width - 65}
                  y2={entryY}
                  stroke={pos.side === 'BUY' ? '#10b981' : '#f59e0b'}
                  strokeDasharray="4 3"
                  strokeWidth="1.2"
                />
                <text
                  x="8"
                  y={entryY - 4}
                  fill={pos.side === 'BUY' ? '#34d399' : '#fbbf24'}
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  #{pos.ticketNumber} {pos.side} {pos.lots} lots @ {pos.openPrice.toFixed(digits)}
                </text>

                {/* Stop Loss Line */}
                {pos.sl && (
                  <line
                    x1="0"
                    y1={getY(pos.sl)}
                    x2={width - 65}
                    y2={getY(pos.sl)}
                    stroke="#ef4444"
                    strokeDasharray="2 4"
                    strokeWidth="1"
                  />
                )}

                {/* Take Profit Line */}
                {pos.tp && (
                  <line
                    x1="0"
                    y1={getY(pos.tp)}
                    x2={width - 65}
                    y2={getY(pos.tp)}
                    stroke="#22c55e"
                    strokeDasharray="2 4"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}

          {/* Sub-panel: RSI Indicator */}
          {showSubPanel === 'RSI' && (
            <g>
              {/* Separator line */}
              <line
                x1="0"
                y1={mainHeight}
                x2={width}
                y2={mainHeight}
                stroke="#1e293b"
                strokeWidth="1"
              />

              {/* Overbought line (70) */}
              <line
                x1="0"
                y1={getRsiY(70)}
                x2={width - 65}
                y2={getRsiY(70)}
                stroke="#ef4444"
                strokeDasharray="2 2"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <text x={width - 55} y={getRsiY(70) + 3} fill="#ef4444" fontSize="9" fontFamily="monospace">
                70 OB
              </text>

              {/* Middle line (50) */}
              <line
                x1="0"
                y1={getRsiY(50)}
                x2={width - 65}
                y2={getRsiY(50)}
                stroke="#64748b"
                strokeDasharray="2 2"
                strokeWidth="0.6"
                opacity="0.4"
              />

              {/* Oversold line (30) */}
              <line
                x1="0"
                y1={getRsiY(30)}
                x2={width - 65}
                y2={getRsiY(30)}
                stroke="#10b981"
                strokeDasharray="2 2"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <text x={width - 55} y={getRsiY(30) + 3} fill="#10b981" fontSize="9" fontFamily="monospace">
                30 OS
              </text>

              {/* RSI Curve */}
              <path
                d={visibleCandles
                  .map((_, idx) => {
                    const x = idx * candleWidth + candleWidth / 2;
                    const y = getRsiY(rsi[idx]);
                    return isNaN(y) ? '' : `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
              />
              <text x="8" y={mainHeight + 16} fill="#c084fc" fontSize="10" fontWeight="bold">
                RSI (14): {visibleCandles.length > 0 && !isNaN(rsi[rsi.length - 1]) ? rsi[rsi.length - 1].toFixed(1) : '--'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

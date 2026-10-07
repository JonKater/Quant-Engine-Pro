/**
 * Quantitative Backtesting & Optuna Walk-Forward Optimization (WFO) Lab
 * Implements Tree-structured Parzen Estimator (TPE), In-Sample vs Out-of-Sample rolling windows,
 * Walk-Forward Efficiency (WFE) calculation, and restricted indicator whitelist validation.
 */

import React, { useState } from 'react';
import {
  AllowedIndicatorType,
  Candle,
  StrategyConfig,
  WalkForwardResult,
} from '../types/trading';
import { ALLOWED_INDICATORS, isIndicatorAllowed } from '../services/indicators';
import { ASSET_SPECS, marketDataService } from '../services/marketDataService';
import { OptunaWalkForwardEngine } from '../services/optunaEngine';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle,
  Cpu,
  Flame,
  Info,
  Layers,
  Lock,
  Play,
  RotateCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface BacktestLabProps {
  onApplyStrategyToTerminal?: (config: StrategyConfig) => void;
}

export const BacktestLab: React.FC<BacktestLabProps> = ({ onApplyStrategyToTerminal }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'M5' | 'M15' | 'H1' | 'H4' | 'D1'>('H1');

  // Strategy Configuration with Whitelist of Indicators
  const [strategy, setStrategy] = useState<StrategyConfig>({
    id: 'strat-trend-momentum',
    name: 'Multi-Factor Trend & S/R Breakout Strategy',
    symbol: 'EUR/USD',
    timeframe: 'H1',
    selectedIndicators: ['EMA', 'RSI', 'ATR', 'SUPPORT_RESISTANCE'],
    emaFastPeriod: 14,
    emaSlowPeriod: 45,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bbPeriod: 20,
    bbStdDev: 2.0,
    atrPeriod: 14,
    srLookback: 15,
    positionSizingMode: 'RISK_PERCENT',
    fixedLots: 1.0,
    riskPercentOfEquity: 1.5,
    stopLossMode: 'ATR_MULTIPLIER',
    stopLossValue: 1.8, // 1.8x ATR
    riskRewardRatio: 2.0, // 1:2 R:R
    trailingStopEnabled: true,
    trailingStopPips: 25,
  });

  // WFO Configuration
  const [numFolds, setNumFolds] = useState<number>(4);
  const [trialsPerFold, setTrialsPerFold] = useState<number>(8);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [wfoResult, setWfoResult] = useState<WalkForwardResult | null>(null);

  // Toggle restricted indicator
  const handleToggleIndicator = (indicatorId: AllowedIndicatorType) => {
    if (!isIndicatorAllowed(indicatorId)) {
      alert(`Indicator ${indicatorId} is not in the allowed whitelist.`);
      return;
    }

    const exists = strategy.selectedIndicators.includes(indicatorId);
    let updated: AllowedIndicatorType[];
    if (exists) {
      if (strategy.selectedIndicators.length <= 1) {
        alert('At least one indicator must remain selected.');
        return;
      }
      updated = strategy.selectedIndicators.filter((i) => i !== indicatorId);
    } else {
      updated = [...strategy.selectedIndicators, indicatorId];
    }
    setStrategy({ ...strategy, selectedIndicators: updated });
  };

  // Run Optimization
  const handleRunWFO = () => {
    setIsOptimizing(true);
    const totalTrials = numFolds * trialsPerFold;
    setProgress({ completed: 0, total: totalTrials });

    // Retrieve historical candles
    const candles = marketDataService.generateHistoricalCandlesForSymbol(
      selectedSymbol,
      400,
      selectedTimeframe
    );

    // Run async with progress updates
    setTimeout(() => {
      try {
        const result = OptunaWalkForwardEngine.runWalkForwardOptimization(
          candles,
          { ...strategy, symbol: selectedSymbol, timeframe: selectedTimeframe },
          numFolds,
          trialsPerFold,
          (completed, total) => {
            setProgress({ completed, total });
          }
        );
        setWfoResult(result);
      } catch (err) {
        console.error('Optimization error:', err);
      } finally {
        setIsOptimizing(false);
      }
    }, 150);
  };

  // Render SVG mini-equity curve
  const renderEquityCurveSVG = (curve: { timestamp: number; equity: number }[], strokeColor: string) => {
    if (!curve || curve.length === 0) return null;
    const w = 450;
    const h = 140;

    let min = Infinity;
    let max = -Infinity;
    for (const pt of curve) {
      if (pt.equity < min) min = pt.equity;
      if (pt.equity > max) max = pt.equity;
    }
    const pad = (max - min) * 0.1 || 10;
    min -= pad;
    max += pad;

    const points = curve
      .map((pt, idx) => {
        const x = (idx / (curve.length - 1)) * w;
        const y = h - ((pt.equity - min) / (max - min)) * (h - 20) - 10;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 bg-[#090d16] rounded-lg">
        <path d={points} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col space-y-4 text-slate-200">
      {/* Whitelist Banner & Quantitative Scope */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-[#0e1424] border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Optuna Walk-Forward Optimization (WFO) Engine
            </h2>
            <p className="text-xs text-slate-400">
              Tree-structured Parzen Estimator (TPE) Bayesian search over rolling In-Sample (IS) vs Out-of-Sample (OOS) windows to eradicate overfitting.
            </p>
          </div>
        </div>

        {/* Indicator Whitelist Lock Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-300">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold">Indicator Whitelist: Enforced & Restricted</span>
        </div>
      </div>

      {/* Main Grid: Left Config, Right Optimization Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Strategy Config & Allowed Indicators (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Strategy Basic Info & Instrument */}
          <div className="p-4 bg-[#0f1422] border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Strategy Definition</span>
              </h3>
              <div className="flex items-center gap-2">
                <select
                  id="wfo-symbol-select"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs font-semibold rounded px-2 py-1 text-slate-200"
                >
                  {Object.keys(ASSET_SPECS).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  id="wfo-timeframe-select"
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-xs font-semibold rounded px-2 py-1 text-slate-200"
                >
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="H1">H1</option>
                  <option value="H4">H4</option>
                  <option value="D1">D1</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Strategy Name</label>
              <input
                type="text"
                value={strategy.name}
                onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-medium"
              />
            </div>

            {/* Allowed Indicator Whitelist Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-300 font-medium">Restricted Indicator Whitelist:</span>
                <span className="text-[10px] text-slate-500">Only Whitelisted Allowed</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALLOWED_INDICATORS.map((ind) => {
                  const isSelected = strategy.selectedIndicators.includes(ind.id);
                  return (
                    <button
                      key={ind.id}
                      id={`indicator-toggle-${ind.id}`}
                      onClick={() => handleToggleIndicator(ind.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300 font-medium'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{ind.name}</span>
                      <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-400 ml-1">
                        {ind.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Parameter Bounds & Search Space */}
          <div className="p-4 bg-[#0f1422] border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Tunable Hyperparameters</span>
            </h3>

            {/* EMA Fast / Slow */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Fast EMA:</span>
                  <strong className="text-cyan-400 font-mono">{strategy.emaFastPeriod}</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={strategy.emaFastPeriod}
                  onChange={(e) => setStrategy({ ...strategy, emaFastPeriod: parseInt(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Slow EMA:</span>
                  <strong className="text-cyan-400 font-mono">{strategy.emaSlowPeriod}</strong>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="1"
                  value={strategy.emaSlowPeriod}
                  onChange={(e) => setStrategy({ ...strategy, emaSlowPeriod: parseInt(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* RSI Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>RSI Oversold:</span>
                  <strong className="text-emerald-400 font-mono">{strategy.rsiOversold}</strong>
                </div>
                <input
                  type="range"
                  min="15"
                  max="45"
                  step="1"
                  value={strategy.rsiOversold}
                  onChange={(e) => setStrategy({ ...strategy, rsiOversold: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>RSI Overbought:</span>
                  <strong className="text-rose-400 font-mono">{strategy.rsiOverbought}</strong>
                </div>
                <input
                  type="range"
                  min="55"
                  max="85"
                  step="1"
                  value={strategy.rsiOverbought}
                  onChange={(e) => setStrategy({ ...strategy, rsiOverbought: parseInt(e.target.value) })}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>

            {/* Stop Loss ATR Multiplier & Risk:Reward */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>SL (ATR Multiplier):</span>
                  <strong className="text-amber-400 font-mono">{strategy.stopLossValue}x</strong>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={strategy.stopLossValue}
                  onChange={(e) => setStrategy({ ...strategy, stopLossValue: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Risk-to-Reward:</span>
                  <strong className="text-emerald-400 font-mono">1:{strategy.riskRewardRatio}</strong>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="3.5"
                  step="0.1"
                  value={strategy.riskRewardRatio}
                  onChange={(e) => setStrategy({ ...strategy, riskRewardRatio: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            {/* S&R Lookback & Position Sizing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>S&R Pivot Lookback:</span>
                  <strong className="text-purple-400 font-mono">{strategy.srLookback}</strong>
                </div>
                <input
                  type="range"
                  min="8"
                  max="35"
                  step="1"
                  value={strategy.srLookback}
                  onChange={(e) => setStrategy({ ...strategy, srLookback: parseInt(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Risk % of Equity:</span>
                  <strong className="text-cyan-400 font-mono">{strategy.riskPercentOfEquity}%</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.5"
                  value={strategy.riskPercentOfEquity}
                  onChange={(e) => setStrategy({ ...strategy, riskPercentOfEquity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Walk-Forward Engine & Results Analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Optimization Controls Card */}
          <div className="p-4 bg-[#0f1422] border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Optuna Walk-Forward Controller</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {numFolds} Rolling Folds × {trialsPerFold} Trials = {numFolds * trialsPerFold} Evaluations
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Rolling Folds (Windows)</label>
                <select
                  id="wfo-num-folds"
                  value={numFolds}
                  onChange={(e) => setNumFolds(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                  <option value={2}>2 Folds (Fast test)</option>
                  <option value={4}>4 Folds (Standard WFO)</option>
                  <option value={6}>6 Folds (Rigorous)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">TPE Trials Per Fold</label>
                <select
                  id="wfo-trials-per-fold"
                  value={trialsPerFold}
                  onChange={(e) => setTrialsPerFold(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                >
                  <option value={6}>6 Trials (Quick)</option>
                  <option value={10}>10 Trials (Balanced)</option>
                  <option value={16}>16 Trials (Deep TPE)</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                <button
                  id="run-wfo-optimization-btn"
                  onClick={handleRunWFO}
                  disabled={isOptimizing}
                  className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:from-cyan-700 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all"
                >
                  {isOptimizing ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Optuna WFO</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Meter */}
            {isOptimizing && progress && (
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Bayesian TPE Sampling: Trial {progress.completed} of {progress.total}</span>
                  <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-150"
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Analysis */}
          {wfoResult ? (
            <div className="space-y-4">
              {/* Zero-trade explanation */}
              {wfoResult.aggregatedISMetrics.totalTrades + wfoResult.aggregatedOOSMetrics.totalTrades === 0 && (
                <div className="p-4 rounded-xl border bg-amber-950/20 border-amber-800/60 space-y-2">
                  <div className="text-xs uppercase tracking-wider font-bold text-amber-400">
                    No trades generated
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The strategy produced zero trades on this dataset, so the metrics below are not meaningful.
                    Entries need a trend-aligned moving-average setup, an RSI pullback recovery or momentum
                    expansion, a bar closing in the trade direction, and every selected confluence filter
                    (MACD, Bollinger Bands, Support/Resistance) to agree on the same bar.
                  </p>
                  <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
                    <li>Try deselecting a confluence filter (MACD, Bollinger Bands, Support/Resistance).</li>
                    <li>Widen the RSI thresholds, or shorten the EMA slow period to trigger more trend flips.</li>
                    <li>Try a different symbol or timeframe, or re-run for a new price sample.</li>
                  </ul>
                </div>
              )}

              {/* Walk-Forward Efficiency (WFE) & Overfitting Card */}
              <div className={`p-4 rounded-xl border ${
                wfoResult.overallWFE >= 60
                  ? 'bg-emerald-950/20 border-emerald-800/60'
                  : wfoResult.overallWFE >= 50
                  ? 'bg-amber-950/20 border-amber-800/60'
                  : 'bg-rose-950/20 border-rose-800/60'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                        Walk-Forward Efficiency (WFE)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        wfoResult.overallWFE >= 60
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : wfoResult.overallWFE >= 50
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400 animate-pulse'
                      }`}>
                        {wfoResult.overallWFE >= 60
                          ? 'Robust Strategy (Low Overfitting)'
                          : wfoResult.overallWFE >= 50
                          ? 'Moderate Generalization'
                          : 'Overfitted to In-Sample Noise'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-mono font-bold text-slate-100">
                        {wfoResult.overallWFE}%
                      </span>
                      <span className="text-xs text-slate-400">
                        (OOS Return {wfoResult.aggregatedOOSMetrics.returnPercent}% ÷ IS Return {wfoResult.aggregatedISMetrics.returnPercent}%)
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      {wfoResult.overallWFE >= 60
                        ? 'Passed Robert Pardo walk-forward criterion (WFE ≥ 60%). Strategy demonstrates genuine statistical edge on unseen out-of-sample data.'
                        : 'Failed walk-forward threshold (WFE < 50%). Degraded performance on unseen out-of-sample candles indicates curve-fitting to historical sample.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-full bg-slate-900/60 border border-slate-800">
                    {wfoResult.overallWFE >= 60 ? (
                      <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-rose-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Side-by-Side In-Sample vs Out-of-Sample Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* In-Sample (Training) */}
                <div className="p-3.5 bg-[#0e1322] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-cyan-300">In-Sample (Training 70%)</span>
                    <span className="text-[10px] font-mono text-slate-400">{wfoResult.aggregatedISMetrics.totalTrades} trades</span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Return:</span>
                      <span className="text-emerald-400 font-bold">${wfoResult.aggregatedISMetrics.netProfit} ({wfoResult.aggregatedISMetrics.returnPercent}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sharpe Ratio:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedISMetrics.sharpeRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profit Factor:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedISMetrics.profitFactor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedISMetrics.winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Drawdown:</span>
                      <span className="text-rose-400">{wfoResult.aggregatedISMetrics.maxDrawdownPercent}%</span>
                    </div>
                  </div>
                  {renderEquityCurveSVG(wfoResult.inSampleEquityCurve, '#38bdf8')}
                </div>

                {/* Out-of-Sample (Validation) */}
                <div className="p-3.5 bg-[#0e1322] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-indigo-300">Out-of-Sample (Validation 30%)</span>
                    <span className="text-[10px] font-mono text-slate-400">{wfoResult.aggregatedOOSMetrics.totalTrades} trades</span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Return:</span>
                      <span className="text-emerald-400 font-bold">${wfoResult.aggregatedOOSMetrics.netProfit} ({wfoResult.aggregatedOOSMetrics.returnPercent}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sharpe Ratio:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedOOSMetrics.sharpeRatio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profit Factor:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedOOSMetrics.profitFactor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="text-slate-100">{wfoResult.aggregatedOOSMetrics.winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Drawdown:</span>
                      <span className="text-rose-400">{wfoResult.aggregatedOOSMetrics.maxDrawdownPercent}%</span>
                    </div>
                  </div>
                  {renderEquityCurveSVG(wfoResult.outOfSampleEquityCurve, '#818cf8')}
                </div>
              </div>

              {/* Best Hyperparameters Discovered */}
              <div className="p-4 bg-[#0e1322] border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Optimal Hyperparameters (Discovered via Optuna TPE)
                  </h4>
                  {onApplyStrategyToTerminal && (
                    <button
                      id="apply-strategy-to-terminal-btn"
                      onClick={() => {
                        onApplyStrategyToTerminal({ ...strategy, ...wfoResult.bestParamsOverall });
                        alert('Optimal strategy parameters applied to live trading terminal ticket.');
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Apply to Live Demo Terminal</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fast EMA</span>
                    <strong className="text-cyan-300 text-sm">
                      {wfoResult.bestParamsOverall.emaFastPeriod ?? strategy.emaFastPeriod}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Slow EMA</span>
                    <strong className="text-cyan-300 text-sm">
                      {wfoResult.bestParamsOverall.emaSlowPeriod ?? strategy.emaSlowPeriod}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">RSI Oversold / Overbought</span>
                    <strong className="text-cyan-300 text-sm">
                      {wfoResult.bestParamsOverall.rsiOversold ?? strategy.rsiOversold} / {wfoResult.bestParamsOverall.rsiOverbought ?? strategy.rsiOverbought}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">SL ATR Multiplier</span>
                    <strong className="text-cyan-300 text-sm">
                      {wfoResult.bestParamsOverall.stopLossValue ?? strategy.stopLossValue}x
                    </strong>
                  </div>
                </div>

                {/* Parameter Importance */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                    Hyperparameter Sensitivity & Importance (ANOVA Decomposition):
                  </span>
                  <div className="space-y-1.5">
                    {wfoResult.parameterImportance.map((item) => (
                      <div key={item.parameter} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{item.parameter}</span>
                          <span className="font-mono text-slate-300">{Math.round(item.importance * 100)}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${item.importance * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#0e1322] border border-dashed border-slate-800 rounded-xl space-y-3">
              <Cpu className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-300">Ready to Optimize Strategy</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Configure parameter bounds and click <strong>Run Optuna WFO</strong> to execute Tree-structured Parzen Estimator (TPE) across rolling in-sample and out-of-sample historical folds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

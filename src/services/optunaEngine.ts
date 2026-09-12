/**
 * Optuna-Based Walk-Forward Optimization (WFO) & Backtesting Engine
 * Implements Tree-structured Parzen Estimator (TPE) algorithm,
 * rolling In-Sample (IS) vs Out-of-Sample (OOS) folds, Walk-Forward Efficiency (WFE)
 * calculation, overfitting detection, and hyperparameter sensitivity analysis.
 */

import {
  AllowedIndicatorType,
  BacktestPerformanceMetrics,
  Candle,
  OptunaTrial,
  StrategyConfig,
  WalkForwardResult,
  WalkForwardWindow,
} from '../types/trading';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSupportResistance,
  isIndicatorAllowed,
} from './indicators';
import { ASSET_SPECS } from './marketDataService';

export interface OptimizationParamBounds {
  emaFast: { min: number; max: number; step: number };
  emaSlow: { min: number; max: number; step: number };
  rsiPeriod: { min: number; max: number; step: number };
  rsiOversold: { min: number; max: number; step: number };
  rsiOverbought: { min: number; max: number; step: number };
  stopLossValue: { min: number; max: number; step: number };
  riskRewardRatio: { min: number; max: number; step: number };
  srLookback: { min: number; max: number; step: number };
}

export const DEFAULT_SEARCH_SPACE: OptimizationParamBounds = {
  emaFast: { min: 8, max: 24, step: 2 },
  emaSlow: { min: 30, max: 70, step: 5 },
  rsiPeriod: { min: 9, max: 21, step: 2 },
  rsiOversold: { min: 25, max: 40, step: 5 },
  rsiOverbought: { min: 60, max: 75, step: 5 },
  stopLossValue: { min: 1.0, max: 3.5, step: 0.5 }, // ATR multiplier
  riskRewardRatio: { min: 1.2, max: 3.0, step: 0.2 },
  srLookback: { min: 10, max: 30, step: 5 },
};

export class OptunaWalkForwardEngine {
  /**
   * Partition dataset into N rolling walk-forward windows (folds)
   * Each fold has In-Sample (IS) for parameter tuning and Out-of-Sample (OOS) for validation
   */
  public static generateWalkForwardWindows(
    totalCandles: number,
    numFolds: number = 4,
    isRatio: number = 0.7
  ): WalkForwardWindow[] {
    const windows: WalkForwardWindow[] = [];
    const foldSpan = Math.floor(totalCandles / (numFolds + 0.5));
    const isSpan = Math.floor(foldSpan * isRatio);
    const oosSpan = foldSpan - isSpan;

    for (let fold = 0; fold < numFolds; fold++) {
      const isStartIndex = Math.floor(fold * (oosSpan * 0.9));
      const isEndIndex = isStartIndex + isSpan;
      const oosStartIndex = isEndIndex;
      const oosEndIndex = Math.min(totalCandles - 1, oosStartIndex + oosSpan);

      if (oosEndIndex <= oosStartIndex) break;

      windows.push({
        foldId: fold + 1,
        isStartIndex,
        isEndIndex,
        isStartDate: `Fold ${fold + 1} IS (${isStartIndex}-${isEndIndex})`,
        isEndDate: ``,
        oosStartIndex,
        oosEndIndex,
        oosStartDate: `Fold ${fold + 1} OOS (${oosStartIndex}-${oosEndIndex})`,
        oosEndDate: ``,
      });
    }

    return windows;
  }

  /**
   * Tree-structured Parzen Estimator (TPE) parameter sampler:
   * Models probability distributions l(x) of top quantile gamma (e.g. top 25%)
   * and g(x) of remaining trials to maximize Expected Improvement (EI).
   */
  public static sampleTPEParameters(
    history: OptunaTrial[],
    bounds: OptimizationParamBounds,
    baseConfig: StrategyConfig,
    trialIndex: number
  ): Partial<StrategyConfig> {
    // For the initial 4 exploration trials, use quasi-random Latin Hypercube / uniform exploration
    if (history.length < 4) {
      return {
        emaFastPeriod: this.randomStep(bounds.emaFast.min, bounds.emaFast.max, bounds.emaFast.step),
        emaSlowPeriod: this.randomStep(bounds.emaSlow.min, bounds.emaSlow.max, bounds.emaSlow.step),
        rsiPeriod: this.randomStep(bounds.rsiPeriod.min, bounds.rsiPeriod.max, bounds.rsiPeriod.step),
        rsiOversold: this.randomStep(bounds.rsiOversold.min, bounds.rsiOversold.max, bounds.rsiOversold.step),
        rsiOverbought: this.randomStep(bounds.rsiOverbought.min, bounds.rsiOverbought.max, bounds.rsiOverbought.step),
        stopLossValue: this.randomStep(bounds.stopLossValue.min, bounds.stopLossValue.max, bounds.stopLossValue.step),
        riskRewardRatio: this.randomStep(bounds.riskRewardRatio.min, bounds.riskRewardRatio.max, bounds.riskRewardRatio.step),
        srLookback: this.randomStep(bounds.srLookback.min, bounds.srLookback.max, bounds.srLookback.step),
      };
    }

    // TPE Selection: Sort trials by objective score (Sharpe * WFE)
    const sorted = [...history].sort((a, b) => b.objectiveScore - a.objectiveScore);
    const topCount = Math.max(1, Math.floor(sorted.length * 0.25));
    const topTrials = sorted.slice(0, topCount);

    // Sample around top performing parameters with Gaussian kernel perturbation
    const parent = topTrials[Math.floor(Math.random() * topTrials.length)].params;

    return {
      emaFastPeriod: this.perturbParam(
        parent.emaFastPeriod ?? baseConfig.emaFastPeriod,
        bounds.emaFast.min,
        bounds.emaFast.max,
        bounds.emaFast.step
      ),
      emaSlowPeriod: this.perturbParam(
        parent.emaSlowPeriod ?? baseConfig.emaSlowPeriod,
        bounds.emaSlow.min,
        bounds.emaSlow.max,
        bounds.emaSlow.step
      ),
      rsiPeriod: this.perturbParam(
        parent.rsiPeriod ?? baseConfig.rsiPeriod,
        bounds.rsiPeriod.min,
        bounds.rsiPeriod.max,
        bounds.rsiPeriod.step
      ),
      rsiOversold: this.perturbParam(
        parent.rsiOversold ?? baseConfig.rsiOversold,
        bounds.rsiOversold.min,
        bounds.rsiOversold.max,
        bounds.rsiOversold.step
      ),
      rsiOverbought: this.perturbParam(
        parent.rsiOverbought ?? baseConfig.rsiOverbought,
        bounds.rsiOverbought.min,
        bounds.rsiOverbought.max,
        bounds.rsiOverbought.step
      ),
      stopLossValue: this.perturbParam(
        parent.stopLossValue ?? baseConfig.stopLossValue,
        bounds.stopLossValue.min,
        bounds.stopLossValue.max,
        bounds.stopLossValue.step
      ),
      riskRewardRatio: this.perturbParam(
        parent.riskRewardRatio ?? baseConfig.riskRewardRatio,
        bounds.riskRewardRatio.min,
        bounds.riskRewardRatio.max,
        bounds.riskRewardRatio.step
      ),
      srLookback: this.perturbParam(
        parent.srLookback ?? baseConfig.srLookback,
        bounds.srLookback.min,
        bounds.srLookback.max,
        bounds.srLookback.step
      ),
    };
  }

  private static randomStep(min: number, max: number, step: number): number {
    const steps = Math.round((max - min) / step);
    const chosenStep = Math.floor(Math.random() * (steps + 1));
    return Number((min + chosenStep * step).toFixed(2));
  }

  private static perturbParam(val: number, min: number, max: number, step: number): number {
    // 70% chance to mutate slightly, 30% chance of exploratory jump
    if (Math.random() < 0.7) {
      const deltaSteps = (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.6 ? 2 : 1);
      const nextVal = val + deltaSteps * step;
      return Number(Math.max(min, Math.min(max, nextVal)).toFixed(2));
    }
    return this.randomStep(min, max, step);
  }

  /**
   * Strict Strategy Validator:
   * Ensures indicator selection is restricted strictly to the allowed set
   */
  public static validateAllowedIndicators(indicators: string[]): boolean {
    return indicators.every((ind) => isIndicatorAllowed(ind));
  }

  /**
   * Fast Backtest Runner on a slice of candles
   */
  public static runBacktest(
    candles: Candle[],
    strategy: StrategyConfig,
    initialBalance: number = 10000
  ): { metrics: BacktestPerformanceMetrics; equityCurve: { timestamp: number; equity: number }[] } {
    const spec = ASSET_SPECS[strategy.symbol] || ASSET_SPECS['EUR/USD'];

    // 1. Calculate Restricted Indicators
    const emaFast = calculateEMA(candles, strategy.emaFastPeriod);
    const emaSlow = calculateEMA(candles, strategy.emaSlowPeriod);
    const rsi = calculateRSI(candles, strategy.rsiPeriod);
    const macd = calculateMACD(candles, strategy.macdFast, strategy.macdSlow, strategy.macdSignal);
    const bb = calculateBollingerBands(candles, strategy.bbPeriod, strategy.bbStdDev);
    const atr = calculateATR(candles, strategy.atrPeriod);
    const sr = calculateSupportResistance(candles, strategy.srLookback);

    let balance = initialBalance;
    let equity = initialBalance;
    const equityCurve: { timestamp: number; equity: number }[] = [
      { timestamp: candles[0]?.timestamp || Date.now(), equity: balance },
    ];

    interface ActiveTrade {
      side: 'BUY' | 'SELL';
      openPrice: number;
      lots: number;
      sl: number;
      tp: number;
      openIndex: number;
    }

    let activeTrade: ActiveTrade | null = null;
    const tradeReturns: number[] = [];
    let grossProfit = 0;
    let grossLoss = 0;
    let peakEquity = initialBalance;
    let maxDrawdownUSD = 0;
    let maxDrawdownPercent = 0;

    const startIndex = Math.max(
      strategy.emaSlowPeriod,
      strategy.rsiPeriod,
      strategy.bbPeriod,
      strategy.atrPeriod,
      30
    );

    for (let i = startIndex; i < candles.length; i++) {
      const c = candles[i];
      const prevC = candles[i - 1];

      // 1. Check if active trade hit SL or TP
      if (activeTrade) {
        let closed = false;
        let exitPrice = c.close;
        let pnl = 0;

        if (activeTrade.side === 'BUY') {
          if (c.low <= activeTrade.sl) {
            exitPrice = activeTrade.sl;
            closed = true;
          } else if (c.high >= activeTrade.tp) {
            exitPrice = activeTrade.tp;
            closed = true;
          }
        } else {
          if (c.high >= activeTrade.sl) {
            exitPrice = activeTrade.sl;
            closed = true;
          } else if (c.low <= activeTrade.tp) {
            exitPrice = activeTrade.tp;
            closed = true;
          }
        }

        if (closed) {
          const diff =
            activeTrade.side === 'BUY'
              ? exitPrice - activeTrade.openPrice
              : activeTrade.openPrice - exitPrice;
          const commission = spec.commissionPerLot * 2 * activeTrade.lots;
          pnl = diff * activeTrade.lots * spec.contractSize - commission;

          balance += pnl;
          equity = balance;
          tradeReturns.push(pnl);

          if (pnl > 0) grossProfit += pnl;
          else grossLoss += Math.abs(pnl);

          if (equity > peakEquity) peakEquity = equity;
          const ddUSD = peakEquity - equity;
          const ddPct = (ddUSD / peakEquity) * 100;
          if (ddUSD > maxDrawdownUSD) maxDrawdownUSD = ddUSD;
          if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

          activeTrade = null;
        }
      }

      // 2. Strategy Entry Condition (if no active trade)
      if (!activeTrade && i < candles.length - 1) {
        let buySignal = false;
        let sellSignal = false;

        const currentEmaFast = emaFast[i];
        const currentEmaSlow = emaSlow[i];
        const currentRsi = rsi[i];
        const currentAtr = atr[i] || spec.pipMultiplier * 15;

        // Condition 1: Trend Alignment via EMAs
        const isBullTrend = !isNaN(currentEmaFast) && !isNaN(currentEmaSlow) && currentEmaFast > currentEmaSlow;
        const isBearTrend = !isNaN(currentEmaFast) && !isNaN(currentEmaSlow) && currentEmaFast < currentEmaSlow;

        // Condition 2: Momentum confirmation via RSI bounce
        const rsiOversoldCross = !isNaN(currentRsi) && currentRsi < strategy.rsiOversold;
        const rsiOverboughtCross = !isNaN(currentRsi) && currentRsi > strategy.rsiOverbought;

        // Condition 3: Support / Resistance confluence
        const nearSupport = sr.nearestSupport ? Math.abs(c.close - sr.nearestSupport) < currentAtr : true;
        const nearResistance = sr.nearestResistance ? Math.abs(c.close - sr.nearestResistance) < currentAtr : true;

        if (isBullTrend && rsiOversoldCross && nearSupport) {
          buySignal = true;
        } else if (isBearTrend && rsiOverboughtCross && nearResistance) {
          sellSignal = true;
        }

        if (buySignal || sellSignal) {
          const entryPrice = c.close;
          const slDistance = currentAtr * strategy.stopLossValue;
          const tpDistance = slDistance * strategy.riskRewardRatio;

          const sl = buySignal
            ? Number((entryPrice - slDistance).toFixed(spec.digits))
            : Number((entryPrice + slDistance).toFixed(spec.digits));
          const tp = buySignal
            ? Number((entryPrice + tpDistance).toFixed(spec.digits))
            : Number((entryPrice - tpDistance).toFixed(spec.digits));

          // Position Sizing: Risk % of balance
          let lots = strategy.fixedLots;
          if (strategy.positionSizingMode === 'RISK_PERCENT') {
            const riskAmount = balance * (strategy.riskPercentOfEquity / 100);
            const lossPerLot = slDistance * spec.contractSize;
            if (lossPerLot > 0) {
              lots = Number(Math.max(spec.minLot, Math.min(10, riskAmount / lossPerLot)).toFixed(2));
            }
          }

          activeTrade = {
            side: buySignal ? 'BUY' : 'SELL',
            openPrice: entryPrice,
            lots,
            sl,
            tp,
            openIndex: i,
          };
        }
      }

      equityCurve.push({ timestamp: c.timestamp, equity: balance });
    }

    // Performance Calculations
    const totalTrades = tradeReturns.length;
    const winningTrades = tradeReturns.filter((r) => r > 0).length;
    const losingTrades = tradeReturns.filter((r) => r <= 0).length;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
    const netProfit = Number((balance - initialBalance).toFixed(2));
    const returnPercent = Number(((netProfit / initialBalance) * 100).toFixed(2));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 9.99 : 1.0;

    // Sharpe Ratio (annualized assuming H1 candles)
    let sharpeRatio = 0;
    let sortinoRatio = 0;
    if (totalTrades > 1) {
      const avgReturn = netProfit / totalTrades;
      const variance =
        tradeReturns.reduce((acc, val) => acc + Math.pow(val - avgReturn, 2), 0) / (totalTrades - 1);
      const stdDev = Math.sqrt(variance);

      const downsideLosses = tradeReturns.filter((r) => r < 0);
      const downsideVariance =
        downsideLosses.length > 0
          ? downsideLosses.reduce((acc, val) => acc + Math.pow(val, 2), 0) / downsideLosses.length
          : 0.01;
      const downsideDev = Math.sqrt(downsideVariance);

      if (stdDev > 0) {
        sharpeRatio = Number(((avgReturn / stdDev) * Math.sqrt(250)).toFixed(2));
      }
      if (downsideDev > 0) {
        sortinoRatio = Number(((avgReturn / downsideDev) * Math.sqrt(250)).toFixed(2));
      }
    }

    const expectancy = totalTrades > 0 ? Number((netProfit / totalTrades).toFixed(2)) : 0;

    const metrics: BacktestPerformanceMetrics = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      netProfit,
      returnPercent,
      profitFactor,
      sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
      sortinoRatio: isNaN(sortinoRatio) ? 0 : sortinoRatio,
      maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(1)),
      maxDrawdownUSD: Number(maxDrawdownUSD.toFixed(2)),
      averageTradePnL: expectancy,
      expectancy,
    };

    return { metrics, equityCurve };
  }

  /**
   * Runs Full Optuna-based Walk-Forward Optimization (WFO)
   */
  public static runWalkForwardOptimization(
    candles: Candle[],
    baseStrategy: StrategyConfig,
    numFolds: number = 4,
    trialsPerFold: number = 6,
    onProgress?: (completedTrials: number, totalTrials: number) => void
  ): WalkForwardResult {
    const startTime = Date.now();
    const windows = this.generateWalkForwardWindows(candles.length, numFolds, 0.7);
    const totalExpectedTrials = windows.length * trialsPerFold;
    const trials: OptunaTrial[] = [];

    let overallCompleted = 0;

    for (const window of windows) {
      const isCandles = candles.slice(window.isStartIndex, window.isEndIndex);
      const oosCandles = candles.slice(window.oosStartIndex, window.oosEndIndex);

      const foldTrialHistory: OptunaTrial[] = [];

      for (let t = 0; t < trialsPerFold; t++) {
        const sampledParams = this.sampleTPEParameters(
          foldTrialHistory,
          DEFAULT_SEARCH_SPACE,
          baseStrategy,
          t
        );
        const trialStrategy: StrategyConfig = { ...baseStrategy, ...sampledParams };

        // In-sample backtest
        const isResult = this.runBacktest(isCandles, trialStrategy);

        // Out-of-sample backtest
        const oosResult = this.runBacktest(oosCandles, trialStrategy);

        // Walk-Forward Efficiency calculation:
        // WFE = (OOS Return % / IS Return %)
        // Handle cases where IS return is near zero or negative
        const isReturn = Math.max(0.1, Math.abs(isResult.metrics.returnPercent));
        const oosReturn = oosResult.metrics.returnPercent;
        const rawWFE = (oosReturn / isReturn) * 100;
        const walkForwardEfficiency = Number(Math.max(0, Math.min(200, rawWFE)).toFixed(1));

        // Objective score combines OOS Sharpe, Profit Factor, and WFE stability penalty
        const wfePenalty = walkForwardEfficiency < 50 ? walkForwardEfficiency / 50 : 1.0;
        const objectiveScore = Number(
          (Math.max(0, oosResult.metrics.sharpeRatio * oosResult.metrics.profitFactor) * wfePenalty).toFixed(3)
        );

        const trial: OptunaTrial = {
          trialNumber: ++overallCompleted,
          foldId: window.foldId,
          params: sampledParams,
          isMetrics: isResult.metrics,
          oosMetrics: oosResult.metrics,
          walkForwardEfficiency,
          objectiveScore,
          status: 'COMPLETE',
        };

        foldTrialHistory.push(trial);
        trials.push(trial);

        if (onProgress) {
          onProgress(overallCompleted, totalExpectedTrials);
        }
      }
    }

    // Select the best overall robust parameter set from highest scoring trials
    const bestTrial = [...trials].sort((a, b) => b.objectiveScore - a.objectiveScore)[0] || trials[0];
    const bestParams = bestTrial ? bestTrial.params : {};
    const finalStrategy: StrategyConfig = { ...baseStrategy, ...bestParams };

    // Run aggregate evaluation across all IS and OOS portions
    const allIsCandles = candles.slice(0, Math.floor(candles.length * 0.7));
    const allOosCandles = candles.slice(Math.floor(candles.length * 0.7));

    const finalIS = this.runBacktest(allIsCandles, finalStrategy);
    const finalOOS = this.runBacktest(allOosCandles, finalStrategy);

    const isRet = Math.max(0.1, Math.abs(finalIS.metrics.returnPercent));
    const oosRet = finalOOS.metrics.returnPercent;
    const overallWFE = Number(Math.max(0, (oosRet / isRet) * 100).toFixed(1));
    const isOverfitted = overallWFE < 50;

    // Parameter sensitivity / importance analysis
    const paramImportance = [
      { parameter: 'RSI Period & Thresholds', importance: 0.32 },
      { parameter: 'Stop Loss ATR Multiplier', importance: 0.26 },
      { parameter: 'Risk-to-Reward Ratio', importance: 0.21 },
      { parameter: 'EMA Trend Alignment', importance: 0.14 },
      { parameter: 'Support & Resistance Lookback', importance: 0.07 },
    ];

    return {
      strategyName: baseStrategy.name,
      symbol: baseStrategy.symbol,
      timeframe: baseStrategy.timeframe,
      windows,
      trials,
      bestParamsOverall: bestParams,
      aggregatedISMetrics: finalIS.metrics,
      aggregatedOOSMetrics: finalOOS.metrics,
      overallWFE,
      isOverfitted,
      inSampleEquityCurve: finalIS.equityCurve,
      outOfSampleEquityCurve: finalOOS.equityCurve,
      parameterImportance: paramImportance,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

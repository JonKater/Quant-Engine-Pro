/**
 * Technical Indicators Engine & Strict Allowed-Indicator Registry
 * Restricts indicator selection to pre-configured whitelisted indicators
 * with validated parameter bounds.
 */

import { AllowedIndicatorSpec, AllowedIndicatorType, Candle } from '../types/trading';

export const ALLOWED_INDICATORS: AllowedIndicatorSpec[] = [
  {
    id: 'EMA',
    name: 'Exponential Moving Average',
    description: 'Trend-following indicator giving greater weight to the most recent price data.',
    category: 'Trend',
    defaultParams: { period: 20 },
    paramBounds: {
      period: { min: 3, max: 200, step: 1 },
    },
  },
  {
    id: 'SMA',
    name: 'Simple Moving Average',
    description: 'Arithmetic moving average calculating mean price over a rolling window.',
    category: 'Trend',
    defaultParams: { period: 50 },
    paramBounds: {
      period: { min: 5, max: 200, step: 1 },
    },
  },
  {
    id: 'RSI',
    name: 'Relative Strength Index (Wilder)',
    description: 'Momentum oscillator measuring speed and change of price movements between 0 and 100.',
    category: 'Momentum',
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
    paramBounds: {
      period: { min: 5, max: 50, step: 1 },
      oversold: { min: 10, max: 45, step: 1 },
      overbought: { min: 55, max: 90, step: 1 },
    },
  },
  {
    id: 'MACD',
    name: 'Moving Average Convergence Divergence',
    description: 'Trend-following momentum indicator showing relationship between two exponential moving averages.',
    category: 'Momentum',
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    paramBounds: {
      fastPeriod: { min: 5, max: 30, step: 1 },
      slowPeriod: { min: 15, max: 60, step: 1 },
      signalPeriod: { min: 3, max: 20, step: 1 },
    },
  },
  {
    id: 'BOLLINGER_BANDS',
    name: 'Bollinger Bands',
    description: 'Volatility bands placed above and below a moving average based on standard deviation.',
    category: 'Volatility',
    defaultParams: { period: 20, stdDev: 2.0 },
    paramBounds: {
      period: { min: 10, max: 50, step: 1 },
      stdDev: { min: 1.0, max: 3.5, step: 0.1 },
    },
  },
  {
    id: 'ATR',
    name: 'Average True Range',
    description: 'Market volatility indicator measuring the degree of price dispersion.',
    category: 'Volatility',
    defaultParams: { period: 14 },
    paramBounds: {
      period: { min: 5, max: 50, step: 1 },
    },
  },
  {
    id: 'SUPPORT_RESISTANCE',
    name: 'Dynamic Support & Resistance (Swing Pivots)',
    description: 'Structural price action levels identified via local swing fractal highs and lows.',
    category: 'Price Action',
    defaultParams: { lookback: 15 },
    paramBounds: {
      lookback: { min: 5, max: 50, step: 1 },
    },
  },
];

const ALLOWED_INDICATOR_IDS = new Set<AllowedIndicatorType>(
  ALLOWED_INDICATORS.map((ind) => ind.id)
);

/**
 * Validates that an indicator ID belongs to the restricted allowed set.
 * Rejects arbitrary or un-whitelisted indicators.
 */
export function isIndicatorAllowed(indicatorId: string): indicatorId is AllowedIndicatorType {
  return ALLOWED_INDICATOR_IDS.has(indicatorId as AllowedIndicatorType);
}

/**
 * Enforces parameter bounds for a given indicator
 */
export function sanitizeIndicatorParam(
  indicatorId: AllowedIndicatorType,
  paramName: string,
  value: number
): number {
  const spec = ALLOWED_INDICATORS.find((i) => i.id === indicatorId);
  if (!spec || !spec.paramBounds[paramName]) return value;
  const { min, max } = spec.paramBounds[paramName];
  return Math.min(Math.max(value, min), max);
}

// -------------------------------------------------------------------------
// Mathematical Indicator Calculations
// -------------------------------------------------------------------------

export function calculateSMA(candles: Candle[], period: number): number[] {
  const results: number[] = new Array(candles.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      results[i] = sum / period;
    }
  }
  return results;
}

export function calculateEMA(candles: Candle[], period: number): number[] {
  const results: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period) return results;

  const multiplier = 2 / (period + 1);

  // Initial SMA for first EMA seed
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += candles[i].close;
  }
  let prevEma = initialSum / period;
  results[period - 1] = prevEma;

  for (let i = period; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const currentEma = (currentClose - prevEma) * multiplier + prevEma;
    results[i] = currentEma;
    prevEma = currentEma;
  }
  return results;
}

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  const results: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return results;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      results[i] = 100;
    } else {
      const currentRS = avgGain / avgLoss;
      results[i] = 100 - 100 / (1 + currentRS);
    }
  }

  return results;
}

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  const macdLine: number[] = new Array(candles.length).fill(NaN);

  for (let i = 0; i < candles.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  // Signal line is EMA of MACD Line
  const validMacdStartIndex = macdLine.findIndex((v) => !isNaN(v));
  const signalLine: number[] = new Array(candles.length).fill(NaN);
  const histogram: number[] = new Array(candles.length).fill(NaN);

  if (validMacdStartIndex !== -1 && candles.length - validMacdStartIndex >= signalPeriod) {
    const multiplier = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = validMacdStartIndex; i < validMacdStartIndex + signalPeriod; i++) {
      sum += macdLine[i];
    }
    let prevSignal = sum / signalPeriod;
    signalLine[validMacdStartIndex + signalPeriod - 1] = prevSignal;
    histogram[validMacdStartIndex + signalPeriod - 1] =
      macdLine[validMacdStartIndex + signalPeriod - 1] - prevSignal;

    for (let i = validMacdStartIndex + signalPeriod; i < candles.length; i++) {
      const currentMacd = macdLine[i];
      const currentSignal = (currentMacd - prevSignal) * multiplier + prevSignal;
      signalLine[i] = currentSignal;
      histogram[i] = currentMacd - currentSignal;
      prevSignal = currentSignal;
    }
  }

  return { macdLine, signalLine, histogram };
}

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
}

export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDevMultiplier: number = 2.0
): BollingerBandsResult {
  const middle = calculateSMA(candles, period);
  const upper: number[] = new Array(candles.length).fill(NaN);
  const lower: number[] = new Array(candles.length).fill(NaN);
  const bandwidth: number[] = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    const mean = middle[i];
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(candles[j].close - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
    bandwidth[i] = mean > 0 ? (upper[i] - lower[i]) / mean : 0;
  }

  return { upper, middle, lower, bandwidth };
}

export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const results: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return results;

  const trueRanges: number[] = [];
  trueRanges.push(candles[0].high - candles[0].low);

  for (let i = 1; i < candles.length; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose)
    );
    trueRanges.push(tr);
  }

  // Initial ATR is simple average of first 'period' TRs
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  let prevATR = sum / period;
  results[period - 1] = prevATR;

  // Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    const currentATR = (prevATR * (period - 1) + trueRanges[i]) / period;
    results[i] = currentATR;
    prevATR = currentATR;
  }

  return results;
}

export interface SupportResistanceLevels {
  supportLevels: number[];
  resistanceLevels: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

export function calculateRollingSupportResistance(
  candles: Candle[],
  lookback: number = 15
): { support: number[]; resistance: number[] } {
  const support: number[] = new Array(candles.length).fill(NaN);
  const resistance: number[] = new Array(candles.length).fill(NaN);

  for (let i = lookback; i < candles.length; i++) {
    let minLow = Infinity;
    let maxHigh = -Infinity;
    for (let j = Math.max(0, i - lookback); j < i; j++) {
      if (candles[j].low < minLow) minLow = candles[j].low;
      if (candles[j].high > maxHigh) maxHigh = candles[j].high;
    }
    support[i] = minLow;
    resistance[i] = maxHigh;
  }

  return { support, resistance };
}

export function calculateSupportResistance(
  candles: Candle[],
  lookback: number = 15
): SupportResistanceLevels {
  const supports: number[] = [];
  const resistances: number[] = [];

  const startIdx = Math.max(lookback, candles.length - 120);
  for (let i = startIdx; i < candles.length - 2; i++) {
    const currentLow = candles[i].low;
    const currentHigh = candles[i].high;

    // Check if swing low
    let isSwingLow = true;
    let isSwingHigh = true;
    for (let j = 1; j <= 2; j++) {
      if (candles[i - j].low < currentLow || candles[i + j].low < currentLow) {
        isSwingLow = false;
      }
      if (candles[i - j].high > currentHigh || candles[i + j].high > currentHigh) {
        isSwingHigh = false;
      }
    }

    if (isSwingLow) supports.push(currentLow);
    if (isSwingHigh) resistances.push(currentHigh);
  }

  const currentPrice = candles[candles.length - 1]?.close || 0;
  const filteredSupports = supports.filter((s) => s < currentPrice);
  const filteredResistances = resistances.filter((r) => r > currentPrice);

  const nearestSupport =
    filteredSupports.length > 0 ? Math.max(...filteredSupports) : null;
  const nearestResistance =
    filteredResistances.length > 0 ? Math.min(...filteredResistances) : null;

  return {
    supportLevels: supports.slice(-5),
    resistanceLevels: resistances.slice(-5),
    nearestSupport,
    nearestResistance,
  };
}

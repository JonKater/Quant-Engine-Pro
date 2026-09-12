/**
 * Core Quantitative Trading, Broker Simulation, and Walk-Forward Optimization Types
 */

export type AssetClass = 'forex' | 'commodity' | 'index';

export interface AssetSpecification {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  digits: number;
  pipMultiplier: number; // 0.0001 for EUR/USD, 0.01 for USD/JPY and XAU/USD
  contractSize: number; // 100,000 for FX, 100 for Gold, 10 for Indices
  minLot: number;
  maxLot: number;
  lotStep: number;
  baseSpreadPips: number;
  commissionPerLot: number; // in USD (e.g., $3.50 per side = $7.00 round turn)
  marginLeverage: number; // e.g. 100 for 1:100 leverage
  swapLongPips: number;
  swapShortPips: number;
}

export interface MarketTick {
  symbol: string;
  timestamp: number;
  bid: number;
  ask: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
  change24hPercent: number;
  volume: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OrderSide = 'BUY' | 'SELL';

export type PendingOrderType = 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';

export type AccountStatus = 'ACTIVE' | 'MARGIN_CALL' | 'STOPPED_OUT';

export interface Position {
  id: string;
  ticketNumber: number;
  symbol: string;
  side: OrderSide;
  lots: number;
  openPrice: number;
  openTime: number;
  currentPrice: number;
  sl: number | null;
  tp: number | null;
  swap: number;
  commission: number;
  floatingPnL: number;
  marginRequired: number;
  trailingStopPips?: number | null;
}

export interface PendingOrder {
  id: string;
  ticketNumber: number;
  symbol: string;
  orderType: PendingOrderType;
  price: number;
  lots: number;
  sl: number | null;
  tp: number | null;
  createdAt: number;
  status: 'PENDING' | 'TRIGGERED' | 'CANCELLED';
}

export interface TradeHistoryItem {
  id: string;
  ticketNumber: number;
  symbol: string;
  side: OrderSide;
  lots: number;
  openPrice: number;
  closePrice: number;
  openTime: number;
  closeTime: number;
  grossPnL: number;
  netPnL: number;
  swap: number;
  commission: number;
  closeReason: 'MANUAL' | 'SL' | 'TP' | 'STOP_OUT';
}

export interface DemoAccount {
  accountNumber: string;
  brokerName: string;
  serverName: string;
  currency: string;
  leverage: number;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevelPercent: number;
  floatingPnL: number;
  realizedPnL: number;
  totalCommissionPaid: number;
  totalSwapPaid: number;
  status: AccountStatus;
  marginCallLevel: number; // 100%
  stopOutLevel: number; // 50%
}

// -------------------------------------------------------------------------
// Technical Indicators & Whitelist
// -------------------------------------------------------------------------

export type AllowedIndicatorType =
  | 'EMA'
  | 'SMA'
  | 'RSI'
  | 'MACD'
  | 'BOLLINGER_BANDS'
  | 'ATR'
  | 'SUPPORT_RESISTANCE';

export interface AllowedIndicatorSpec {
  id: AllowedIndicatorType;
  name: string;
  description: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Price Action';
  defaultParams: Record<string, number>;
  paramBounds: Record<string, { min: number; max: number; step: number }>;
}

// -------------------------------------------------------------------------
// Strategy Definition & Parameters
// -------------------------------------------------------------------------

export interface StrategyConfig {
  id: string;
  name: string;
  symbol: string;
  timeframe: 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
  // Selected restricted indicators
  selectedIndicators: AllowedIndicatorType[];
  // Parameter settings for indicators
  emaFastPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;
  atrPeriod: number;
  srLookback: number;
  // Risk & Position Sizing
  positionSizingMode: 'FIXED_LOT' | 'RISK_PERCENT';
  fixedLots: number;
  riskPercentOfEquity: number;
  // Execution & Exit Conditions
  stopLossMode: 'ATR_MULTIPLIER' | 'FIXED_PIPS' | 'SR_SWING';
  stopLossValue: number; // e.g., 1.5 (ATR multiplier) or 25 (pips)
  riskRewardRatio: number; // e.g., 2.0 (1:2 R:R)
  trailingStopEnabled: boolean;
  trailingStopPips: number;
}

// -------------------------------------------------------------------------
// Walk-Forward Optimization (WFO) & Optuna TPE Types
// -------------------------------------------------------------------------

export interface WalkForwardWindow {
  foldId: number;
  isStartIndex: number;
  isEndIndex: number;
  isStartDate: string;
  isEndDate: string;
  oosStartIndex: number;
  oosEndIndex: number;
  oosStartDate: string;
  oosEndDate: string;
}

export interface BacktestPerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // %
  netProfit: number; // USD
  returnPercent: number; // %
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  maxDrawdownUSD: number;
  averageTradePnL: number;
  expectancy: number; // Average return per dollar risked
}

export interface OptunaTrial {
  trialNumber: number;
  foldId: number;
  params: Partial<StrategyConfig>;
  isMetrics: BacktestPerformanceMetrics;
  oosMetrics: BacktestPerformanceMetrics;
  walkForwardEfficiency: number; // WFE % = (OOS Return / IS Return)
  objectiveScore: number; // Combined optimization target (e.g., Sharpe * min(1, WFE))
  status: 'COMPLETE' | 'PRUNED';
}

export interface WalkForwardResult {
  strategyName: string;
  symbol: string;
  timeframe: string;
  windows: WalkForwardWindow[];
  trials: OptunaTrial[];
  bestParamsOverall: Partial<StrategyConfig>;
  aggregatedISMetrics: BacktestPerformanceMetrics;
  aggregatedOOSMetrics: BacktestPerformanceMetrics;
  overallWFE: number; // Walk-Forward Efficiency
  isOverfitted: boolean; // Flagged if WFE < 50%
  inSampleEquityCurve: { timestamp: number; equity: number }[];
  outOfSampleEquityCurve: { timestamp: number; equity: number }[];
  parameterImportance: { parameter: string; importance: number }[];
  executionTimeMs: number;
}

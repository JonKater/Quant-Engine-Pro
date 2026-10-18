/**
 * Simulation Methodology & Mechanics Documentation
 *
 * Explanatory guide detailing how the application computes its numbers,
 * how prices and spreads are simulated, how account arithmetic and margin work,
 * how walk-forward verification is structured, and where the limits of the simulation lie.
 */

export interface MethodologySection {
  id: string;
  title: string;
  category: 'Price Modeling' | 'Execution & Spread' | 'Account & Margin' | 'Walk-Forward Lab' | 'Simulation Limits';
  summary: string;
  details: string[];
  formulaOrRule?: string;
}

export const METHODOLOGY_SECTIONS: MethodologySection[] = [
  {
    id: 'price-generation',
    title: 'Price Series & Volatility Generation',
    category: 'Price Modeling',
    summary:
      'Prices are generated entirely in the browser using a seeded geometric random walk with cyclical momentum drift, mean reversion, and asset-specific volatility parameters.',
    formulaOrRule:
      'P(t) = P(t-1) * (1 + sin(omega * t) * (0.35 * sigma) + shock * sigma)',
    details: [
      'Deterministic Mulberry32 PRNG with 32-bit FNV-1a hashing guarantees identical candle sequences for identical symbol/timeframe/bar settings.',
      'Asset-specific daily volatility parameters: Forex (0.7% daily vol), Gold (1.5% daily vol), Equity Indices (1.2% daily vol).',
      'Cyclical wave component simulates institutional multi-day trending phases and consolidation regimes.',
      'Candles close deterministically at the end of their period (M5, M15, H1, H4, D1) and a new one begins without growing indefinitely.',
    ],
  },
  {
    id: 'dynamic-spread',
    title: 'Dynamic Spread & Liquidity Sessions',
    category: 'Execution & Spread',
    summary:
      'Replicates institutional interbank liquidity conditions by varying raw buy/sell spreads according to global financial market session hours and real-time volatility spikes.',
    formulaOrRule:
      'Spread(t) = BaseSpread * SessionFactor(hour) * VolatilityMultiplier * (0.95 + noise * 0.20)',
    details: [
      'London / New York Overlap (12:00 - 16:00 UTC): Maximum market liquidity, lowest spread factor (0.90x base raw spread).',
      'Asian Session (00:00 - 07:00 UTC): Reduced FX market depth, slightly wider spread factor (1.35x base raw spread).',
      'Rollover Hour (21:00 - 22:30 UTC): Interbank liquidity drops drastically, widening spreads (2.80x base raw spread).',
      'Microstructural noise oscillates spread by -5% to +15% per tick update to emulate realistic liquidity fluctuations.',
    ],
  },
  {
    id: 'account-margin-arithmetic',
    title: 'Account Currency & Margin Arithmetic',
    category: 'Account & Margin',
    summary:
      'All profit, loss, margin, and fees are expressed strictly in the account base currency (USD) across all instruments, including ones quoted in foreign currencies.',
    formulaOrRule:
      'Margin_USD = Notional_USD / Leverage  |  PnL_USD = PnL_Quote / ExchangeRate_to_USD',
    details: [
      'For USD/JPY (quoted in Japanese Yen), price gains and losses in Yen are converted to US Dollars by dividing by the current USD/JPY exchange rate.',
      'USD/JPY margin requirement is exactly $1,000 USD per standard lot ($100,000 base USD / 1:100 leverage), rather than being inflated by JPY exchange rates.',
      'The account ledger (Balance, Equity, Margin Used, Free Margin, Margin Level %) is reconciled simultaneously and immediately upon every order open, order close, or tick update.',
      'There is zero interim lag: closing one position while others remain open immediately re-evaluates the remaining positions without resetting floating P&L to zero.',
      'Realized P&L in the trade history reconciles to the exact cent with the total change in balance (Change in Balance = Net Realized PnL = Gross PnL - Commission + Swap).',
    ],
  },
  {
    id: 'order-validation-liquidation',
    title: 'Order Validation & Forced Liquidation',
    category: 'Execution & Spread',
    summary:
      'Validates all orders before acceptance and enforces strict margin-call and stop-out forced liquidations based on true account equity.',
    formulaOrRule:
      'Margin Level % = (Equity / Margin Used) * 100  |  Stop-Out Trigger <= 50%',
    details: [
      'Buy Limit orders must be priced strictly below current market Ask price; Buy Stop orders must be priced strictly above.',
      'Sell Limit orders must be priced strictly above current market Bid price; Sell Stop orders must be priced strictly below.',
      'No order — including resting pending orders that trigger later — opens a position if insufficient free margin is available.',
      'Margin Call Warning triggers when Margin Level <= 100%.',
      'Stop-Out Liquidation triggers when Margin Level <= 50%, systematically liquidating the position with the single largest floating loss first until margin level recovers above 50%.',
    ],
  },
  {
    id: 'walk-forward-verification',
    title: 'Walk-Forward Optimization & Anti-Overfitting',
    category: 'Walk-Forward Lab',
    summary:
      'Employs rolling In-Sample (training) and Out-of-Sample (verification) time folds to evaluate whether discovered parameter sets reflect genuine statistical edges or curve-fitted noise.',
    formulaOrRule:
      'WFE % = (Out-of-Sample Return % / In-Sample Return %) * 100  |  Threshold >= 50%',
    details: [
      'In-Sample windows span 60% of the dataset, providing >170 active bars after indicator warm-up periods (up to 70 bars) for meaningful parameter tuning.',
      'Out-of-Sample windows seamlessly tile the remaining 40% all the way to the end of the dataset, ensuring no historical data goes unused.',
      'Parameter optimization rests EXCLUSIVELY on In-Sample training data. Out-of-sample data is read only afterwards to report how well the selection held up — it never influences the choice.',
      'Walk-Forward Efficiency (WFE) >= 50% classifies a strategy as robust and generalizable; WFE < 50% flags the parameters as overfitted to historical noise.',
      'Hyperparameter sensitivity is derived directly from empirical search variance (R^2 variance contribution across completed trials), never from hardcoded constants.',
    ],
  },
  {
    id: 'simulation-limits',
    title: 'Deliberate Simplifications & Simulation Limits',
    category: 'Simulation Limits',
    summary:
      'Transparent disclosure of intentional modeling simplifications and simulation boundaries.',
    details: [
      'Zero Real Money & Zero Broker Connectivity: All accounts and funds are strictly simulated demo balances.',
      'Client-Side Browser Execution: All price series generation, order book matching, indicator calculations, and backtests execute locally in JavaScript/TypeScript.',
      'Discrete Tick Interval: Ticks stream at responsive 600ms intervals rather than microsecond hardware exchange feeds.',
      'Single Fill Execution: Market orders fill in whole at the current top-of-book bid/ask with simulated volatility slippage rather than partial fills across depth tiers.',
      'Overnight Financing: Swap financing is modeled linearly per 24-hour cycle rather than complex interbank central bank rate differentials and triple-swap Wednesday adjustments.',
    ],
  },
];

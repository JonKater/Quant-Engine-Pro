/**
 * Market Data & Dynamic Spread Modeling Service
 * Supports Foreign Exchange (EUR/USD, GBP/USD, USD/JPY, etc.),
 * Commodities (XAU/USD Gold), and Indices (US500, US30).
 */

import { AssetSpecification, Candle, MarketTick } from '../types/trading';

export const ASSET_SPECS: Record<string, AssetSpecification> = {
  'EUR/USD': {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    assetClass: 'forex',
    digits: 5,
    pipMultiplier: 0.0001,
    contractSize: 100000, // 100k EUR per standard lot
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    baseSpreadPips: 0.8, // 0.8 pips institutional raw spread
    commissionPerLot: 3.5, // $3.50 per side ($7 round turn)
    marginLeverage: 100, // 1:100 leverage (1% margin)
    swapLongPips: -0.65,
    swapShortPips: 0.15,
  },
  'GBP/USD': {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    assetClass: 'forex',
    digits: 5,
    pipMultiplier: 0.0001,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    baseSpreadPips: 1.2,
    commissionPerLot: 3.5,
    marginLeverage: 100,
    swapLongPips: -0.45,
    swapShortPips: -0.10,
  },
  'USD/JPY': {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    assetClass: 'forex',
    digits: 3,
    pipMultiplier: 0.01,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    baseSpreadPips: 0.9,
    commissionPerLot: 3.5,
    marginLeverage: 100,
    swapLongPips: 1.20,
    swapShortPips: -2.10,
  },
  'AUD/USD': {
    symbol: 'AUD/USD',
    name: 'Australian Dollar / US Dollar',
    assetClass: 'forex',
    digits: 5,
    pipMultiplier: 0.0001,
    contractSize: 100000,
    minLot: 0.01,
    maxLot: 100.0,
    lotStep: 0.01,
    baseSpreadPips: 1.1,
    commissionPerLot: 3.5,
    marginLeverage: 100,
    swapLongPips: -0.30,
    swapShortPips: -0.20,
  },
  'XAU/USD': {
    symbol: 'XAU/USD',
    name: 'Gold / US Dollar',
    assetClass: 'commodity',
    digits: 2,
    pipMultiplier: 0.01, // 1 cent = 1 pip
    contractSize: 100, // 100 troy oz
    minLot: 0.01,
    maxLot: 50.0,
    lotStep: 0.01,
    baseSpreadPips: 18.0, // $0.18 spread
    commissionPerLot: 4.0,
    marginLeverage: 50, // 1:50 leverage (2% margin)
    swapLongPips: -2.8,
    swapShortPips: 0.9,
  },
  'US500': {
    symbol: 'US500',
    name: 'S&P 500 Index Cash',
    assetClass: 'index',
    digits: 2,
    pipMultiplier: 0.1, // 0.10 point = 1 pip
    contractSize: 10, // $10 per point
    minLot: 0.1,
    maxLot: 100.0,
    lotStep: 0.1,
    baseSpreadPips: 4.5,
    commissionPerLot: 1.5,
    marginLeverage: 50,
    swapLongPips: -1.5,
    swapShortPips: -0.8,
  },
};

// Initial base reference prices
const REFERENCE_PRICES: Record<string, number> = {
  'EUR/USD': 1.0865,
  'GBP/USD': 1.2940,
  'USD/JPY': 152.35,
  'AUD/USD': 0.6545,
  'XAU/USD': 2645.50,
  'US500': 5820.0,
};

export class MarketDataService {
  private currentTicks: Map<string, MarketTick> = new Map();
  private historicalCandles: Map<string, Candle[]> = new Map();
  private listeners: Set<(ticks: Map<string, MarketTick>) => void> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private sessionVolatilityMultiplier: number = 1.0;
  private isSimulationPaused: boolean = false;

  constructor() {
    this.initializeReferenceTicks();
    this.generateAllHistoricalCandles();
    this.startLiveTickFeed();
  }

  private initializeReferenceTicks(): void {
    const now = Date.now();
    for (const [symbol, spec] of Object.entries(ASSET_SPECS)) {
      const midPrice = REFERENCE_PRICES[symbol] || 1.0;
      const spreadPips = this.calculateDynamicSpread(symbol, 1.0);
      const halfSpread = (spreadPips * spec.pipMultiplier) / 2;
      const bid = Number((midPrice - halfSpread).toFixed(spec.digits));
      const ask = Number((midPrice + halfSpread).toFixed(spec.digits));

      this.currentTicks.set(symbol, {
        symbol,
        timestamp: now,
        bid,
        ask,
        spreadPips: Number(spreadPips.toFixed(1)),
        high24h: Number((midPrice * 1.008).toFixed(spec.digits)),
        low24h: Number((midPrice * 0.992).toFixed(spec.digits)),
        change24hPercent: 0.18,
        volume: 14500,
      });
    }
  }

  /**
   * Dynamic Spread Modeling:
   * Replicates real interbank institutional conditions (like GKFX / LMAX).
   * Spread depends on:
   * - Base raw spread
   * - Market session liquidity (London/NY overlap vs Asian session vs rollover widening)
   * - Real-time microstructural volatility spikes
   */
  public calculateDynamicSpread(symbol: string, volatilityMultiplier: number = 1.0): number {
    const spec = ASSET_SPECS[symbol];
    if (!spec) return 1.0;

    const hour = new Date().getUTCHours();
    let sessionFactor = 1.0;

    // London / NY overlap (12:00 - 16:00 UTC): Maximum liquidity, tightest spread
    if (hour >= 12 && hour <= 16) {
      sessionFactor = 0.9;
    }
    // Asian session (00:00 - 07:00 UTC): Lower FX liquidity, slightly wider spread
    else if (hour >= 0 && hour < 7) {
      sessionFactor = 1.35;
    }
    // FX Rollover hour (21:00 - 22:30 UTC): Interbank liquidity drops drastically, spreads widen 2.5x - 3.5x
    else if (hour === 21 || hour === 22) {
      sessionFactor = 2.8;
    }

    // Dynamic micro-noise between -5% and +15%
    const microNoise = 0.95 + Math.random() * 0.2;
    const dynamicSpread = spec.baseSpreadPips * sessionFactor * volatilityMultiplier * microNoise;

    return Math.max(spec.baseSpreadPips * 0.8, dynamicSpread);
  }

  /**
   * Generates 300+ historical OHLC candles for walk-forward backtesting
   */
  private generateAllHistoricalCandles(): void {
    for (const [symbol, spec] of Object.entries(ASSET_SPECS)) {
      const candles = this.generateHistoricalCandlesForSymbol(symbol, 400, 'H1');
      this.historicalCandles.set(symbol, candles);
    }
  }

  public generateHistoricalCandlesForSymbol(
    symbol: string,
    count: number = 400,
    timeframe: 'M5' | 'M15' | 'H1' | 'H4' | 'D1' = 'H1'
  ): Candle[] {
    const spec = ASSET_SPECS[symbol];
    const basePrice = REFERENCE_PRICES[symbol] || 100;
    const tfMinutes = {
      M5: 5,
      M15: 15,
      H1: 60,
      H4: 240,
      D1: 1440,
    }[timeframe];

    const intervalMs = tfMinutes * 60 * 1000;
    const now = Date.now();
    const candles: Candle[] = [];

    // Realistic volatility and trend drift based on asset class
    const dailyVol = spec.assetClass === 'commodity' ? 0.015 : spec.assetClass === 'index' ? 0.012 : 0.007;
    const candleVol = (dailyVol * Math.sqrt(tfMinutes / 1440));

    // Seeded random walk with mean reversion and momentum waves
    let currentClose = basePrice * 0.94; // start slightly earlier to create realistic trend
    let trendPhase = 0;

    for (let i = count - 1; i >= 0; i--) {
      const timestamp = now - i * intervalMs;
      trendPhase += 0.05;
      const cyclicalDrift = Math.sin(trendPhase) * (candleVol * 0.35);
      const randomShock = (Math.random() - 0.495) * 2 * candleVol;
      const changePct = cyclicalDrift + randomShock;

      const open = currentClose;
      const close = Number((open * (1 + changePct)).toFixed(spec.digits));
      const wickHigh = Math.max(open, close) * (1 + Math.random() * candleVol * 0.9);
      const wickLow = Math.min(open, close) * (1 - Math.random() * candleVol * 0.9);

      const high = Number(wickHigh.toFixed(spec.digits));
      const low = Number(wickLow.toFixed(spec.digits));
      const volume = Math.floor(1000 + Math.random() * 8000 + Math.abs(changePct) * 100000);

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      });

      currentClose = close;
    }

    return candles;
  }

  /**
   * Starts high-frequency streaming tick updates
   */
  private startLiveTickFeed(): void {
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      if (this.isSimulationPaused) return;
      this.stepNextTick();
    }, 600); // 600ms tick updates for responsive demo simulation
  }

  public stepNextTick(): void {
    const now = Date.now();
    const updatedSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'US500'];

    // Update 1-3 symbols per tick interval
    const chosenCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chosenCount; i++) {
      const symbol = updatedSymbols[Math.floor(Math.random() * updatedSymbols.length)];
      const spec = ASSET_SPECS[symbol];
      const prevTick = this.currentTicks.get(symbol);
      if (!prevTick || !spec) continue;

      // Realistic random-walk tick change
      const tickVol = spec.pipMultiplier * (0.2 + Math.random() * 0.8 * this.sessionVolatilityMultiplier);
      const direction = Math.random() > 0.49 ? 1 : -1;
      const priceDelta = direction * tickVol;

      let midPrice = (prevTick.bid + prevTick.ask) / 2 + priceDelta;
      // Prevent divergence from reference
      const ref = REFERENCE_PRICES[symbol];
      if (Math.abs(midPrice - ref) / ref > 0.08) {
        midPrice = ref * (1 + (Math.random() - 0.5) * 0.02);
      }

      const spreadPips = this.calculateDynamicSpread(symbol, this.sessionVolatilityMultiplier);
      const halfSpread = (spreadPips * spec.pipMultiplier) / 2;
      const bid = Number((midPrice - halfSpread).toFixed(spec.digits));
      const ask = Number((midPrice + halfSpread).toFixed(spec.digits));

      const high24h = Math.max(prevTick.high24h, ask);
      const low24h = Math.min(prevTick.low24h, bid);
      const change24hPercent = Number((((midPrice - ref) / ref) * 100).toFixed(2));

      this.currentTicks.set(symbol, {
        symbol,
        timestamp: now,
        bid,
        ask,
        spreadPips: Number(spreadPips.toFixed(1)),
        high24h,
        low24h,
        change24hPercent,
        volume: prevTick.volume + Math.floor(1 + Math.random() * 5),
      });

      // Also update latest candle
      const symbolCandles = this.historicalCandles.get(symbol);
      if (symbolCandles && symbolCandles.length > 0) {
        const lastCandle = symbolCandles[symbolCandles.length - 1];
        lastCandle.close = bid;
        if (bid > lastCandle.high) lastCandle.high = bid;
        if (bid < lastCandle.low) lastCandle.low = bid;
        lastCandle.volume += 1;
      }
    }

    this.notifyListeners();
  }

  public setVolatilityMultiplier(multiplier: number): void {
    this.sessionVolatilityMultiplier = Math.max(0.5, Math.min(multiplier, 5.0));
  }

  public getVolatilityMultiplier(): number {
    return this.sessionVolatilityMultiplier;
  }

  public togglePause(): boolean {
    this.isSimulationPaused = !this.isSimulationPaused;
    return this.isSimulationPaused;
  }

  public isPaused(): boolean {
    return this.isSimulationPaused;
  }

  public getTick(symbol: string): MarketTick | undefined {
    return this.currentTicks.get(symbol);
  }

  public getAllTicks(): MarketTick[] {
    return Array.from(this.currentTicks.values());
  }

  public getCandles(symbol: string): Candle[] {
    return this.historicalCandles.get(symbol) || [];
  }

  public subscribe(listener: (ticks: Map<string, MarketTick>) => void): () => void {
    this.listeners.add(listener);
    // Initial emission
    listener(new Map(this.currentTicks));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = new Map(this.currentTicks);
    this.listeners.forEach((listener) => listener(snapshot));
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }
}

export const marketDataService = new MarketDataService();

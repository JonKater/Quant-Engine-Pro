/**
 * QuantCore: FX & Multi-Asset Backtesting & Broker Simulation Platform
 * Unified Senior Quantitative Architecture & Web Terminal Interface
 */

import React, { useEffect, useState } from 'react';
import { DemoAccount, MarketTick, PendingOrder, Position, StrategyConfig, TradeHistoryItem } from './types/trading';
import { marketDataService } from './services/marketDataService';
import { brokerEngine } from './services/brokerEngine';
import { AccountLedgerBar } from './components/AccountLedgerBar';
import { TradingChart } from './components/TradingChart';
import { OrderTicket } from './components/OrderTicket';
import { PositionsTable } from './components/PositionsTable';
import { MarketWatch } from './components/MarketWatch';
import { BacktestLab } from './components/BacktestLab';
import { ArchitecturalHub } from './components/ArchitecturalHub';
import {
  Activity,
  Cpu,
  Layers,
  LineChart,
  Network,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Zap,
} from 'lucide-react';

export default function App() {
  // Navigation View Tab: 'TERMINAL' | 'BACKTEST' | 'ARCHITECTURE'
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'BACKTEST' | 'ARCHITECTURE'>('TERMINAL');

  // Broker & Market State
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  const [account, setAccount] = useState<DemoAccount>(brokerEngine.getAccount());
  const [positions, setPositions] = useState<Position[]>(brokerEngine.getPositions());
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(brokerEngine.getPendingOrders());
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>(brokerEngine.getTradeHistory());

  // Terminal Controls
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [timeframe, setTimeframe] = useState<'M5' | 'M15' | 'H1' | 'H4' | 'D1'>('H1');
  const [isPaused, setIsPaused] = useState<boolean>(marketDataService.isPaused());
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(
    marketDataService.getVolatilityMultiplier()
  );

  // Subscribe to market data ticks
  useEffect(() => {
    const unsubMarket = marketDataService.subscribe((updatedTicks) => {
      setTicks(updatedTicks);
    });

    const unsubBroker = brokerEngine.subscribe(() => {
      setAccount(brokerEngine.getAccount());
      setPositions(brokerEngine.getPositions());
      setPendingOrders(brokerEngine.getPendingOrders());
      setTradeHistory(brokerEngine.getTradeHistory());
    });

    return () => {
      unsubMarket();
      unsubBroker();
    };
  }, []);

  const handleTogglePause = () => {
    const paused = marketDataService.togglePause();
    setIsPaused(paused);
  };

  const handleVolatilityChange = (multiplier: number) => {
    marketDataService.setVolatilityMultiplier(multiplier);
    setVolatilityMultiplier(multiplier);
  };

  const currentTick = ticks.get(selectedSymbol);
  const currentCandles = marketDataService.getCandles(selectedSymbol);

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0b0f19] border-b border-slate-800 gap-3 sticky top-0 z-40 shadow-lg">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-md shadow-cyan-950/50">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">
                QuantCore <span className="text-cyan-400 font-mono text-xs font-semibold">v3.4-PRO</span>
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                GKFX ECN Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Institutional Broker Simulation & Optuna Walk-Forward Backtester
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center p-1 bg-[#111726] border border-slate-700/80 rounded-xl shadow-inner text-xs font-medium">
          <button
            id="nav-tab-terminal"
            onClick={() => setActiveTab('TERMINAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'TERMINAL'
                ? 'bg-cyan-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Broker Demo Terminal</span>
          </button>

          <button
            id="nav-tab-backtest"
            onClick={() => setActiveTab('BACKTEST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'BACKTEST'
                ? 'bg-cyan-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Optuna Walk-Forward Lab</span>
          </button>

          <button
            id="nav-tab-architecture"
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'ARCHITECTURE'
                ? 'bg-cyan-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Architecture & Mobile Spec</span>
          </button>
        </div>

        {/* Live System Status Pill */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300">Feed: 250k ticks/s</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>Lat: 1.2ms</span>
        </div>
      </header>

      {/* Real-Time Account Ledger Bar (Persistent across the platform) */}
      <AccountLedgerBar
        account={account}
        openPositionsCount={positions.length}
        isPaused={isPaused}
        volatilityMultiplier={volatilityMultiplier}
        onTogglePause={handleTogglePause}
        onVolatilityChange={handleVolatilityChange}
      />

      {/* Main Container */}
      <main className="flex-1 p-3 sm:p-4 max-w-7xl w-full mx-auto space-y-4">
        {/* VIEW 1: TRADING TERMINAL */}
        {activeTab === 'TERMINAL' && (
          <div className="space-y-4">
            {/* Top Row: Market Watch (3 cols), Candlestick Chart (6 cols), Order Ticket (3 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Market Watch Quote Board (3 cols) */}
              <div className="md:col-span-3">
                <MarketWatch
                  ticks={ticks}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={(sym) => setSelectedSymbol(sym)}
                />
              </div>

              {/* Interactive Candlestick Chart (6 cols) */}
              <div className="md:col-span-6">
                <TradingChart
                  symbol={selectedSymbol}
                  candles={currentCandles}
                  tick={currentTick}
                  positions={positions}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                />
              </div>

              {/* Order Entry Ticket (3 cols) */}
              <div className="md:col-span-3">
                <OrderTicket
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={setSelectedSymbol}
                  currentTick={currentTick}
                  freeMargin={account.freeMargin}
                />
              </div>
            </div>

            {/* Bottom Row: Positions, Pending Orders, Trade History Table */}
            <PositionsTable
              positions={positions}
              pendingOrders={pendingOrders}
              tradeHistory={tradeHistory}
            />
          </div>
        )}

        {/* VIEW 2: OPTUNA WALK-FORWARD BACKTESTING LAB */}
        {activeTab === 'BACKTEST' && (
          <BacktestLab
            onApplyStrategyToTerminal={(cfg) => {
              setSelectedSymbol(cfg.symbol);
              setTimeframe(cfg.timeframe);
              setActiveTab('TERMINAL');
            }}
          />
        )}

        {/* VIEW 3: SYSTEM ARCHITECTURE & MOBILE SPECIFICATION HUB */}
        {activeTab === 'ARCHITECTURE' && <ArchitecturalHub />}
      </main>

      {/* Institutional Footer */}
      <footer className="mt-auto px-4 py-3 bg-[#080b12] border-t border-slate-800 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono">
          <span>QuantCore Platform</span>
          <span>•</span>
          <span>GKFX Virtual Demo Account</span>
          <span>•</span>
          <span>Optuna TPE Walk-Forward Engine</span>
        </div>
        <div>
          <span>Simulated execution environment for quantitative research and demo trading. No real capital at risk.</span>
        </div>
      </footer>
    </div>
  );
}

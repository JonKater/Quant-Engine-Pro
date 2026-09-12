/**
 * Account Ledger & Margin Health Bar (GKFX-style Demo Account)
 * Displays real-time Balance, Equity, Margin, Free Margin, Margin Level %,
 * Stop-Out / Margin Call alerts, and Broker Stress Testing controls.
 */

import React from 'react';
import { DemoAccount } from '../types/trading';
import { brokerEngine } from '../services/brokerEngine';
import { marketDataService } from '../services/marketDataService';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface AccountLedgerBarProps {
  account: DemoAccount;
  openPositionsCount: number;
  isPaused: boolean;
  volatilityMultiplier: number;
  onTogglePause: () => void;
  onVolatilityChange: (multiplier: number) => void;
}

export const AccountLedgerBar: React.FC<AccountLedgerBarProps> = ({
  account,
  openPositionsCount,
  isPaused,
  volatilityMultiplier,
  onTogglePause,
  onVolatilityChange,
}) => {
  const isPositivePnL = account.floatingPnL >= 0;

  // Health assessment
  let marginHealthBadge = {
    text: 'Account Healthy',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
  };

  if (account.status === 'STOPPED_OUT') {
    marginHealthBadge = {
      text: 'STOP-OUT LIQUIDATION (≤50%)',
      color: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse',
      icon: AlertOctagon,
    };
  } else if (account.status === 'MARGIN_CALL') {
    marginHealthBadge = {
      text: 'MARGIN CALL WARNING (≤100%)',
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse',
      icon: AlertTriangle,
    };
  } else if (account.marginLevelPercent > 0 && account.marginLevelPercent < 250) {
    marginHealthBadge = {
      text: 'Moderate Margin Usage',
      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      icon: AlertTriangle,
    };
  }

  const HealthIcon = marginHealthBadge.icon;

  return (
    <div className="flex flex-col bg-[#0b0f19] border-b border-slate-800 px-4 py-3 shadow-md select-none">
      {/* Top Meta Strip */}
      <div className="flex flex-wrap items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-slate-800/80 text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <strong className="text-slate-200">{account.accountNumber}</strong>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{account.serverName}</span>
          </div>

          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${marginHealthBadge.color}`}>
            <HealthIcon className="w-3 h-3" />
            <span>{marginHealthBadge.text}</span>
          </div>
        </div>

        {/* Stress Testing & Simulation Tools */}
        <div className="flex items-center gap-3 text-xs">
          {/* Volatility Multiplier */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400">Vol Multiplier:</span>
            <div className="flex items-center gap-1">
              {[1.0, 2.0, 3.5].map((val) => (
                <button
                  key={val}
                  id={`vol-btn-${val}`}
                  onClick={() => onVolatilityChange(val)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                    volatilityMultiplier === val
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {val}x
                </button>
              ))}
            </div>
          </div>

          {/* Pause / Resume Ticker */}
          <button
            id="toggle-pause-feed-btn"
            onClick={onTogglePause}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition-colors"
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
            <span>{isPaused ? 'Resume Ticker' : 'Pause'}</span>
          </button>

          {/* Reset Account */}
          <button
            id="reset-account-btn"
            onClick={() => {
              if (window.confirm('Reset demo trading account balance to $50,000?')) {
                brokerEngine.resetAccount(50000, 100);
              }
            }}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>

          {/* Close All */}
          {openPositionsCount > 0 && (
            <button
              id="close-all-positions-btn"
              onClick={() => {
                if (window.confirm(`Close all ${openPositionsCount} open positions immediately?`)) {
                  brokerEngine.closeAllPositions();
                }
              }}
              className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-semibold shadow transition-colors"
            >
              Close All ({openPositionsCount})
            </button>
          )}
        </div>
      </div>

      {/* Core GKFX Ledger Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Balance */}
        <div className="flex flex-col bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Balance</span>
          <span className="font-mono text-base font-bold text-slate-100">
            ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Equity */}
        <div className="flex flex-col bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Equity</span>
          <span className={`font-mono text-base font-bold ${account.equity < account.balance ? 'text-rose-400' : 'text-slate-100'}`}>
            ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Margin Used */}
        <div className="flex flex-col bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Margin Used</span>
          <span className="font-mono text-base font-bold text-slate-200">
            ${account.marginUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Free Margin */}
        <div className="flex flex-col bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Free Margin</span>
          <span className={`font-mono text-base font-bold ${account.freeMargin <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            ${account.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Margin Level % */}
        <div className="flex flex-col bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Margin Level</span>
            <span className="text-[9px] text-slate-500 font-mono">Call: 100% | Out: 50%</span>
          </div>
          <span className={`font-mono text-base font-bold ${
            account.marginLevelPercent === 0
              ? 'text-slate-400'
              : account.marginLevelPercent <= 100
              ? 'text-rose-400 animate-pulse'
              : account.marginLevelPercent <= 250
              ? 'text-yellow-400'
              : 'text-cyan-400'
          }`}>
            {account.marginLevelPercent > 0 ? `${account.marginLevelPercent}%` : '---'}
          </span>
        </div>

        {/* Floating P&L */}
        <div className={`flex flex-col p-2 rounded-lg border ${
          isPositivePnL
            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
            : 'bg-rose-950/30 border-rose-800/40 text-rose-400'
        }`}>
          <span className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Floating P&L</span>
          <span className="font-mono text-base font-bold">
            {isPositivePnL ? '+' : ''}
            ${account.floatingPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};

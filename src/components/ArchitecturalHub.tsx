/**
 * Senior Software Architect Hub & Cross-Platform Mobile Blueprint
 * Comprehensive architectural specifications, component topology, latency SLAs,
 * FIX 4.4 protocol message flows, and Android & iOS technical blueprints.
 */

import React, { useState } from 'react';
import { MOBILE_ARCHITECTURE_SPEC, SYSTEM_MODULES } from '../data/architectureDocs';
import {
  Activity,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Download,
  FileCode,
  Layers,
  Network,
  Radio,
  Server,
  ShieldAlert,
  Smartphone,
  Zap,
} from 'lucide-react';

export const ArchitecturalHub: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'TOPOLOGY' | 'MOBILE' | 'SLA_SPECS' | 'FIX_PROTOCOL'>('TOPOLOGY');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(SYSTEM_MODULES[1].id);

  const selectedModule = SYSTEM_MODULES.find((m) => m.id === selectedModuleId) || SYSTEM_MODULES[1];

  const exportTechnicalPlan = () => {
    const content = `# SYSTEM ARCHITECTURE & TECHNICAL IMPLEMENTATION PLAN
Platform: High-Frequency FX & Multi-Asset Backtesting & Broker Simulation Platform
Architect: Senior Quantitative Systems Architect
Scope: Web Trading Terminal + Native/Cross-Platform Mobile (Android & iOS)

## 1. Executive Summary & Topology
The platform is designed as an ultra-low latency, event-driven microservices architecture:
- Market Data Ingestion (C++/Go, FIX 4.4, Kafka, 250k ticks/sec)
- Broker Simulation Core (Rust/C++, In-Memory Matching, Dynamic Spread Modeling)
- Distributed Optuna Walk-Forward Cluster (Ray/Python, TPE Bayesian Optimization)
- Storage Tier (ClickHouse for nanosecond tick archives, Redis for L1/L2 order book)
- Cross-Platform Mobile Core (Kotlin Multiplatform shared ledger math + Jetpack Compose & SwiftUI)

## 2. Dynamic Spread Modeling
S(t) = S_base * Phi_session(t) * (1 + kappa * sigma_micro(t)) + epsilon(t)

## 3. Margin & Stop-Out Enforcement
- Margin Level % = (Equity / Margin Used) * 100
- Margin Call Warning: <= 100%
- Stop-Out Forced Liquidation: <= 50% (largest floating loss closed first)

## 4. Cross-Platform Android & iOS Strategy
- Engine: Kotlin Multiplatform (KMP) shared ledger logic
- Android: Jetpack Compose + Skia 120Hz canvas + Room offline cache
- iOS: SwiftUI + Metal accelerated charting + SwiftData + APNs push notifications
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'QuantCore_Architecture_Specification.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col space-y-4 text-slate-200">
      {/* Architect Header Banner */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-[#0e1424] border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Quantitative System Architecture & Mobile Technical Blueprint
            </h2>
            <p className="text-xs text-slate-400">
              End-to-end distributed topology, GKFX broker simulation ledger rules, sub-millisecond execution SLAs, and native Android/iOS integration.
            </p>
          </div>
        </div>

        <button
          id="export-tech-plan-btn"
          onClick={exportTechnicalPlan}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Architecture Spec (.MD)</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#0f1422] border border-slate-800 rounded-xl text-xs">
        <button
          id="arch-tab-topology"
          onClick={() => setActiveSection('TOPOLOGY')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'TOPOLOGY'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System Topology & Microservices</span>
        </button>

        <button
          id="arch-tab-mobile"
          onClick={() => setActiveSection('MOBILE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'MOBILE'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Cross-Platform Mobile (Android & iOS)</span>
        </button>

        <button
          id="arch-tab-slas"
          onClick={() => setActiveSection('SLA_SPECS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'SLA_SPECS'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Quantitative Math & SLAs</span>
        </button>

        <button
          id="arch-tab-fix"
          onClick={() => setActiveSection('FIX_PROTOCOL')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition-colors ${
            activeSection === 'FIX_PROTOCOL'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>FIX 4.4 & WebSocket Schema</span>
        </button>
      </div>

      {/* Section 1: System Topology & Microservices */}
      {activeSection === 'TOPOLOGY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Module Selector Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-1">
              Core Architectural Tiers
            </span>
            {SYSTEM_MODULES.map((mod) => (
              <div
                key={mod.id}
                id={`arch-module-${mod.id}`}
                onClick={() => setSelectedModuleId(mod.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedModuleId === mod.id
                    ? 'bg-cyan-950/40 border-cyan-600/80 shadow-md'
                    : 'bg-[#0f1422] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">{mod.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                    {mod.tier}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span>Throughput: <strong className="text-slate-300">{mod.throughputSLA}</strong></span>
                  <span>Latency: <strong className="text-cyan-400">{mod.latencySLA}</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Module Deep-Dive Inspector (8 cols) */}
          <div className="lg:col-span-8 p-5 bg-[#0f1422] border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-mono tracking-wider">
                  Tier: {selectedModule.tier}
                </span>
                <h3 className="text-base font-bold text-slate-100">{selectedModule.name}</h3>
              </div>

              <div className="flex items-center gap-2">
                {selectedModule.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">{selectedModule.description}</p>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Core Architectural Responsibilities:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedModule.responsibilities.map((resp, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{resp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance SLAs */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Throughput SLA:</span>
                <span className="text-emerald-400 font-bold text-sm">{selectedModule.throughputSLA}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Service Latency SLA:</span>
                <span className="text-cyan-400 font-bold text-sm">{selectedModule.latencySLA}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Cross-Platform Mobile Blueprint */}
      {activeSection === 'MOBILE' && (
        <div className="space-y-4">
          <div className="p-5 bg-[#0f1422] border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Native & Cross-Platform Mobile Strategy
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                Architecture: {MOBILE_ARCHITECTURE_SPEC.framework}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              {MOBILE_ARCHITECTURE_SPEC.recommendation}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>120Hz Chart Rendering Engine</span>
                </span>
                <p className="text-xs text-slate-300">{MOBILE_ARCHITECTURE_SPEC.renderingApproach}</p>
              </div>

              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Data Sync & Battery Optimization</span>
                </span>
                <p className="text-xs text-slate-300">{MOBILE_ARCHITECTURE_SPEC.dataSyncStrategy}</p>
              </div>

              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Offline Storage & Sync</span>
                </span>
                <p className="text-xs text-slate-300">{MOBILE_ARCHITECTURE_SPEC.offlineCapabilities}</p>
              </div>

              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Push Notifications & Margin Alerts</span>
                </span>
                <p className="text-xs text-slate-300">{MOBILE_ARCHITECTURE_SPEC.pushNotifications}</p>
              </div>
            </div>

            {/* Code Snippet */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Shared Kotlin Multiplatform (KMP) Core Ledger Interface:
              </span>
              <pre className="p-3.5 bg-[#080b12] border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto">
                {MOBILE_ARCHITECTURE_SPEC.sampleCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Quantitative Math & SLAs */}
      {activeSection === 'SLA_SPECS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-[#0f1422] border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>Dynamic Spread Modeling Formula</span>
            </h3>
            <p className="text-xs text-slate-300">
              Replicates interbank ECN liquidity dynamics with three concurrent multipliers:
            </p>
            <div className="p-3 bg-[#090d16] border border-slate-800 rounded font-mono text-xs text-emerald-300">
              Spread(t) = BaseSpread × SessionFactor(t) × VolatilityMultiplier(t) + Noise(t)
            </div>
            <ul className="text-xs space-y-1.5 text-slate-400 list-disc list-inside">
              <li><strong>London/NY Overlap (12:00-16:00 UTC):</strong> 0.85x - 0.95x spread tightening.</li>
              <li><strong>Asian Session (00:00-07:00 UTC):</strong> 1.35x spread widening.</li>
              <li><strong>Rollover Hour (21:00-22:30 UTC):</strong> 2.8x - 3.8x institutional spread spike.</li>
              <li><strong>Microstructural Shock:</strong> Real-time variance jumps on high-volume ticks.</li>
            </ul>
          </div>

          <div className="p-5 bg-[#0f1422] border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Broker Margin Call & Stop-Out State Machine</span>
            </h3>
            <p className="text-xs text-slate-300">
              Deterministic risk engine mirroring legacy GKFX UK / ECN margin terms:
            </p>
            <div className="p-3 bg-[#090d16] border border-slate-800 rounded font-mono text-xs text-amber-300">
              MarginLevel% = (Equity ÷ MarginUsed) × 100
            </div>
            <ul className="text-xs space-y-1.5 text-slate-400 list-disc list-inside">
              <li><strong>Normal Trading (&gt; 100%):</strong> Full order execution allowed.</li>
              <li><strong>Margin Call Warning (≤ 100%):</strong> Account flagged, new positions blocked.</li>
              <li><strong>Stop-Out Liquidation (≤ 50%):</strong> Automated circuit breaker closes largest loss position first until margin level recovers above 50%.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Section 4: FIX 4.4 & WebSocket Protocols */}
      {activeSection === 'FIX_PROTOCOL' && (
        <div className="p-5 bg-[#0f1422] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>FIX 4.4 Financial Information eXchange Protocol Mapping</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Institutional Gateway Specification</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 bg-[#090d16] border border-slate-800 rounded-lg space-y-1">
              <span className="text-cyan-400 font-bold block">35=D (NewOrderSingle)</span>
              <p className="text-slate-400 text-[11px] font-sans">Client submits market, limit, or stop order.</p>
              <div className="text-[10px] text-slate-500 pt-1">Tags: 11=ClOrdID, 55=Symbol, 54=Side, 38=OrderQty, 40=OrdType, 44=Price</div>
            </div>

            <div className="p-3 bg-[#090d16] border border-slate-800 rounded-lg space-y-1">
              <span className="text-emerald-400 font-bold block">35=8 (ExecutionReport)</span>
              <p className="text-slate-400 text-[11px] font-sans">Broker simulation engine confirms fill or partial fill.</p>
              <div className="text-[10px] text-slate-500 pt-1">Tags: 37=OrderID, 39=OrdStatus, 150=ExecType, 31=LastPx, 32=LastQty</div>
            </div>

            <div className="p-3 bg-[#090d16] border border-slate-800 rounded-lg space-y-1">
              <span className="text-rose-400 font-bold block">35=F (OrderCancelRequest)</span>
              <p className="text-slate-400 text-[11px] font-sans">Client cancels unfilled limit/stop order.</p>
              <div className="text-[10px] text-slate-500 pt-1">Tags: 41=OrigClOrdID, 11=ClOrdID, 55=Symbol, 54=Side</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

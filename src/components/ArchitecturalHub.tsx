/**
 * Simulation Methodology & Mechanics Explanatory Hub (Area 3 of VISION.md)
 *
 * Explains how the application computes what it computes and where the limits of
 * the simulation lie — so the user can interpret the numbers correctly.
 *
 * Covers:
 * 1. Seeded price series & volatility generation
 * 2. Dynamic interbank spread modeling
 * 3. Account currency arithmetic & margin
 * 4. Order execution, validation & forced liquidation
 * 5. Walk-Forward Optimization (WFO) anti-overfitting methodology
 * 6. Deliberate simplifications and simulation boundaries
 */

import React, { useState } from 'react';
import { METHODOLOGY_SECTIONS, MethodologySection } from '../data/architectureDocs';
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  DollarSign,
  Download,
  Info,
  Layers,
  Scale,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';

export const ArchitecturalHub: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(METHODOLOGY_SECTIONS[0].id);

  const categories = ['ALL', 'Price Modeling', 'Execution & Spread', 'Account & Margin', 'Walk-Forward Lab', 'Simulation Limits'];

  const filteredSections = selectedCategory === 'ALL'
    ? METHODOLOGY_SECTIONS
    : METHODOLOGY_SECTIONS.filter((s) => s.category === selectedCategory);

  const activeSection = METHODOLOGY_SECTIONS.find((s) => s.id === selectedSectionId) || METHODOLOGY_SECTIONS[0];

  const exportMethodologyDoc = () => {
    let content = `# QUANTCORE SIMULATION METHODOLOGY & MECHANICS SPECIFICATION\n\n`;
    content += `*This document explains how QuantEngine computes its numbers and where the boundaries of the browser simulation lie.*\n\n`;

    for (const sec of METHODOLOGY_SECTIONS) {
      content += `## ${sec.title}\n`;
      content += `**Category:** ${sec.category}\n\n`;
      content += `${sec.summary}\n\n`;
      if (sec.formulaOrRule) {
        content += `**Governing Rule / Formula:**\n\`\`\`\n${sec.formulaOrRule}\n\`\`\`\n\n`;
      }
      content += `**Operational Details:**\n`;
      for (const d of sec.details) {
        content += `- ${d}\n`;
      }
      content += `\n---\n\n`;
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'QuantCore_Simulation_Methodology.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Price Modeling':
        return <TrendingUp className="w-4 h-4 text-cyan-400" />;
      case 'Execution & Spread':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'Account & Margin':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'Walk-Forward Lab':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'Simulation Limits':
        return <Scale className="w-4 h-4 text-slate-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="flex flex-col space-y-4 text-slate-200">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-[#0e1424] border border-slate-800 rounded-xl gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Simulation Mechanics & Mathematical Methodology
            </h2>
            <p className="text-xs text-slate-400">
              Honest disclosure of how this browser engine computes prices, spreads, margin, and walk-forward verification.
            </p>
          </div>
        </div>

        <button
          id="export-methodology-doc-btn"
          onClick={exportMethodologyDoc}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Methodology Spec (.MD)</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0f1422] border border-slate-800 rounded-xl text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Topics List */}
        <div className="lg:col-span-5 space-y-2">
          {filteredSections.map((sec) => {
            const isSelected = sec.id === selectedSectionId;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-slate-800/80 border-cyan-500/50 shadow-md'
                    : 'bg-[#0f1422] border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(sec.category)}
                    <span className="text-xs font-bold text-slate-100">{sec.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {sec.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">{sec.summary}</p>
              </button>
            );
          })}
        </div>

        {/* Right Column: Detailed Topic View */}
        <div className="lg:col-span-7 bg-[#0f1422] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {getCategoryIcon(activeSection.category)}
                <span className="text-[11px] uppercase font-mono text-cyan-400">{activeSection.category}</span>
              </div>
              <h3 className="text-base font-bold text-slate-100">{activeSection.title}</h3>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Summary</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{activeSection.summary}</p>
          </div>

          {activeSection.formulaOrRule && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Mathematical Rule / Formula
              </h4>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-cyan-300 overflow-x-auto">
                {activeSection.formulaOrRule}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Implementation Details & Mechanics
            </h4>
            <ul className="space-y-2">
              {activeSection.details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

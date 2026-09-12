/**
 * Positions, Pending Orders, and Trade History Ledger Table
 * Mirrors institutional MT4 / GKFX Terminal interface with real-time P&L,
 * SL/TP modification dialogs, trailing stop status, and CSV export.
 */

import React, { useState } from 'react';
import { PendingOrder, Position, TradeHistoryItem } from '../types/trading';
import { ASSET_SPECS } from '../services/marketDataService';
import { brokerEngine } from '../services/brokerEngine';
import {
  Clock,
  Download,
  Edit2,
  ListOrdered,
  RotateCcw,
  Sliders,
  X,
  XCircle,
} from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  pendingOrders: PendingOrder[];
  tradeHistory: TradeHistoryItem[];
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  pendingOrders,
  tradeHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'PENDING' | 'HISTORY'>('POSITIONS');
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editSl, setEditSl] = useState<string>('');
  const [editTp, setEditTp] = useState<string>('');
  const [editTrailing, setEditTrailing] = useState<string>('');

  const handleOpenEdit = (pos: Position) => {
    setEditingPosition(pos);
    setEditSl(pos.sl !== null ? pos.sl.toString() : '');
    setEditTp(pos.tp !== null ? pos.tp.toString() : '');
    setEditTrailing(pos.trailingStopPips ? pos.trailingStopPips.toString() : '');
  };

  const handleSaveEdit = () => {
    if (!editingPosition) return;
    const sl = editSl ? parseFloat(editSl) : null;
    const tp = editTp ? parseFloat(editTp) : null;
    const trailing = editTrailing ? parseFloat(editTrailing) : null;

    brokerEngine.modifyPosition(editingPosition.id, sl, tp, trailing);
    setEditingPosition(null);
  };

  const exportCSV = () => {
    if (tradeHistory.length === 0) return;
    const headers = [
      'Ticket',
      'Symbol',
      'Side',
      'Lots',
      'Open Price',
      'Close Price',
      'Open Time',
      'Close Time',
      'Commission',
      'Swap',
      'Net PnL',
      'Close Reason',
    ];

    const rows = tradeHistory.map((item) => [
      item.ticketNumber,
      item.symbol,
      item.side,
      item.lots,
      item.openPrice,
      item.closePrice,
      new Date(item.openTime).toISOString(),
      new Date(item.closeTime).toISOString(),
      item.commission,
      item.swap,
      item.netPnL,
      item.closeReason,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trade_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-300">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#101625] border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <button
            id="tab-open-positions"
            onClick={() => setActiveTab('POSITIONS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'POSITIONS'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Open Positions ({positions.length})</span>
          </button>

          <button
            id="tab-pending-orders"
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'PENDING'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Orders ({pendingOrders.length})</span>
          </button>

          <button
            id="tab-closed-history"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'HISTORY'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Account History ({tradeHistory.length})</span>
          </button>
        </div>

        {activeTab === 'HISTORY' && tradeHistory.length > 0 && (
          <button
            id="export-csv-btn"
            onClick={exportCSV}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[160px] max-h-[280px]">
        {/* Tab 1: Open Positions */}
        {activeTab === 'POSITIONS' && (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e1322] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Ticket</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Lots</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">S / L</th>
                <th className="py-2.5 px-3">T / P</th>
                <th className="py-2.5 px-3">Current</th>
                <th className="py-2.5 px-3">Comm.</th>
                <th className="py-2.5 px-3">Margin</th>
                <th className="py-2.5 px-3 text-right">Profit (USD)</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No active positions open. Place an order from the order ticket above.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const spec = ASSET_SPECS[pos.symbol];
                  const digits = spec ? spec.digits : 5;
                  const isProfit = pos.floatingPnL >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2 px-3 text-slate-400">#{pos.ticketNumber}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(pos.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pos.side === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-200">{pos.lots.toFixed(2)}</td>
                      <td className="py-2 px-3 font-bold text-slate-100">{pos.symbol}</td>
                      <td className="py-2 px-3">{pos.openPrice.toFixed(digits)}</td>
                      <td className="py-2 px-3 text-rose-400">{pos.sl ? pos.sl.toFixed(digits) : '---'}</td>
                      <td className="py-2 px-3 text-emerald-400">{pos.tp ? pos.tp.toFixed(digits) : '---'}</td>
                      <td className="py-2 px-3 font-semibold text-slate-200">{pos.currentPrice.toFixed(digits)}</td>
                      <td className="py-2 px-3 text-slate-400">-${pos.commission.toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-400">${pos.marginRequired.toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${pos.floatingPnL.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`edit-pos-${pos.ticketNumber}`}
                            onClick={() => handleOpenEdit(pos)}
                            title="Modify SL/TP"
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`close-pos-${pos.ticketNumber}`}
                            onClick={() => brokerEngine.closePosition(pos.id, 'MANUAL')}
                            title="Close Position"
                            className="p-1 hover:bg-rose-950/60 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Tab 2: Pending Orders */}
        {activeTab === 'PENDING' && (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e1322] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Ticket</th>
                <th className="py-2.5 px-3">Placed Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Lots</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Target Price</th>
                <th className="py-2.5 px-3">S / L</th>
                <th className="py-2.5 px-3">T / P</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No pending orders active.
                  </td>
                </tr>
              ) : (
                pendingOrders.map((order) => {
                  const spec = ASSET_SPECS[order.symbol];
                  const digits = spec ? spec.digits : 5;

                  return (
                    <tr key={order.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2 px-3 text-slate-400">#{order.ticketNumber}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-cyan-300">{order.orderType.replace('_', ' ')}</td>
                      <td className="py-2 px-3">{order.lots.toFixed(2)}</td>
                      <td className="py-2 px-3 font-bold text-slate-100">{order.symbol}</td>
                      <td className="py-2 px-3 font-semibold text-slate-100">{order.price.toFixed(digits)}</td>
                      <td className="py-2 px-3 text-rose-400">{order.sl ? order.sl.toFixed(digits) : '---'}</td>
                      <td className="py-2 px-3 text-emerald-400">{order.tp ? order.tp.toFixed(digits) : '---'}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          id={`cancel-order-${order.ticketNumber}`}
                          onClick={() => brokerEngine.cancelPendingOrder(order.id)}
                          className="px-2 py-0.5 bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded text-[11px] transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Tab 3: Closed Trade History */}
        {activeTab === 'HISTORY' && (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e1322] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Ticket</th>
                <th className="py-2.5 px-3">Close Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Lots</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Open Price</th>
                <th className="py-2.5 px-3">Close Price</th>
                <th className="py-2.5 px-3">Comm.</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {tradeHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No closed trades recorded yet in this session.
                  </td>
                </tr>
              ) : (
                tradeHistory.map((item) => {
                  const spec = ASSET_SPECS[item.symbol];
                  const digits = spec ? spec.digits : 5;
                  const isProfit = item.netPnL >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2 px-3 text-slate-400">#{item.ticketNumber}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(item.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.side}
                        </span>
                      </td>
                      <td className="py-2 px-3">{item.lots.toFixed(2)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-100">{item.symbol}</td>
                      <td className="py-2 px-3">{item.openPrice.toFixed(digits)}</td>
                      <td className="py-2 px-3">{item.closePrice.toFixed(digits)}</td>
                      <td className="py-2 px-3 text-slate-400">-${item.commission.toFixed(2)}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold ${
                            item.closeReason === 'TP'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : item.closeReason === 'SL'
                              ? 'bg-rose-500/20 text-rose-400'
                              : item.closeReason === 'STOP_OUT'
                              ? 'bg-purple-500/20 text-purple-400 animate-pulse'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.closeReason}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${item.netPnL.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit SL/TP Modal Dialog */}
      {editingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111626] border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-100">
                Modify Position #{editingPosition.ticketNumber} ({editingPosition.symbol})
              </h3>
              <button
                onClick={() => setEditingPosition(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div>Type: <strong className="text-slate-200">{editingPosition.side} {editingPosition.lots} lots</strong></div>
              <div>Open Price: <strong className="text-slate-200 font-mono">{editingPosition.openPrice}</strong></div>
              <div>Current Price: <strong className="text-slate-200 font-mono">{editingPosition.currentPrice}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Stop Loss Price</label>
                <input
                  id="edit-sl-input"
                  type="number"
                  step="0.00001"
                  value={editSl}
                  onChange={(e) => setEditSl(e.target.value)}
                  placeholder="0.00000 (Empty for none)"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 font-mono rounded p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Take Profit Price</label>
                <input
                  id="edit-tp-input"
                  type="number"
                  step="0.00001"
                  value={editTp}
                  onChange={(e) => setEditTp(e.target.value)}
                  placeholder="0.00000 (Empty for none)"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 font-mono rounded p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Trailing Stop (Pips)</label>
                <input
                  id="edit-trailing-input"
                  type="number"
                  value={editTrailing}
                  onChange={(e) => setEditTrailing(e.target.value)}
                  placeholder="20 (Empty to disable)"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 font-mono rounded p-2 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingPosition(null)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                id="save-position-mod-btn"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

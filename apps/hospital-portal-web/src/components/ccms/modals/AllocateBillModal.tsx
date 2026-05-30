'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, RefreshCw, Receipt } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { allocateBill, importBillLines, type BillLineItemRequest, type BillingSummary } from '@/lib/api/ccms/ccms-billing.api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  caseId: string;
  approvedAmount: number;   // from the pre-auth
  open: boolean;
  onClose: () => void;
  onAllocated: (summary: BillingSummary) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

type LineItem = { description: string; category: string; amount: string; excluded: boolean; excludeReason: string };

const CATEGORIES = ['Surgery/Procedure', 'Room', 'Medicines', 'Lab/Investigations', 'Nursing', 'Anaesthesia', 'Other'];

function emptyLine(): LineItem {
  return { description: '', category: 'Other', amount: '', excluded: false, excludeReason: '' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AllocateBillModal({ caseId, approvedAmount, open, onClose, onAllocated }: Props) {
  const [billId,      setBillId]      = useState('');
  const [billDate,    setBillDate]    = useState('');
  const [totalBill,   setTotalBill]   = useState('');
  const [copayPct,    setCopayPct]    = useState('');
  const [deductible,  setDeductible]  = useState('');
  const [lines,       setLines]       = useState<LineItem[]>([emptyLine()]);
  const [busy,      setBusy]      = useState(false);
  const [importing, setImporting] = useState(false);
  const containerRef = useFocusTrap(open);

  if (!open) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      const draft = await importBillLines(caseId);
      if (draft.rowCount === 0) {
        toast('No billing lines found in the IP system. Enter lines manually.');
      } else {
        setTotalBill(String(draft.totalBillAmount));
        setBillDate(draft.billDate ?? '');
        setLines(draft.lineItems.map(l => ({
          description:   l.description,
          category:      l.type || 'Other',
          amount:        String(l.billedAmount),
          excluded:      l.isExcluded,
          excludeReason: l.isExcluded ? 'Excluded per IP billing' : '',
        })));
        toast.success(`Imported ${draft.rowCount} line${draft.rowCount !== 1 ? 's' : ''} from billing system`);
      }
    } catch {
      toast.error('Could not import from billing system — enter lines manually');
    } finally {
      setImporting(false);
    }
  };

  const total = parseFloat(totalBill) || 0;
  const excluded = lines.filter(l => l.excluded).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const payable = total - excluded;
  const insCovers = Math.min(payable, approvedAmount);
  const patientShare = Math.max(payable - insCovers, 0) + excluded;

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!total) { toast.error('Enter total bill amount'); return; }
    if (lines.some(l => l.description && !l.amount)) {
      toast.error('Enter amount for all line items');
      return;
    }
    setBusy(true);
    try {
      const lineItems: BillLineItemRequest[] = lines
        .filter(l => l.description.trim() && l.amount)
        .map(l => ({
          type:             l.category,
          code:             undefined,
          description:      l.description.trim(),
          billedAmount:     parseFloat(l.amount) || 0,
          isExcluded:       l.excluded,
          disallowedReason: l.excluded ? (l.excludeReason || 'Excluded from coverage') : undefined,
        }));

      const summary = await allocateBill(caseId, {
        billId:          billId || undefined,
        billDate:        billDate || undefined,
        totalBillAmount: total,
        copayPercent:    parseFloat(copayPct) || undefined,
        deductibleAmount: parseFloat(deductible) || undefined,
        lineItems:       lineItems.length > 0 ? lineItems : undefined,
      });
      toast.success('Bill allocated successfully');
      onAllocated(summary);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error ?? (err as { message?: string })?.message ?? 'Failed to allocate bill';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div ref={containerRef} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-indigo-500" />
          <div>
            <p className="text-sm font-bold text-gray-900">Allocate Bill</p>
            <p className="text-[11px] text-gray-400">Approved limit: ₹{approvedAmount.toLocaleString('en-IN')}</p>
          </div>
          </div>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
              Import from billing
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Bill meta */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label text="Bill / Invoice No." />
              <input type="text" value={billId} onChange={e => setBillId(e.target.value)}
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <div>
              <Label text="Bill Date" />
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <div>
              <Label text="Total Bill Amount (₹)" required />
              <input type="number" min="0" value={totalBill} onChange={e => setTotalBill(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
              />
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label text="Co-pay %" />
              <input type="number" min="0" max="100" value={copayPct} onChange={e => setCopayPct(e.target.value)}
                placeholder="e.g. 20"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
              />
            </div>
            <div>
              <Label text="Deductible (₹)" />
              <input type="number" min="0" value={deductible} onChange={e => setDeductible(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 text-right"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label text="Line Items" />
              <button type="button" onClick={() => setLines(p => [...p, emptyLine()])}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="w-3 h-3" /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className={`rounded-xl border p-3 space-y-2 ${line.excluded ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <input type="text" value={line.description} onChange={e => updateLine(i, { description: e.target.value })}
                        placeholder="Description"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="col-span-3">
                      <select value={line.category} onChange={e => updateLine(i, { category: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="0" value={line.amount} onChange={e => updateLine(i, { amount: e.target.value })}
                        placeholder="Amount ₹"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button type="button" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`excl-${i}`} checked={line.excluded}
                      onChange={e => updateLine(i, { excluded: e.target.checked })}
                      className="accent-amber-500"
                    />
                    <label htmlFor={`excl-${i}`} className="text-[11px] text-amber-700 font-medium">Exclude from coverage</label>
                    {line.excluded && (
                      <input type="text" value={line.excludeReason} onChange={e => updateLine(i, { excludeReason: e.target.value })}
                        placeholder="Reason for exclusion"
                        className="flex-1 ml-2 px-2 py-1 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation preview */}
          {total > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Allocation Preview</p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Bill</span>
                <span className="font-semibold text-gray-800">{inr(total)}</span>
              </div>
              {excluded > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-600">Excluded (non-payable)</span>
                  <span className="font-semibold text-amber-700">{inr(excluded)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Insurance Covers</span>
                <span className="font-semibold text-green-700">{inr(insCovers)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                <span className="text-red-600 font-semibold">Patient Payable</span>
                <span className="font-bold text-red-700">{inr(patientShare)}</span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
            Cancel
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={busy || !total}
            className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {busy && <RefreshCw className="w-3 h-3 animate-spin" />}
            Confirm Allocation
          </button>
        </div>
      </div>
    </div>
  );
}

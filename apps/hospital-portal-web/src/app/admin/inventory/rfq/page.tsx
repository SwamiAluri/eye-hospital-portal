'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Search, FileText, X, CheckCircle, Eye, Award, Ban, Lock, ShoppingCart, MessageSquare, Phone, Mail, History, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import {
  rfqApi,
  inventoryItemApi,
  purchaseOrderApi,
  vendorAckApi,
  VendorAcknowledgmentDto,
  AckChannel,
  VendorDto,
  ItemDto,
  VendorQuoteDto,
  RfqHeader,
} from '@/lib/api/inventory-service.api';
import { useVendors, useBranches, useInventoryItems } from '@/hooks/useInventoryReferenceData';
import { usePaymentTerms } from '@/hooks/use-inventory-masters';

const STATUS_TABS = [
  { key: 'All',                    label: 'All',               dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Draft',                  label: 'Draft',             dot: 'bg-amber-400',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'Published',              label: 'Published',         dot: 'bg-blue-400',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'ResponseWindowClosed',   label: 'Responses In',      dot: 'bg-cyan-400',    activeClass: 'bg-cyan-600 border-cyan-600 text-white' },
  { key: 'EvaluationInProgress',   label: 'Evaluating',        dot: 'bg-purple-400',  activeClass: 'bg-purple-600 border-purple-600 text-white' },
  { key: 'NegotiationRequired',    label: 'Negotiating',       dot: 'bg-orange-400',  activeClass: 'bg-orange-500 border-orange-500 text-white' },
  { key: 'PendingFinalApproval',   label: 'Pending Approval',  dot: 'bg-yellow-400',  activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
  { key: 'Awarded',                label: 'Awarded',           dot: 'bg-green-400',   activeClass: 'bg-green-600 border-green-600 text-white' },
  { key: 'Closed',                 label: 'Closed',            dot: 'bg-gray-400',    activeClass: 'bg-gray-600 border-gray-600 text-white' },
  { key: 'Cancelled',              label: 'Cancelled',         dot: 'bg-red-400',     activeClass: 'bg-red-500 border-red-500 text-white' },
];

const STATUS_BORDER: Record<string, string> = {
  Draft: 'border-l-amber-400', Published: 'border-l-blue-400',
  ResponseWindowClosed: 'border-l-cyan-400', EvaluationInProgress: 'border-l-purple-400',
  NegotiationRequired: 'border-l-orange-400', PendingFinalApproval: 'border-l-yellow-400',
  Awarded: 'border-l-green-500', Closed: 'border-l-gray-300', Cancelled: 'border-l-red-400',
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  Draft:                  { bg: 'bg-amber-100 text-amber-700',    label: 'Draft'            },
  Published:              { bg: 'bg-blue-100 text-blue-700',      label: 'Published'        },
  ResponseWindowClosed:   { bg: 'bg-cyan-100 text-cyan-700',      label: 'Responses In'     },
  EvaluationInProgress:   { bg: 'bg-purple-100 text-purple-700',  label: 'Evaluating'       },
  NegotiationRequired:    { bg: 'bg-orange-100 text-orange-700',  label: 'Negotiating'      },
  PendingFinalApproval:   { bg: 'bg-yellow-100 text-yellow-700',  label: 'Pending Approval' },
  Awarded:                { bg: 'bg-green-100 text-green-700',    label: 'Awarded'          },
  Closed:                 { bg: 'bg-gray-100 text-gray-600',      label: 'Closed'           },
  Cancelled:              { bg: 'bg-red-100 text-red-700',        label: 'Cancelled'        },
};

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function SkeletonRow() {
  return (
    <tr>{[130, 140, 80, 100, 80, 110].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: w }} />
      </td>
    ))}</tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { bg: 'bg-gray-100 text-gray-600', label: status };
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 pb-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateRFQModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: vendors = [] } = useVendors();
  const { data: branches = [] } = useBranches();
  const [itemSearch, setItemSearch] = useState('');
  const [querySearch, setQuerySearch] = useState<string | undefined>(undefined);
  const { data: items = [] } = useInventoryItems(querySearch, 20);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [lines, setLines] = useState<{ itemId: string; itemName: string; quantity: number; unit: string; specifications?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setQuerySearch(itemSearch || undefined);
      if (itemSearch.trim()) setShowItemDropdown(true);
    }, 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const toggleVendor = (id: string) => {
    setSelectedVendorIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const addLine = (item: ItemDto) => {
    if (lines.some(l => l.itemId === item.id)) return;
    setLines(prev => [...prev, { itemId: item.id, itemName: item.itemName, quantity: 1, unit: item.unit ?? 'Nos' }]);
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const submit = async () => {
    if (!title.trim()) { setError('Enter an RFQ title.'); return; }
    if (!branchId) { setError('Select a branch.'); return; }
    if (selectedVendorIds.length === 0) { setError('Select at least one vendor.'); return; }
    if (lines.length === 0) { setError('Add at least one item.'); return; }
    if (!responseDeadline) { setError('Set a response deadline.'); return; }
    setBusy(true); setError('');
    try {
      await rfqApi.create({
        title,
        description: description || undefined,
        branchId,
        vendorIds: selectedVendorIds,
        responseDeadline,
        items: lines.map(l => ({ itemId: l.itemId, requestedQty: l.quantity, unit: l.unit, specifications: l.specifications || undefined })),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to create RFQ.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="New Request for Quotation" onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q1 Pharmacy Supplies RFQ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Branch —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={responseDeadline} onChange={e => setResponseDeadline(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invite Vendors <span className="text-red-500">*</span> ({selectedVendorIds.length} selected)</label>
          <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
            {vendors.map(v => (
              <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <input type="checkbox" checked={selectedVendorIds.includes(v.id)} onChange={() => toggleVendor(v.id)} className="rounded" />
                <span className="truncate">{v.name}</span>
              </label>
            ))}
            {vendors.length === 0 && <p className="text-xs text-gray-400 col-span-2 text-center py-2">No vendors found</p>}
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search & Add Items</label>
          <input
            value={itemSearch}
            onChange={e => { setItemSearch(e.target.value); if (!e.target.value.trim()) setShowItemDropdown(false); }}
            onFocus={() => { if (items.length > 0) setShowItemDropdown(true); }}
            onBlur={() => setTimeout(() => setShowItemDropdown(false), 150)}
            placeholder="Type item name to search…"
            autoComplete="off"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showItemDropdown && items.length > 0 && (
            <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
              {items.map(it => (
                <button
                  key={it.id}
                  type="button"
                  onMouseDown={() => addLine(it)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between group"
                >
                  <span className="font-medium text-gray-800 group-hover:text-blue-700">{it.itemName}</span>
                  <span className="text-xs text-gray-400 ml-2">{it.unit}</span>
                </button>
              ))}
            </div>
          )}
          {showItemDropdown && items.length === 0 && itemSearch.trim() && (
            <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 px-4 py-3 text-sm text-gray-400">
              No items found for &ldquo;{itemSearch}&rdquo;
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Item', 'Unit', 'Qty', 'Specifications', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{l.itemName}</td>
                    <td className="px-3 py-2 text-gray-500">{l.unit}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} value={l.quantity}
                        onChange={e => setLines(prev => { const n = [...prev]; n[i] = { ...n[i], quantity: parseInt(e.target.value) || 1 }; return n; })}
                        className="border rounded px-2 py-1 w-20 text-center text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={l.specifications ?? ''} placeholder="Optional specs"
                        onChange={e => setLines(prev => { const n = [...prev]; n[i] = { ...n[i], specifications: e.target.value }; return n; })}
                        className="border rounded px-2 py-1 w-full text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy || lines.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Creating…' : 'Create RFQ'}
        </button>
      </div>
    </Modal>
  );
}

function CompareQuotesView({ rfq, quotes, canApprove, onAward }: {
  rfq: any; quotes: VendorQuoteDto[]; canApprove: boolean; onAward: (vendorId: string) => void;
}) {
  const allItemIds = Array.from(new Set(quotes.flatMap(q => q.items?.map(i => i.itemId) ?? [])));
  const itemNames: Record<string, string> = {};
  quotes.forEach(q => q.items?.forEach(i => { if (!itemNames[i.itemId]) itemNames[i.itemId] = i.item?.itemName ?? i.itemId; }));
  const canShowAward = canApprove && rfq.rfqStatus === 'PendingFinalApproval';

  if (quotes.length === 0) return <p className="text-sm text-amber-600 px-6 py-4">No vendor quotes submitted yet.</p>;

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 border border-gray-200 font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[150px]">Item</th>
            {quotes.map(q => (
              <th key={q.id} className="text-center p-2 border border-gray-200 font-medium text-gray-700 min-w-[130px]">
                <div className="truncate">{q.vendor?.name ?? q.vendorId}</div>
                <div className="flex justify-center gap-1 mt-0.5 flex-wrap">
                  {q.rankPosition != null && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Rank #{q.rankPosition}</span>}
                  {q.quoteStatus === 'Disqualified' && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">DQ</span>}
                  {q.quoteStatus === 'Won' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Won</span>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItemIds.map(itemId => (
            <tr key={itemId} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-200 font-medium text-gray-700 sticky left-0 bg-white">{itemNames[itemId]}</td>
              {quotes.map(q => {
                const it = q.items?.find(i => i.itemId === itemId);
                if (!it) return <td key={q.id} className="p-2 border border-gray-200 text-center text-gray-300">—</td>;
                return (
                  <td key={q.id} className="p-2 border border-gray-200 text-right space-y-0.5">
                    <div className="text-gray-900 font-medium">₹{it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="text-gray-400">GST {it.gstPercent}%</div>
                    <div className="text-gray-600">₹{it.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
            <td className="p-2 border border-gray-200 sticky left-0 bg-gray-50 text-gray-700">Total</td>
            {quotes.map((q, idx) => (
              <td key={q.id} className="p-2 border border-gray-200 text-right">
                <span className={idx === 0 ? 'text-green-700 font-bold' : 'text-gray-900'}>
                  ₹{(q.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {idx === 0 && <div className="text-xs text-green-600 mt-0.5">Lowest</div>}
              </td>
            ))}
          </tr>
          {canShowAward && (
            <tr className="bg-green-50">
              <td className="p-2 border border-gray-200 sticky left-0 bg-green-50 text-gray-600 font-medium">Award</td>
              {quotes.map(q => (
                <td key={q.id} className="p-2 border border-gray-200 text-center">
                  {q.quoteStatus !== 'Disqualified' && (
                    <button onClick={() => onAward(q.vendorId)}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                      Award
                    </button>
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AwardVendorModal({ rfq, canApprove, onClose, onDone }: { rfq: any; canApprove: boolean; onClose: () => void; onDone: () => void }) {
  const [quotes, setQuotes] = useState<VendorQuoteDto[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'select' | 'compare'>('select');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    rfqApi.getQuotes(rfq.id)
      .then(q => { setQuotes(q ?? []); if ((q ?? []).length === 1) setSelectedVendorId(q[0].vendorId); })
      .catch(() => setErr('Failed to load vendor quotes.'))
      .finally(() => setLoading(false));
  }, [rfq.id]);

  const submit = async () => {
    if (!selectedVendorId) { setErr('Select a vendor to award.'); return; }
    setBusy(true); setErr('');
    try {
      await rfqApi.award(rfq.id, selectedVendorId);
      toast.success('RFQ awarded successfully.');
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? 'Failed to award RFQ.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Award RFQ — ${rfq.rfqNumber}`} onClose={onClose}>
      {/* Tab bar */}
      <div className="flex border-b px-6">
        {(['select', 'compare'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'select' ? 'Select Vendor' : 'Compare Quotes'}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg mx-6 mt-3 px-3 py-2">{err}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 px-6 py-4">Loading vendor quotes…</p>
      ) : activeTab === 'compare' ? (
        <div className="max-h-[60vh] overflow-y-auto">
          <CompareQuotesView
            rfq={rfq}
            quotes={quotes}
            canApprove={canApprove}
            onAward={async vendorId => {
              setBusy(true); setErr('');
              try {
                await rfqApi.award(rfq.id, vendorId);
                toast.success('RFQ awarded successfully.');
                onDone();
              } catch (e: any) {
                setErr(e?.response?.data ?? e?.message ?? 'Failed to award RFQ.');
              } finally { setBusy(false); }
            }}
          />
        </div>
      ) : (
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {quotes.length === 0 ? (
            <p className="text-sm text-amber-600">No vendor quotes submitted for this RFQ yet.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Select vendor to award (sorted cheapest first):</p>
              {quotes.map((q, idx) => (
                <div key={q.id} className={`border rounded-lg overflow-hidden transition-colors ${selectedVendorId === q.vendorId ? 'border-green-500' : 'border-gray-200'}`}>
                  <label className={`flex items-center justify-between p-3 cursor-pointer ${selectedVendorId === q.vendorId ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input type="radio" name="vendor" value={q.vendorId}
                        checked={selectedVendorId === q.vendorId}
                        onChange={() => setSelectedVendorId(q.vendorId)}
                        className="accent-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {q.vendor?.name ?? q.vendorId}
                          {idx === 0 && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Lowest</span>}
                        </p>
                        <p className="text-xs text-gray-500">Quote #{q.quoteNumber} · {q.quoteStatus}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">₹{(q.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {q.rankPosition && <p className="text-xs text-gray-400">Rank #{q.rankPosition}</p>}
                      </div>
                      {q.items && q.items.length > 0 && (
                        <button type="button"
                          onClick={e => { e.preventDefault(); setExpandedQuoteId(expandedQuoteId === q.id ? null : q.id); }}
                          className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap">
                          {expandedQuoteId === q.id ? 'Hide items' : `${q.items.length} items`}
                        </button>
                      )}
                    </div>
                  </label>
                  {expandedQuoteId === q.id && q.items && q.items.length > 0 && (
                    <div className="border-t bg-gray-50 px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-1 pr-2 font-medium">Item</th>
                            <th className="text-right py-1 pr-2 font-medium">Qty</th>
                            <th className="text-right py-1 pr-2 font-medium">Unit Price</th>
                            <th className="text-right py-1 pr-2 font-medium">GST%</th>
                            <th className="text-right py-1 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {q.items.map(item => (
                            <tr key={item.id} className="text-gray-700">
                              <td className="py-1 pr-2 truncate max-w-[140px]">{item.item?.itemName ?? item.itemId}</td>
                              <td className="py-1 pr-2 text-right">{item.quotedQty}</td>
                              <td className="py-1 pr-2 text-right">₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-1 pr-2 text-right">{item.gstPercent}%</td>
                              <td className="py-1 text-right font-medium">₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {q.vendorNotes && <p className="mt-1.5 text-xs text-gray-500 italic">Note: {q.vendorNotes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        {activeTab === 'select' && (
          <button onClick={submit} disabled={busy || !selectedVendorId || loading}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
            {busy ? 'Awarding…' : 'Award Vendor'}
          </button>
        )}
      </div>
    </Modal>
  );
}

function CancelRfqModal({ rfqNumber, onClose, onConfirm, busy }: { rfqNumber: string; onClose: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Cancel RFQ — ${rfqNumber}`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">This action cannot be undone. Please provide a reason for cancellation.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Budget constraints, requirements changed…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Back</button>
        <button onClick={() => onConfirm(reason)} disabled={busy || reason.trim().length < 5}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">
          {busy ? 'Cancelling…' : 'Confirm Cancel'}
        </button>
      </div>
    </Modal>
  );
}

type PoLineItem = { itemId: string; itemName: string; orderedQty: number; unitPrice: number; gstPercent: number; unit: string };

function CreatePoFromRfqModal({ rfq, vendorMap, onClose, onDone }: { rfq: any; vendorMap: Record<string, string>; onClose: () => void; onDone: (poNumber: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<PoLineItem[]>([]);
  const [fromQuote, setFromQuote] = useState(false);
  const [quoteRef, setQuoteRef] = useState('');
  const [resolvedVendorName, setResolvedVendorName] = useState<string>('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const { terms: paymentTerms } = usePaymentTerms();
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.allSettled([rfqApi.getQuotes(rfq.id), rfqApi.get(rfq.id)])
      .then(([quotesResult, detailResult]) => {
        const quotes: VendorQuoteDto[] = quotesResult.status === 'fulfilled' ? (quotesResult.value ?? []) : [];
        const detail: any = detailResult.status === 'fulfilled' ? detailResult.value : null;

        if (quotesResult.status === 'rejected' && detailResult.status === 'rejected') {
          setErr('Failed to load RFQ details. Please close and try again.');
          return;
        }

        // Resolve vendor name: detail response → vendorMap → invite list → fallback to ID
        const vid = rfq.awardedToVendorId;
        if (vid) {
          if (detail?.awardedToVendorName) {
            setResolvedVendorName(detail.awardedToVendorName);
          } else {
            const fromMap = vendorMap[vid];
            if (fromMap) {
              setResolvedVendorName(fromMap);
            } else if (detail?.vendorInvites) {
              const inv = detail.vendorInvites.find((v: any) => v.vendorId === vid);
              setResolvedVendorName(inv?.vendor?.name ?? vid);
            } else {
              setResolvedVendorName(vid);
            }
          }
        }

        const won = quotes.find(q => q.quoteStatus === 'Won');
        if (won && won.items && won.items.length > 0) {
          setFromQuote(true);
          setQuoteRef(`Quote #${won.quoteNumber}`);
          setLineItems(won.items.map(i => ({
            itemId: i.itemId,
            itemName: i.item?.itemName ?? i.itemId,
            orderedQty: i.quotedQty,
            unitPrice: i.unitPrice,
            gstPercent: i.gstPercent,
            unit: 'Nos',
          })));
        } else if (detail?.items && detail.items.length > 0) {
          setFromQuote(false);
          setLineItems(detail.items.map((i: any) => ({
            itemId: i.itemId,
            itemName: i.item?.itemName ?? i.itemId,
            orderedQty: i.requestedQty,
            unitPrice: 0,
            gstPercent: 0,
            unit: i.unit,
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [rfq.id, rfq.awardedToVendorId, vendorMap]);

  const updateLine = (idx: number, field: keyof PoLineItem, value: string | number) => {
    setLineItems(prev => { const n = [...prev]; (n[idx] as any)[field] = value; return n; });
  };

  const netAmount = lineItems.reduce((s, i) => s + i.orderedQty * i.unitPrice * (1 + i.gstPercent / 100), 0);
  const allPricesFilled = lineItems.length === 0 || lineItems.every(i => i.unitPrice > 0);
  const canSubmit = !busy && !loading && !!expectedDelivery && allPricesFilled;

  const submit = async () => {
    if (!expectedDelivery) { setErr('Expected delivery date is required.'); return; }
    if (lineItems.some(i => i.unitPrice <= 0)) { setErr('All items must have a unit price greater than zero.'); return; }
    setBusy(true); setErr('');
    try {
      const result = await purchaseOrderApi.create({
        branchId: rfq.branchId,
        vendorId: rfq.awardedToVendorId,
        vendorName: resolvedVendorName || undefined,
        sourceType: 'RFQ',
        rfqId: rfq.id,
        expectedDeliveryDate: new Date(expectedDelivery).toISOString(),
        isEmergency,
        terms: terms || undefined,
        notes: notes || undefined,
        items: lineItems.map(i => ({
          itemId: i.itemId,
          itemName: i.itemName,
          orderedQty: i.orderedQty,
          unitPrice: i.unitPrice,
          gstPercent: i.gstPercent,
          unit: i.unit,
        })),
      });
      toast.success(`PO ${result.poNumber} created successfully.`);
      onDone(result.poNumber);
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? 'Failed to create PO.');
    } finally { setBusy(false); }
  };

  const vendorName = resolvedVendorName || rfq.awardedToVendorId || '—';

  return (
    <Modal title={`Create Purchase Order — ${rfq.rfqNumber}`} onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        {loading ? (
          <p className="text-sm text-gray-500">Loading RFQ details…</p>
        ) : (
          <>
            {/* Vendor summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm text-green-800 font-semibold">Awarded Vendor: {vendorName}</p>
              <p className="text-xs text-green-700 mt-0.5">
                {fromQuote
                  ? `Prices sourced from ${quoteRef} · Net total: ₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : lineItems.length > 0
                    ? `${lineItems.length} items from RFQ — enter unit prices below.`
                    : 'No line items on this RFQ. Fill in delivery details and submit.'}
              </p>
            </div>

            {/* Line items table */}
            {lineItems.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase">Item</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 uppercase">Unit Price ₹</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 uppercase">GST%</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 uppercase">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item, idx) => {
                      const lineTotal = item.orderedQty * item.unitPrice * (1 + item.gstPercent / 100);
                      return (
                        <tr key={item.itemId}>
                          <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate">{item.itemName}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.orderedQty}</td>
                          <td className="px-3 py-2 text-right">
                            {fromQuote ? (
                              <span className="text-gray-700">₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            ) : (
                              <input
                                type="number" min={0.01} step={0.01} value={item.unitPrice || ''}
                                onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className={`w-24 border rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${item.unitPrice <= 0 ? 'border-red-400' : 'border-gray-300'}`}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {fromQuote ? (
                              <span className="text-gray-600">{item.gstPercent}%</span>
                            ) : (
                              <input
                                type="number" min={0} max={28} step={0.5} value={item.gstPercent || ''}
                                onChange={e => updateLine(idx, 'gstPercent', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">
                            {item.unitPrice > 0 ? `₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Net Total</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* PO fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date <span className="text-red-500">*</span></label>
                <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select payment terms…</option>
                  {paymentTerms.map((t) => (
                    <option key={t.value} value={t.label}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes for this PO…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)} className="rounded accent-red-500" />
                  <span className="text-sm text-gray-700">Mark as Emergency Purchase</span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={!canSubmit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Creating PO…' : 'Create Purchase Order'}
        </button>
      </div>
    </Modal>
  );
}

// ── RecordAcknowledgmentModal ─────────────────────────────────────────────────
const CHANNELS: { value: AckChannel; label: string; icon: React.ReactNode }[] = [
  { value: 'Email',     label: 'Email',     icon: <Mail className="w-4 h-4" /> },
  { value: 'WhatsApp',  label: 'WhatsApp',  icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'SMS',       label: 'SMS',       icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'Call',      label: 'Call',      icon: <Phone className="w-4 h-4" /> },
  { value: 'Other',     label: 'Other',     icon: <FileText className="w-4 h-4" /> },
];

function RecordAcknowledgmentModal({ rfq, vendorName, onClose, onDone }: {
  rfq: { id: string; rfqNumber: string; awardedToVendorId?: string };
  vendorName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [ack, setAck] = useState<VendorAcknowledgmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'Acknowledged' | 'Declined'>('Acknowledged');
  const [channel, setChannel] = useState<AckChannel>('Call');
  const [contactTarget, setContactTarget] = useState('');
  const [ackNotes, setAckNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    vendorAckApi.getByEntity('RfqAward', rfq.id)
      .then(a => setAck(a))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rfq.id]);

  const submit = async () => {
    if (!channel) { setErr('Select how the vendor was contacted.'); return; }
    if (status === 'Declined' && !declineReason.trim()) { setErr('Enter the vendor\'s decline reason.'); return; }
    setBusy(true); setErr('');
    try {
      let target = ack;
      if (!target) {
        // Auto-create if somehow missing (shouldn't happen after backend change)
        target = await vendorAckApi.create(rfq.awardedToVendorId!, 'RfqAward', rfq.id, 72);
      }
      await vendorAckApi.confirm(target.id, status, channel, contactTarget || undefined, ackNotes || undefined, declineReason || undefined);
      toast.success(status === 'Acknowledged' ? 'Vendor confirmation recorded — PO can now be sent to vendor.' : 'Decline recorded.');
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? 'Failed to record confirmation.');
    } finally { setBusy(false); }
  };

  const alreadyDone = ack && ack.ackStatus !== 'Pending';

  return (
    <Modal title={`Record Vendor Confirmation — ${rfq.rfqNumber}`} onClose={onClose}>
      <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
        {/* Info banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <p className="font-semibold">Awarded Vendor: {vendorName}</p>
          <p className="text-xs mt-0.5 text-green-700">
            Contact the vendor to confirm they have received and accepted the award.
            This confirmation is required before the PO can be sent.
          </p>
        </div>

        {loading && <p className="text-sm text-gray-400 animate-pulse">Loading acknowledgment status…</p>}

        {!loading && alreadyDone && (
          <div className={`rounded-lg p-4 text-sm font-medium ${ack.ackStatus === 'Acknowledged' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            This RFQ award was already {ack.ackStatus.toLowerCase()} via {ack.channel ?? '—'}
            {ack.acknowledgedAt ? ` on ${new Date(ack.acknowledgedAt).toLocaleString('en-IN')}` : ''}.
            {ack.ackNotes && <p className="mt-1 text-xs font-normal">Notes: {ack.ackNotes}</p>}
          </div>
        )}

        {!loading && !alreadyDone && (
          <>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

            {/* Outcome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Response</label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 border-2 rounded-lg px-4 py-3 cursor-pointer transition-colors ${status === 'Acknowledged' ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="ack-status" value="Acknowledged"
                    checked={status === 'Acknowledged'} onChange={() => setStatus('Acknowledged')}
                    className="accent-green-600" />
                  <span className="text-sm font-medium">Accepted / Confirmed</span>
                </label>
                <label className={`flex-1 flex items-center gap-2 border-2 rounded-lg px-4 py-3 cursor-pointer transition-colors ${status === 'Declined' ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="ack-status" value="Declined"
                    checked={status === 'Declined'} onChange={() => setStatus('Declined')}
                    className="accent-red-600" />
                  <span className="text-sm font-medium">Declined</span>
                </label>
              </div>
            </div>

            {/* Channel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">How was the vendor contacted? <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-5 gap-2">
                {CHANNELS.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => setChannel(c.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${channel === c.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {c.icon}{c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact detail (optional)</label>
              <input value={contactTarget} onChange={e => setContactTarget(e.target.value)}
                placeholder={channel === 'Email' ? 'vendor@example.com' : channel === 'Call' || channel === 'WhatsApp' || channel === 'SMS' ? '+91 98765 43210' : 'Reference / ID'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Decline reason */}
            {status === 'Declined' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decline reason <span className="text-red-500">*</span></label>
                <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2}
                  placeholder="Why did the vendor decline the award?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={ackNotes} onChange={e => setAckNotes(e.target.value)} rows={2}
                placeholder="Call summary, PO reference number shared, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
          {alreadyDone ? 'Close' : 'Cancel'}
        </button>
        {!loading && !alreadyDone && (
          <button onClick={submit} disabled={busy}
            className={`px-5 py-2 text-sm rounded-lg font-medium disabled:opacity-50 text-white ${status === 'Acknowledged' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {busy ? 'Saving…' : status === 'Acknowledged' ? 'Record Confirmation' : 'Record Decline'}
          </button>
        )}
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ── RfqHistoryModal ───────────────────────────────────────────────────────────
function RfqHistoryModal({ rfq, onClose }: { rfq: any; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rfqApi.getHistory(rfq.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [rfq.id]);

  return (
    <Modal title={`History — ${rfq.rfqNumber}`} onClose={onClose}>
      <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400">No history yet.</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-6 pl-4">
            {logs.map((l, i) => (
              <li key={l.id ?? i} className="ml-2">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-400 border-2 border-white" />
                <p className="text-xs text-gray-400">{new Date(l.transitionedAt).toLocaleString('en-IN')}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  {l.fromStatus ? <><span className="text-gray-500">{l.fromStatus}</span> <ArrowRight className="inline w-3 h-3" /> </> : null}
                  <span className="text-blue-700">{l.toStatus}</span>
                </p>
                {l.reason && <p className="text-xs text-gray-500 mt-0.5 italic">{l.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="px-6 py-3 border-t flex justify-end">
        <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">Close</button>
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── NegotiationModal ──────────────────────────────────────────────────────────
function NegotiationModal({ rfq, mode, onClose, onDone }: {
  rfq: any;
  mode: 'request' | 'resolve' | 'reject-approval';
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const config = {
    'request':         { title: 'Request Negotiation',   label: 'Request',   action: () => rfqApi.requestNegotiation(rfq.id, reason) },
    'resolve':         { title: 'Resolve Negotiation',   label: 'Resolve',   action: () => rfqApi.resolveNegotiation(rfq.id, reason) },
    'reject-approval': { title: 'Reject Approval',       label: 'Reject',    action: () => rfqApi.rejectApproval(rfq.id, reason) },
  }[mode];

  const submit = async () => {
    if (!reason.trim()) { toast.error('Please enter a reason.'); return; }
    setBusy(true);
    try {
      await config.action();
      toast.success(`${config.title} successful.`);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data ?? e?.message ?? `${config.title} failed.`);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`${config.title} — ${rfq.rfqNumber}`} onClose={onClose}>
      <div className="px-6 py-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Reason / Notes</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter reason…" />
      </div>
      <div className="px-6 py-3 border-t flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Saving…' : config.label}
        </button>
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── SubmitApprovalModal ───────────────────────────────────────────────────────
function SubmitApprovalModal({ rfq, onClose, onDone }: {
  rfq: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState<string>('');
  const [quotes, setQuotes] = useState<VendorQuoteDto[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rfqApi.getQuotes(rfq.id)
      .then(q => {
        const eligible = (q ?? []).filter((x: VendorQuoteDto) => x.quoteStatus !== 'Disqualified');
        setQuotes(eligible);
        if (eligible.length === 1) setVendorId(eligible[0].vendorId);
      })
      .catch(() => {})
      .finally(() => setLoadingQuotes(false));
  }, [rfq.id]);

  const submit = async () => {
    if (!vendorId) { toast.error('Select a vendor to propose.'); return; }
    setBusy(true);
    try {
      await rfqApi.submitForApproval(rfq.id, vendorId);
      toast.success('Submitted for final approval.');
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data ?? e?.message ?? 'Submit failed.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Submit for Approval — ${rfq.rfqNumber}`} onClose={onClose}>
      <div className="px-6 py-4 space-y-3">
        <p className="text-sm text-gray-600">Select the proposed vendor to forward to the Inventory Manager for final approval.</p>
        <label className="block text-sm font-medium text-gray-700">Proposed Vendor</label>
        {loadingQuotes ? (
          <p className="text-sm text-gray-400">Loading quotes…</p>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-red-500">No eligible vendor quotes found for this RFQ.</p>
        ) : (
          <select value={vendorId} onChange={e => setVendorId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Select vendor —</option>
            {quotes.map(q => (
              <option key={q.vendorId} value={q.vendorId}>
                {q.vendor?.name ?? q.vendorId} — ₹{(q.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="px-6 py-3 border-t flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button onClick={submit} disabled={busy || loadingQuotes || quotes.length === 0 || !vendorId}
          className="px-5 py-2 text-sm bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50">
          {busy ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const APPROVE_ROLES = new Set(['INVENTORY MANAGER', 'PURCHASE MANAGER', 'SYSTEM ADMIN', 'SUPER ADMIN', 'SYSTEM ADMINISTRATOR', 'SUPER ADMINISTRATOR', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'HOSPITAL OWNER', 'CHIEF EXECUTIVE OFFICER']);
const CREATE_ROLES  = new Set(['INVENTORY MANAGER', 'INVENTORY STAFF', 'PURCHASE MANAGER', 'STORE KEEPER', 'OPTICAL MANAGER', 'PHARMACY TECHNICIAN', 'SYSTEM ADMIN', 'SUPER ADMIN', 'SYSTEM ADMINISTRATOR', 'SUPER ADMINISTRATOR', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'HOSPITAL OWNER', 'CHIEF EXECUTIVE OFFICER']);

export default function RFQPage() {
  const { roles } = useAuthStore();
  const canApprove = roles.length === 0 || roles.some(r => APPROVE_ROLES.has(r.toUpperCase()));
  const canCreate  = roles.length === 0 || roles.some(r => CREATE_ROLES.has(r.toUpperCase()));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [awardRfq, setAwardRfq] = useState<any | null>(null);
  const [vendorMap, setVendorMap] = useState<Record<string, string>>({});
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [createPoRfq, setCreatePoRfq] = useState<any | null>(null);
  const [ackRfq, setAckRfq] = useState<{ id: string; rfqNumber: string; awardedToVendorId?: string; vendorName: string } | null>(null);
  const [historyRfq, setHistoryRfq] = useState<any | null>(null);
  const [negotiationRfq, setNegotiationRfq] = useState<any | null>(null);
  const [approvalRfq, setApprovalRfq] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await rfqApi.list({ pageSize: 100 }); setRows(d.items ?? []); }
    catch (err: any) { setError(err?.response?.data ?? err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    inventoryVendorApi.list({ pageSize: 500 }).then(r => {
      const m: Record<string, string> = {};
      (r.items ?? []).forEach((v: VendorDto) => { m[v.id] = v.name; });
      setVendorMap(m);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() =>
    rows.filter(r => statusTab === 'All' || r.rfqStatus === statusTab)
        .filter(r => !search || r.rfqNumber?.toLowerCase().includes(search.toLowerCase()) || r.title?.toLowerCase().includes(search.toLowerCase())),
    [rows, statusTab, search]);

  const doAction = async (id: string, action: () => Promise<unknown>, label: string) => {
    setActing(id + label);
    try { await action(); toast.success(`${label} successful.`); await load(); }
    catch (err: any) { toast.error(err?.response?.data ?? err?.message ?? `${label} failed.`); await load(); }
    finally { setActing(null); }
  };

  const doCancel = async (id: string, reason: string) => {
    setCancelBusy(true);
    try { await rfqApi.cancel(id, reason); toast.success('RFQ cancelled.'); await load(); setCancelTarget(null); }
    catch (e: any) { toast.error(e?.response?.data ?? e?.message ?? 'Cancel failed.'); }
    finally { setCancelBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotation (RFQ)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Competitive vendor quotation management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New RFQ
          </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatusTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
              ${statusTab === t.key ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by RFQ # or title…"
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={load} className="text-red-700 text-xs underline font-medium">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['RFQ #', 'Title', 'Status', 'Deadline', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) :
             filtered.length === 0 ? (
               <tr><td colSpan={6} className="px-4 py-16 text-center">
                 <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm">No RFQs found</p>
               </td></tr>
             ) : filtered.map(r => (
               <tr key={r.id} className={`border-l-4 ${STATUS_BORDER[r.rfqStatus] ?? 'border-l-transparent'} hover:bg-gray-50 transition-colors`}>
                 <td className="px-4 py-3 font-mono font-semibold text-xs text-blue-600">{r.rfqNumber}</td>
                 <td className="px-4 py-3 max-w-[200px]">
                   <p className="text-xs text-gray-700 truncate font-medium" title={r.title}>{r.title}</p>
                   {r.rfqStatus === 'Awarded' && r.awardedToVendorId && (
                     <p className="text-xs text-green-700 truncate mt-0.5">Awarded to: {r.awardedToVendorName ?? vendorMap[r.awardedToVendorId] ?? '—'}</p>
                   )}
                   {r.rfqStatus === 'Cancelled' && r.cancellationReason && (
                     <p className="text-xs text-red-500 truncate mt-0.5" title={r.cancellationReason}>
                       Reason: {r.cancellationReason.length > 50 ? r.cancellationReason.slice(0, 50) + '…' : r.cancellationReason}
                     </p>
                   )}
                 </td>
                 <td className="px-4 py-3"><StatusBadge status={r.rfqStatus} /></td>
                 <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.responseDeadline)}</td>
                 <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.createdAt)}</td>
                 <td className="px-4 py-3">
                   <div className="flex items-center gap-1 flex-wrap">
                     {r.rfqStatus === 'Draft' && (
                       <button onClick={() => doAction(r.id, () => rfqApi.publish(r.id), 'Publish')}
                         disabled={acting === r.id + 'Publish'}
                         className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                         <Eye className="w-3 h-3" /> Publish
                       </button>
                     )}
                     {r.rfqStatus === 'Published' && (
                       <button onClick={() => doAction(r.id, () => rfqApi.closeResponseWindow(r.id), 'Close Window')}
                         disabled={acting === r.id + 'Close Window' || !canApprove}
                         className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50">
                         <CheckCircle className="w-3 h-3" /> Close Window
                       </button>
                     )}
                     {r.rfqStatus === 'ResponseWindowClosed' && (
                       <button onClick={() => doAction(r.id, () => rfqApi.startEvaluation(r.id), 'Start Eval')}
                         disabled={acting === r.id + 'Start Eval'}
                         className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                         <CheckCircle className="w-3 h-3" /> Start Eval
                       </button>
                     )}
                     {r.rfqStatus === 'EvaluationInProgress' && (
                       <>
                         <button onClick={() => setApprovalRfq(r)}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700">
                           <ArrowRight className="w-3 h-3" /> Submit for Approval
                         </button>
                         <button onClick={() => setNegotiationRfq({ ...r, mode: 'request' })}
                           disabled={!canApprove}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">
                           <MessageSquare className="w-3 h-3" /> Negotiate
                         </button>
                       </>
                     )}
                     {r.rfqStatus === 'NegotiationRequired' && (
                       <button onClick={() => setNegotiationRfq({ ...r, mode: 'resolve' })}
                         className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">
                         <CheckCircle className="w-3 h-3" /> Resolve Negotiation
                       </button>
                     )}
                     {r.rfqStatus === 'PendingFinalApproval' && (
                       <>
                         <button onClick={() => setAwardRfq(r)}
                           disabled={!canApprove}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                           <Award className="w-3 h-3" /> Approve &amp; Award
                         </button>
                         <button onClick={() => setNegotiationRfq({ ...r, mode: 'reject-approval' })}
                           disabled={!canApprove}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                           <Ban className="w-3 h-3" /> Reject
                         </button>
                       </>
                     )}
                     {r.rfqStatus === 'Awarded' && (() => {
                       const awardConfirmed = r.awardAcknowledgmentStatus && r.awardAcknowledgmentStatus !== 'Pending';
                       const hasActivePo    = !!r.linkedPurchaseOrderId;
                       const ackLabel = r.awardAcknowledgmentStatus === 'Acknowledged' ? 'Award Confirmed'
                         : r.awardAcknowledgmentStatus === 'Declined' ? 'Award Declined'
                         : 'Confirm Award';
                       const poLabel = hasActivePo
                         ? `PO ${r.linkedPurchaseOrderNumber ?? ''} Created`
                         : 'Create PO';
                       return (
                         <>
                           <button onClick={() => setAckRfq({ id: r.id, rfqNumber: r.rfqNumber, awardedToVendorId: r.awardedToVendorId, vendorName: r.awardedToVendorName ?? vendorMap[r.awardedToVendorId ?? ''] ?? '—' })}
                             disabled={!canApprove || !!awardConfirmed}
                             className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
                             <CheckCircle className="w-3 h-3" /> {ackLabel}
                           </button>
                           <button onClick={() => setCreatePoRfq(r)}
                             disabled={hasActivePo}
                             className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                             <ShoppingCart className="w-3 h-3" /> {poLabel}
                           </button>
                           <button onClick={() => doAction(r.id, () => rfqApi.close(r.id), 'Close RFQ')}
                             disabled={acting === r.id + 'Close RFQ' || !canApprove}
                             className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50">
                             <Lock className="w-3 h-3" /> Close RFQ
                           </button>
                         </>
                       );
                     })()}
                     {(r.rfqStatus === 'Draft' || r.rfqStatus === 'Published') && (
                       <button onClick={() => setCancelTarget(r)}
                         className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                         <Ban className="w-3 h-3" /> Cancel
                       </button>
                     )}
                     <button onClick={() => setHistoryRfq(r)}
                       className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded hover:bg-gray-200" title="View history">
                       <History className="w-3 h-3" />
                     </button>
                   </div>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateRFQModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast.success('RFQ created!'); }} />
      )}
      {awardRfq && (
        <AwardVendorModal rfq={awardRfq} canApprove={canApprove} onClose={() => setAwardRfq(null)} onDone={() => { setAwardRfq(null); load(); }} />
      )}
      {cancelTarget && (
        <CancelRfqModal
          rfqNumber={cancelTarget.rfqNumber}
          onClose={() => setCancelTarget(null)}
          onConfirm={reason => doCancel(cancelTarget.id, reason)}
          busy={cancelBusy}
        />
      )}
      {createPoRfq && (
        <CreatePoFromRfqModal
          rfq={createPoRfq}
          vendorMap={vendorMap}
          onClose={() => setCreatePoRfq(null)}
          onDone={() => { setCreatePoRfq(null); load(); }}
        />
      )}
      {ackRfq && (
        <RecordAcknowledgmentModal
          rfq={ackRfq}
          vendorName={ackRfq.vendorName}
          onClose={() => setAckRfq(null)}
          onDone={() => { setAckRfq(null); load(); }}
        />
      )}
      {historyRfq && (
        <RfqHistoryModal rfq={historyRfq} onClose={() => setHistoryRfq(null)} />
      )}
      {negotiationRfq && (
        <NegotiationModal
          rfq={negotiationRfq}
          mode={negotiationRfq.mode}
          onClose={() => setNegotiationRfq(null)}
          onDone={() => { setNegotiationRfq(null); load(); }}
        />
      )}
      {approvalRfq && (
        <SubmitApprovalModal
          rfq={approvalRfq}
          onClose={() => setApprovalRfq(null)}
          onDone={() => { setApprovalRfq(null); load(); }}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Search, Receipt, X, CheckCircle, CreditCard, Ban } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  inventoryBillApi,
  inventoryPharmacyApi,
  inventoryStockApi,
  StockBatchDto,
} from '@/lib/api/inventory-service.api';
import { useStores } from '@/hooks/useInventoryReferenceData';
import { useInventoryPaymentModeLabels } from '@/hooks/use-payment-modes';

const STATUS_TABS = [
  { key: 'All',             label: 'All',              dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Draft',           label: 'Draft',            dot: 'bg-amber-400',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'StockValidated',  label: 'Stock Validated',  dot: 'bg-blue-400',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'Billed',          label: 'Billed',           dot: 'bg-purple-400',  activeClass: 'bg-purple-600 border-purple-600 text-white' },
  { key: 'PaidOrSettled',   label: 'Paid / Settled',   dot: 'bg-green-400',   activeClass: 'bg-green-600 border-green-600 text-white' },
  { key: 'Cancelled',       label: 'Cancelled',        dot: 'bg-red-400',     activeClass: 'bg-red-500 border-red-500 text-white' },
];

const STATUS_BORDER: Record<string, string> = {
  Draft: 'border-l-amber-400', StockValidated: 'border-l-blue-400',
  Billed: 'border-l-purple-400', PaidOrSettled: 'border-l-green-500', Cancelled: 'border-l-red-400',
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  Draft:           { bg: 'bg-amber-100 text-amber-700',   label: 'Draft'           },
  StockValidated:  { bg: 'bg-blue-100 text-blue-700',     label: 'Stock Validated' },
  Billed:          { bg: 'bg-purple-100 text-purple-700', label: 'Billed'          },
  PaidOrSettled:   { bg: 'bg-green-100 text-green-700',   label: 'Paid'            },
  Cancelled:       { bg: 'bg-red-100 text-red-700',       label: 'Cancelled'       },
};

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function fmtINR(n?: number | null) {
  return '\u20B9' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function SkeletonRow() {
  return (
    <tr>{[130, 100, 100, 80, 90, 90, 80, 90].map((w, i) => (
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateBillModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: allStores = [] } = useStores();
  const stores = allStores.filter(x => x.storeType === 'Pharmacy' || x.storeType === 'Central');
  const [batches, setBatches] = useState<StockBatchDto[]>([]);
  const [storeId, setStoreId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<{ stockBatchId: string; itemName: string; batchNumber: string; available: number; quantity: number; unitPrice: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId) { setBatches([]); return; }
    inventoryStockApi.getBatches(storeId).then(b => setBatches(b ?? [])).catch(() => setBatches([]));
  }, [storeId]);

  const addLine = (batch: StockBatchDto) => {
    if (lines.some(l => l.stockBatchId === batch.id)) return;
    setLines(prev => [...prev, { stockBatchId: batch.id, itemName: batch.itemName, batchNumber: batch.batchNumber ?? '', available: batch.quantityAvailable, quantity: 1, unitPrice: 0 }]);
  };

  const submit = async () => {
    if (!storeId) { setError('Select a store.'); return; }
    if (lines.length === 0) { setError('Add at least one item.'); return; }
    setBusy(true); setError('');
    try {
      await inventoryBillApi.create({
        storeId, patientId: patientId || undefined, patientName: patientName || undefined,
        patientAge: patientAge ? parseInt(patientAge) : undefined,
        billDate,
        items: lines.map(l => ({ stockBatchId: l.stockBatchId, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to create bill.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="New Pharmacy Bill" onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store <span className="text-red-500">*</span></label>
            <select value={storeId} onChange={e => { setStoreId(e.target.value); setLines([]); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.storeName} ({s.storeType})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
            <input type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {storeId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Item (FEFO Order)</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              onChange={e => { const b = batches.find(x => x.id === e.target.value); if (b) addLine(b); (e.target as HTMLSelectElement).value = ''; }}>
              <option value="">— Select item batch (earliest expiry first) —</option>
              {batches.filter(b => b.quantityAvailable > 0).map(b => (
                <option key={b.id} value={b.id}>
                  {b.itemName} | Batch {b.batchNumber} | Exp: {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : 'N/A'} | Avail: {b.quantityAvailable}
                </option>
              ))}
            </select>
          </div>
        )}
        {lines.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Item', 'Batch', 'Qty', 'Unit Price', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{l.itemName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{l.batchNumber}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} max={l.available} value={l.quantity}
                        onChange={e => setLines(prev => { const n = [...prev]; n[i] = { ...n[i], quantity: Math.min(parseInt(e.target.value) || 1, l.available) }; return n; })}
                        className="border rounded px-2 py-1 w-20 text-center text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} step={0.01} value={l.unitPrice}
                        onChange={e => setLines(prev => { const n = [...prev]; n[i] = { ...n[i], unitPrice: parseFloat(e.target.value) || 0 }; return n; })}
                        className="border rounded px-2 py-1 w-24 text-right text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-gray-50 border-t flex justify-end">
              <span className="text-sm font-semibold text-gray-700">
                Total: {fmtINR(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy || lines.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Creating…' : 'Create Bill'}
        </button>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ billId, onClose, onDone }: { billId: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!amount || amount <= 0) { setError('Enter a valid amount.'); return; }
    setBusy(true); setError('');
    try {
      await inventoryPharmacyApi.recordBillPayment(billId, { amount, paymentMode, remarks: remarks || undefined });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Payment failed.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
            <input type="number" min={0.01} step={0.01} value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {paymentModeLabels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <input value={remarks} onChange={e => setRemarks(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
          {busy ? 'Recording…' : 'Record Payment'}
        </button>
      </div>
    </Modal>
  );
}

export default function PharmacyPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await inventoryBillApi.list({ pageSize: 100 }); setRows((d as any).items ?? d ?? []); }
    catch (err: any) { setError(err?.response?.data ?? err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    rows.filter(r => statusTab === 'All' || r.billStatus === statusTab || r.status === statusTab)
        .filter(r => !search || r.billNumber?.toLowerCase().includes(search.toLowerCase()) || r.patientName?.toLowerCase().includes(search.toLowerCase())),
    [rows, statusTab, search]);

  const doAction = async (id: string, action: () => Promise<unknown>, label: string) => {
    setActing(id + label);
    try { await action(); toast.success(`${label} successful.`); await load(); }
    catch (err: any) { toast.error(err?.response?.data ?? err?.message ?? `${label} failed.`); }
    finally { setActing(null); }
  };

  const getStatus = (r: any) => r.billStatus ?? r.status ?? 'Draft';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Bills</h1>
          <p className="text-sm text-gray-500 mt-0.5">Patient billing with FEFO stock dispensing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Bill
          </button>
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by bill# or patient…"
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
              {['Bill #', 'Patient', 'Store', 'Status', 'Bill Date', 'Total', 'Balance', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) :
             filtered.length === 0 ? (
               <tr><td colSpan={8} className="px-4 py-16 text-center">
                 <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm">No pharmacy bills found</p>
               </td></tr>
             ) : filtered.map(r => {
               const status = getStatus(r);
               return (
                 <tr key={r.id} className={`border-l-4 ${STATUS_BORDER[status] ?? 'border-l-transparent'} hover:bg-gray-50 transition-colors`}>
                   <td className="px-4 py-3 font-mono font-semibold text-xs">{r.billNumber ?? r.id?.slice(0, 8)}</td>
                   <td className="px-4 py-3 text-gray-700 text-xs">{r.patientName ?? '—'}</td>
                   <td className="px-4 py-3 text-gray-500 text-xs">{r.storeName ?? '—'}</td>
                   <td className="px-4 py-3"><StatusBadge status={status} /></td>
                   <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.billDate ?? r.createdAt)}</td>
                   <td className="px-4 py-3 text-right font-mono text-xs">{fmtINR(r.totalAmount ?? r.netAmount)}</td>
                   <td className="px-4 py-3 text-right font-mono text-xs text-red-600">{fmtINR(r.balanceAmount)}</td>
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-1 flex-wrap">
                       {(status === 'Draft' || status === 'StockValidated') && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.confirmBill(r.id), 'Confirm')}
                           disabled={acting === r.id + 'Confirm'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                           <CheckCircle className="w-3 h-3" /> Confirm
                         </button>
                       )}
                       {status === 'Billed' && (
                         <button onClick={() => setPayBillId(r.id)}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                           <CreditCard className="w-3 h-3" /> Pay
                         </button>
                       )}
                       {(status === 'Draft' || status === 'StockValidated') && (
                         <button onClick={() => doAction(r.id, () => inventoryBillApi.cancel(r.id), 'Cancel')}
                           disabled={acting === r.id + 'Cancel'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50">
                           <Ban className="w-3 h-3" /> Cancel
                         </button>
                       )}
                     </div>
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateBillModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast.success('Bill created!'); }} />
      )}
      {payBillId && (
        <RecordPaymentModal billId={payBillId} onClose={() => setPayBillId(null)} onDone={() => { setPayBillId(null); load(); toast.success('Payment recorded!'); }} />
      )}
    </div>
  );
}

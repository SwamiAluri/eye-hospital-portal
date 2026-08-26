'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Search, Stethoscope, X, CheckCircle, AlertTriangle, ArrowDownToLine, Package, Ban } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  inventoryPharmacyApi,
  inventoryItemApi,
  ItemDto,
} from '@/lib/api/inventory-service.api';
import { useStores, useInventoryItems } from '@/hooks/useInventoryReferenceData';

const STATUS_TABS = [
  { key: 'All',                  label: 'All',               dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Planned',              label: 'Planned',           dot: 'bg-amber-400',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'StockCheckPending',    label: 'Stock Check',       dot: 'bg-blue-400',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'StockAllocated',       label: 'Stock Allocated',   dot: 'bg-cyan-400',    activeClass: 'bg-cyan-600 border-cyan-600 text-white' },
  { key: 'EscalationRaised',     label: 'Escalated',         dot: 'bg-orange-400',  activeClass: 'bg-orange-500 border-orange-500 text-white' },
  { key: 'IssuedInOT',           label: 'Issued in OT',      dot: 'bg-purple-400',  activeClass: 'bg-purple-600 border-purple-600 text-white' },
  { key: 'ReturnPosted',         label: 'Return Posted',     dot: 'bg-teal-400',    activeClass: 'bg-teal-600 border-teal-600 text-white' },
  { key: 'Closed',               label: 'Closed',            dot: 'bg-green-400',   activeClass: 'bg-green-600 border-green-600 text-white' },
  { key: 'Cancelled',            label: 'Cancelled',         dot: 'bg-red-400',     activeClass: 'bg-red-500 border-red-500 text-white' },
];

const STATUS_BORDER: Record<string, string> = {
  Planned: 'border-l-amber-400', StockCheckPending: 'border-l-blue-400',
  StockAllocated: 'border-l-cyan-400', EscalationRaised: 'border-l-orange-400',
  IssuedInOT: 'border-l-purple-400', ReturnPosted: 'border-l-teal-400',
  Closed: 'border-l-green-500', Cancelled: 'border-l-red-400',
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  Planned:           { bg: 'bg-amber-100 text-amber-700',   label: 'Planned'          },
  StockCheckPending: { bg: 'bg-blue-100 text-blue-700',     label: 'Stock Check'      },
  StockAllocated:    { bg: 'bg-cyan-100 text-cyan-700',     label: 'Allocated'        },
  EscalationRaised:  { bg: 'bg-orange-100 text-orange-700', label: 'Escalated'        },
  IssuedInOT:        { bg: 'bg-purple-100 text-purple-700', label: 'Issued in OT'     },
  ReturnPosted:      { bg: 'bg-teal-100 text-teal-700',     label: 'Return Posted'    },
  Closed:            { bg: 'bg-green-100 text-green-700',   label: 'Closed'           },
  Cancelled:         { bg: 'bg-red-100 text-red-700',       label: 'Cancelled'        },
};

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function SkeletonRow() {
  return (
    <tr>{[130, 90, 90, 80, 90, 80, 110].map((w, i) => (
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

function PlanConsumableModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: allStores = [] } = useStores();
  const stores = allStores.filter(x => x.storeType === 'OT' || x.storeType === 'Central');
  const [itemSearch, setItemSearch] = useState('');
  const [querySearch, setQuerySearch] = useState<string | undefined>(undefined);
  const { data: items = [] } = useInventoryItems(querySearch);
  const [storeId, setStoreId] = useState('');
  const [surgeryId, setSurgeryId] = useState('');
  const [journeyId, setJourneyId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [surgeonId, setSurgeonId] = useState('');
  const [surgeryDate, setSurgeryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ itemId: string; itemName: string; quantity: number; unit: string; isPatientSpecific: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuerySearch(itemSearch || undefined), 300);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const addLine = (item: ItemDto) => {
    if (lines.some(l => l.itemId === item.id)) return;
    setLines(prev => [...prev, { itemId: item.id, itemName: item.itemName, quantity: 1, unit: item.unit ?? 'Nos', isPatientSpecific: false }]);
  };

  const submit = async () => {
    if (!storeId) { setError('Select a store.'); return; }
    if (!surgeryId.trim()) { setError('Enter a surgery ID.'); return; }
    if (!patientId.trim()) { setError('Enter a patient ID.'); return; }
    if (lines.length === 0) { setError('Add at least one consumable.'); return; }
    const journey = journeyId.trim();
    if (journey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journey)) {
      setError('IP Journey ID must be a UUID.');
      return;
    }
    setBusy(true); setError('');
    try {
      const parsedJourney = journey || undefined;
      await inventoryPharmacyApi.planConsumables({
        storeId,
        surgeryId,
        iolBillingMode: lines.some(l => l.isPatientSpecific) ? 'PatientSpecific' : 'Bulk',
        patientName: patientId.trim(),
        journeyId: parsedJourney,
        items: lines.map(l => ({ itemId: l.itemId, plannedQuantity: l.quantity })),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to plan consumables.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Plan Surgery Consumables" onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store (OT) <span className="text-red-500">*</span></label>
            <select value={storeId} onChange={e => setStoreId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select OT Store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.storeName} ({s.storeType})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surgery Date</label>
            <input type="date" value={surgeryDate} onChange={e => setSurgeryDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surgery ID <span className="text-red-500">*</span></label>
            <input value={surgeryId} onChange={e => setSurgeryId(e.target.value)} placeholder="Surgery reference ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IP Journey ID</label>
            <input value={journeyId} onChange={e => setJourneyId(e.target.value)} placeholder="Patient journey UUID — required to charge"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID <span className="text-red-500">*</span></label>
            <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Patient reference ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon ID</label>
            <input value={surgeonId} onChange={e => setSurgeonId(e.target.value)} placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search & Add Consumables</label>
          <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Type to search items…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            onChange={e => { const item = items.find(i => i.id === e.target.value); if (item) addLine(item); (e.target as HTMLSelectElement).value = ''; }}>
            <option value="">— Select consumable to add —</option>
            {items.map(it => <option key={it.id} value={it.id}>{it.itemName} ({it.unit})</option>)}
          </select>
        </div>
        {lines.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Item', 'Unit', 'Planned Qty', 'Patient-Specific', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
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
                      <input type="checkbox" checked={l.isPatientSpecific}
                        onChange={e => setLines(prev => { const n = [...prev]; n[i] = { ...n[i], isPatientSpecific: e.target.checked }; return n; })} />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy || lines.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Planning…' : 'Plan Consumables'}
        </button>
      </div>
    </Modal>
  );
}

export default function SurgeryConsumablesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await inventoryPharmacyApi.listConsumables({ pageSize: 100 });
      setRows((d as any).items ?? d ?? []);
    } catch (err: any) { setError(err?.response?.data ?? err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    rows.filter(r => statusTab === 'All' || r.consumableStatus === statusTab || r.status === statusTab)
        .filter(r => !search || r.consumableNumber?.toLowerCase().includes(search.toLowerCase()) || r.surgeryId?.toLowerCase().includes(search.toLowerCase())),
    [rows, statusTab, search]);

  const doAction = async (id: string, action: () => Promise<unknown>, label: string) => {
    setActing(id + label);
    try { await action(); toast.success(`${label} successful.`); await load(); }
    catch (err: any) { toast.error(err?.response?.data ?? err?.message ?? `${label} failed.`); }
    finally { setActing(null); }
  };

  const getStatus = (r: any) => r.consumableStatus ?? r.status ?? 'Planned';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surgery Consumables</h1>
          <p className="text-sm text-gray-500 mt-0.5">OT consumable planning and issue management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Plan Consumables
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by number or surgery ID…"
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
              {['#', 'Surgery ID', 'Patient', 'Charge', 'Status', 'Surgery Date', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) :
             filtered.length === 0 ? (
               <tr><td colSpan={7} className="px-4 py-16 text-center">
                 <Stethoscope className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm">No surgery consumable plans found</p>
               </td></tr>
             ) : filtered.map(r => {
               const status = getStatus(r);
               return (
                 <tr key={r.id} className={`border-l-4 ${STATUS_BORDER[status] ?? 'border-l-transparent'} hover:bg-gray-50 transition-colors`}>
                   <td className="px-4 py-3 font-mono text-xs">{r.consumableNumber ?? r.id?.slice(0, 8)}</td>
                   <td className="px-4 py-3 text-gray-600 text-xs font-mono">{r.surgeryId?.slice(0, 8) ?? '—'}…</td>
                   <td className="px-4 py-3 text-gray-600 text-xs">{r.patientName ?? r.patientIpNo ?? '—'}</td>
                   <td className="px-4 py-3 text-gray-500 text-xs">{r.chargeStatus ?? '—'}</td>
                   <td className="px-4 py-3"><StatusBadge status={status} /></td>
                   <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.surgeryDate)}</td>
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-1 flex-wrap">
                       {status === 'Planned' && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.checkConsumableStock(r.id), 'Check Stock')}
                           disabled={acting === r.id + 'Check Stock'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                           <CheckCircle className="w-3 h-3" /> Check Stock
                         </button>
                       )}
                       {(status === 'StockAllocated') && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.issueConsumableInOT(r.id), 'Issue in OT')}
                           disabled={acting === r.id + 'Issue in OT'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                           <ArrowDownToLine className="w-3 h-3" /> Issue in OT
                         </button>
                       )}
                       {(status === 'StockCheckPending' || status === 'StockAllocated') && (
                         <button onClick={() => {
                           const reason = window.prompt('Escalation reason?');
                           if (reason) doAction(r.id, () => inventoryPharmacyApi.raiseConsumableEscalation(r.id, reason), 'Escalate');
                         }}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">
                           <AlertTriangle className="w-3 h-3" /> Escalate
                         </button>
                       )}
                       {status === 'EscalationRaised' && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.resolveConsumableEscalation(r.id), 'Resolve')}
                           disabled={acting === r.id + 'Resolve'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">
                           <CheckCircle className="w-3 h-3" /> Resolve
                         </button>
                       )}
                       {status === 'IssuedInOT' && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.closeConsumable(r.id), 'Close')}
                           disabled={acting === r.id + 'Close'}
                           className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                           <Package className="w-3 h-3" /> Close
                         </button>
                       )}
                       {(status === 'Planned' || status === 'StockCheckPending') && (
                         <button onClick={() => doAction(r.id, () => inventoryPharmacyApi.cancelConsumable(r.id), 'Cancel')}
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
        <PlanConsumableModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast.success('Consumable plan created!'); }} />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Search, Package, X, Edit2, ScanLine } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BarcodeScanner } from '@/components/inventory/BarcodeScanner';
import {
  inventoryItemApi,
  ItemDto,
  CreateItemRequest,
  CategoryDto,
} from '@/lib/api/inventory-service.api';
import { useCategories } from '@/hooks/useInventoryReferenceData';
import { useMasterListOptions } from '@/hooks/use-master-list-options';
import { requiresColdStorageFromCode, useStorageConditions } from '@/hooks/use-inventory-masters';

const ITEM_TYPES = ['Drug', 'Surgical', 'Equipment', 'Consumable', 'Optical', 'IOL'];
const SCHEDULE_TYPES = ['H', 'H1', 'X', 'G', 'OTC'];
const UNITS = ['Nos', 'Strips', 'Bottles', 'Vials', 'Ampoules', 'Kg', 'Grams', 'Litre', 'ML', 'Boxes'];
const GST_RATES = ['0', '5', '12', '18', '28'];

const TYPE_TABS = [
  { key: 'All',        label: 'All',          dot: 'bg-slate-400',  activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Drug',       label: 'Drugs',        dot: 'bg-blue-400',   activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'Surgical',   label: 'Surgical',     dot: 'bg-teal-400',   activeClass: 'bg-teal-600 border-teal-600 text-white' },
  { key: 'Equipment',  label: 'Equipment',    dot: 'bg-purple-400', activeClass: 'bg-purple-600 border-purple-600 text-white' },
  { key: 'Consumable', label: 'Consumables',  dot: 'bg-orange-400', activeClass: 'bg-orange-500 border-orange-500 text-white' },
  { key: 'Optical',    label: 'Optical',      dot: 'bg-pink-400',   activeClass: 'bg-pink-500 border-pink-500 text-white' },
  { key: 'IOL',        label: 'IOL',          dot: 'bg-indigo-400', activeClass: 'bg-indigo-600 border-indigo-600 text-white' },
];

function SkeletonRow() {
  return (
    <tr>{[140, 80, 60, 60, 60, 80, 60].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: w }} />
      </td>
    ))}</tr>
  );
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

const BLANK: CreateItemRequest = {
  itemName: '', genericName: '', itemCode: '', itemType: 'Drug', categoryId: undefined,
  unit: 'Nos', hsnCode: '', manufacturer: '', gstPercent: 0, cgstPercent: 0, sgstPercent: 0,
  igstPercent: 0, scheduleType: undefined, reorderLevel: 0, maxStockLevel: 0,
};

function ItemModal({ initial, categories, onClose, onSaved }: {
  initial?: ItemDto; categories: CategoryDto[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateItemRequest>(initial ? {
    itemName: initial.itemName, genericName: initial.genericName ?? '', itemCode: initial.itemCode ?? '',
    itemType: initial.itemType ?? 'Drugs', categoryId: initial.categoryId ?? undefined,
    unit: initial.unit ?? 'Nos', hsnCode: initial.hsnCode ?? '', manufacturer: initial.manufacturer ?? '',
    gstPercent: initial.gstPercent ?? 0, cgstPercent: initial.cgstPercent ?? 0,
    sgstPercent: initial.sgstPercent ?? 0, igstPercent: initial.igstPercent ?? 0,
    scheduleType: initial.scheduleType ?? undefined, reorderLevel: initial.reorderLevel ?? 0,
    maxStockLevel: initial.maxStockLevel ?? 0,
  } : { ...BLANK });
  const { labels: itemTypeLabels } = useMasterListOptions('inventory.item_type', ITEM_TYPES);
  const { labels: unitLabels } = useMasterListOptions('inventory.uom', UNITS);
  const { labels: gstLabels } = useMasterListOptions('inventory.gst_rate', GST_RATES);
  const { labels: scheduleLabels } = useMasterListOptions('pharmacy.drug_schedule', SCHEDULE_TYPES);
  const [barcodeScan, setBarcodeScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof CreateItemRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setNum = (k: keyof CreateItemRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));

  const submit = async () => {
    if (!form.itemName.trim()) { setError('Item name is required.'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        ...form,
        requiresColdStorage: storageCondition
          ? requiresColdStorageFromCode(storageCondition)
          : (form as { requiresColdStorage?: boolean }).requiresColdStorage ?? false,
      };
      if (initial) await inventoryItemApi.update(initial.id, payload as CreateItemRequest);
      else await inventoryItemApi.create(payload as CreateItemRequest);
      onSaved();
    } catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? 'Edit Item' : 'New Item'} onClose={onClose}>
      {barcodeScan && <BarcodeScanner onScan={code => { setForm(f => ({ ...f, itemCode: code })); setBarcodeScan(false); }} onClose={() => setBarcodeScan(false)} />}
      <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
            <input value={form.itemName} onChange={set('itemName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
            <input value={form.genericName ?? ''} onChange={set('genericName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
            <div className="flex gap-2">
              <input value={form.itemCode ?? ''} onChange={set('itemCode')}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setBarcodeScan(true)} title="Scan Barcode"
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500">
                <ScanLine className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
            <select value={form.itemType ?? ''} onChange={set('itemType')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {itemTypeLabels.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.categoryId ?? ''} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value || undefined }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select value={form.unit ?? 'Nos'} onChange={set('unit')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {unitLabels.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
            <select value={form.scheduleType ?? ''} onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value || undefined }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— None —</option>
              {scheduleLabels.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Condition</label>
            <select
              value={storageCondition}
              onChange={(e) => setStorageCondition(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Not specified —</option>
              {storageChoices.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input value={form.manufacturer ?? ''} onChange={set('manufacturer')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
            <input value={form.hsnCode ?? ''} onChange={set('hsnCode')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
            <select value={String(form.gstPercent ?? 0)} onChange={e => setForm(f => ({ ...f, gstPercent: parseFloat(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {gstLabels.map((r) => {
                const num = r.match(/\d+/)?.[0] ?? r;
                return <option key={r} value={num}>{r}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
            <input type="number" min={0} value={form.reorderLevel ?? 0} onChange={setNum('reorderLevel')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock Level</label>
            <input type="number" min={0} value={form.maxStockLevel ?? 0} onChange={setNum('maxStockLevel')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Saving…' : initial ? 'Update Item' : 'Create Item'}
        </button>
      </div>
    </Modal>
  );
}

export default function ItemsPage() {
  const { data: categories = [] } = useCategories();
  const [rows, setRows] = useState<ItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState('All');
  const [modal, setModal] = useState<null | 'create' | ItemDto>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const items = await inventoryItemApi.list({ pageSize: 200 });
      setRows(items.items ?? []);
    } catch (err: any) { setError(err?.response?.data ?? err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.categoryName])), [categories]);

  const filtered = useMemo(() =>
    rows.filter(r => typeTab === 'All' || r.itemType === typeTab)
        .filter(r => !search || r.itemName?.toLowerCase().includes(search.toLowerCase()) || r.itemCode?.toLowerCase().includes(search.toLowerCase())),
    [rows, typeTab, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage inventory items, drugs, consumables, and equipment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_TABS.map(t => (
          <button key={t.key} onClick={() => setTypeTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
              ${typeTab === t.key ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code…"
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
              {['Item Name', 'Code', 'Type', 'Category', 'Unit', 'GST', 'Reorder', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />) :
             filtered.length === 0 ? (
               <tr><td colSpan={8} className="px-4 py-16 text-center">
                 <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm">No items found</p>
               </td></tr>
             ) : filtered.map(r => (
               <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                 <td className="px-4 py-3 font-medium text-gray-900">{r.itemName}</td>
                 <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.itemCode ?? '—'}</td>
                 <td className="px-4 py-3">
                   <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{r.itemType}</span>
                 </td>
                 <td className="px-4 py-3 text-gray-500 text-xs">{r.categoryId ? (catMap[r.categoryId] ?? '—') : '—'}</td>
                 <td className="px-4 py-3 text-gray-600 text-xs">{r.unit}</td>
                 <td className="px-4 py-3 text-gray-600 text-xs">{r.gstPercent ?? 0}%</td>
                 <td className="px-4 py-3 text-gray-600 text-xs">{r.reorderLevel ?? 0}</td>
                 <td className="px-4 py-3">
                   <button onClick={() => setModal(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                     <Edit2 className="w-3.5 h-3.5" />
                   </button>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {modal === 'create' && (
        <ItemModal categories={categories} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); toast.success('Item created!'); }} />
      )}
      {modal && modal !== 'create' && (
        <ItemModal initial={modal as ItemDto} categories={categories} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); toast.success('Item updated!'); }} />
      )}
    </div>
  );
}

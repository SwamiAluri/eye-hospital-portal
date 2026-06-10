'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, AlertTriangle, Package, Edit, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useAuthStore } from '@/lib/auth-store';
import {
  inventoryInvoiceApi,
  invoiceExtractionApi,
  VendorDto,
  StoreDto,
  type InvoiceExtractionPreview,
  type ConfirmExtractionRequest,
} from '@/lib/api/inventory-service.api';
import { ItemSearchModal, LastPurchaseInfo } from '@/components/inventory/ItemSearchModal';
import { ItemGstFormModal, GrnLineItem } from '@/components/inventory/ItemGstFormModal';
import { InvoiceUploadPanel } from '@/components/inventory/InvoiceUploadPanel';
import { ExtractionGrnReview } from '@/components/inventory/ExtractionGrnReview';
import type { ItemDto } from '@/lib/api/inventory-service.api';
import { useMasterValues } from '@/hooks/use-master-values';
import { useVendors, useStores } from '@/hooks/useInventoryReferenceData';

// ─── Read-only field (Phase 2 locked fields) ──────────────────────────────────────
function ROField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">{value || <span className="text-gray-400">—</span>}</div>
    </div>
  );
}

// ─── Header data type ─────────────────────────────────────────────────────────────
interface HeaderData {
  vendorId: string; storeId: string;
  vendorName: string; storeName: string;
  contactPerson?: string; phone?: string; email?: string;
  invoiceType: 'Invoice' | 'Packing Slip';
  purchaseCategory: string; paymentMode: string;
  invoiceNo: string; invoiceDate: string;
  creditPeriod: string; dueDate: string;
  reference: string; grnDate: string; remarks: string;
}

// ─── Inline Header Form ───────────────────────────────────────────────────────────
function InlineHeaderForm({
  vendors, stores, onSave, onCancel,
}: {
  vendors: VendorDto[];
  stores: StoreDto[];
  onSave: (data: HeaderData) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { options: purchaseCategoryOptions } = useMasterValues('inventory.purchase_category');
  const { options: paymentModeOptions } = useMasterValues('billing.payment_mode');

  const [vendorId,         setVendorId]         = useState('');
  const [storeId,          setStoreId]          = useState('');
  const [invoiceType,      setInvoiceType]      = useState<'Invoice' | 'Packing Slip'>('Invoice');
  const [purchaseCategory, setPurchaseCategory] = useState('');
  const [paymentMode,      setPaymentMode]      = useState('');
  const [invoiceNo,        setInvoiceNo]        = useState('');
  const [invoiceDate,      setInvoiceDate]      = useState(today);
  const [creditPeriod,     setCreditPeriod]     = useState('');
  const [dueDate,          setDueDate]          = useState('');
  const [reference,        setReference]        = useState('');
  const [grnDate,          setGrnDate]          = useState(today);
  const [remarks,          setRemarks]          = useState('');

  const selectedVendor = vendors.find(v => v.id === vendorId) ?? null;
  const selectedStore  = stores.find(s => s.id === storeId) ?? null;

  useEffect(() => {
    const days = parseInt(creditPeriod) || 0;
    if (!invoiceDate || days <= 0) { setDueDate(''); return; }
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [invoiceDate, creditPeriod]);

  const handleCreate = () => {
    if (!vendorId)         { toast.error('Please select a vendor');       return; }
    if (!storeId)          { toast.error('Please select a store');        return; }
    if (!invoiceNo.trim()) { toast.error('Please enter invoice number');  return; }
    onSave({
      vendorId, storeId,
      vendorName: selectedVendor?.name ?? '',
      storeName: selectedStore?.storeName ?? '',
      contactPerson: selectedVendor?.contactPerson,
      phone: selectedVendor?.phone,
      email: selectedVendor?.email,
      invoiceType, purchaseCategory, paymentMode,
      invoiceNo, invoiceDate, creditPeriod, dueDate,
      reference, grnDate, remarks,
    });
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';
  const lblCls   = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900">New Purchase</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedStore ? `Store: ${selectedStore.storeName}` : 'Fill invoice details to proceed'}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-5">
        <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-4">Invoice Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Vendor *</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputCls}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Store *</label>
            <select value={storeId} onChange={e => setStoreId(e.target.value)} className={inputCls}>
              <option value="">Select store…</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.storeName}</option>)}
            </select>
          </div>
          {selectedVendor && (
            <div className="col-span-2 grid grid-cols-3 gap-3 bg-teal-50/60 border border-teal-100 rounded-xl p-3">
              <ROField label="Contact" value={selectedVendor.contactPerson} />
              <ROField label="Phone"   value={selectedVendor.phone} />
              <ROField label="Email"   value={selectedVendor.email} />
            </div>
          )}
          <div className="col-span-2">
            <label className={lblCls}>Type</label>
            <div className="flex gap-4">
              {(['Invoice', 'Packing Slip'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="invoiceType" value={t} checked={invoiceType === t} onChange={() => setInvoiceType(t)} className="accent-teal-600" />
                  <span className="text-sm text-gray-700">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={lblCls}>Purchase Category</label>
            <select value={purchaseCategory} onChange={e => setPurchaseCategory(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {purchaseCategoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {paymentModeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>{invoiceType === 'Packing Slip' ? 'Packing Slip No *' : 'Invoice No *'}</label>
            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder={invoiceType === 'Packing Slip' ? 'e.g. PS-2024-001' : 'e.g. INV-2024-001'} className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Invoice Date</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Credit Period (days)</label>
            <input type="number" min="0" value={creditPeriod} onChange={e => setCreditPeriod(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Due Date (auto)</label>
            <input type="date" value={dueDate} readOnly className={`${inputCls} bg-gray-50 text-gray-500 cursor-default`} />
          </div>
          <div>
            <label className={lblCls}>Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO No / Ref…" className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>GRN Date</label>
            <input type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={lblCls}>Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
        <p className="text-xs text-gray-400">Fill in header details to proceed</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            Create GRN →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline GRN Card (items phase) ───────────────────────────────────────────────
function InlineGrnCard({
  header, onDiscard, onSaved,
}: {
  header: HeaderData;
  onDiscard: () => void;
  onSaved: () => void;
}) {
  const [lines,              setLines]              = useState<GrnLineItem[]>([]);
  const [showItemSearch,     setShowItemSearch]     = useState(false);
  const [pendingItem,        setPendingItem]        = useState<ItemDto | null>(null);
  const [pendingLastPurch,   setPendingLastPurch]   = useState<LastPurchaseInfo | undefined>(undefined);
  const [editingLineIdx,     setEditingLineIdx]     = useState<number | null>(null);
  const [showSaveConfirm,    setShowSaveConfirm]    = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saving,             setSaving]             = useState(false);

  const totalBeforeTax = lines.reduce((s, l) => s + l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100), 0);
  const totalCgst      = lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.cgstPercent / 100; }, 0);
  const totalSgst      = lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.sgstPercent / 100; }, 0);
  const totalIgst      = lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.igstPercent / 100; }, 0);
  const totalRounding  = lines.reduce((s, l) => s + (l.roundingAmount ?? 0), 0);
  const netAmount      = totalBeforeTax + totalCgst + totalSgst + totalIgst + totalRounding;

  const handleItemSelected = (item: ItemDto, lp?: LastPurchaseInfo) => {
    setShowItemSearch(false);
    setPendingItem(item);
    setPendingLastPurch(lp);
  };
  const handleLineSaved = (line: GrnLineItem) => { setLines(prev => [...prev, line]); setPendingItem(null); };
  const handleLineEdited = (line: GrnLineItem) => {
    if (editingLineIdx === null) return;
    setLines(prev => prev.map((l, i) => i === editingLineIdx ? line : l));
    setEditingLineIdx(null);
  };
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const startEdit  = (idx: number) => setEditingLineIdx(idx);

  const handleFinalSave = async () => {
    if (lines.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    const tid = toast.loading('Saving purchase…');
    try {
      await inventoryInvoiceApi.create({
        vendorId: header.vendorId,
        storeId: header.storeId,
        invoiceNumber: header.invoiceNo,
        invoiceDate: new Date(header.invoiceDate).toISOString(),
        billingMode: 'Bulk',
        invoiceType: header.invoiceType,
        tcsPercent: 0,
        remarks: header.remarks || undefined,
        paymentMode: header.paymentMode || undefined,
        creditPeriod: parseInt(header.creditPeriod) || undefined,
        dueDate: header.dueDate ? new Date(header.dueDate).toISOString() : undefined,
        reference: header.reference || undefined,
        purchaseCategory: header.purchaseCategory || undefined,
        items: lines.map(l => ({
          itemId: l.itemId, orderedQuantity: l.orderedQuantity, receivedQuantity: l.acceptedQuantity,
          freeQuantity: l.freeQuantity, batchNumber: l.batchNumber || null,
          expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : null,
          barcode: l.barcode || null, mrp: l.mrp, originalMrp: l.mrp, purchaseRate: l.purchaseRate,
          discountPercent: l.discountPercent, hsnCode: l.hsnCode || null,
          gstPercent: l.gstPercent, cgstPercent: l.cgstPercent, sgstPercent: l.sgstPercent, igstPercent: l.igstPercent,
          itemRemarks: l.itemRemarks || null, sellingPrice: l.sellingPrice, packing: l.packing,
          unitsPerPack: l.unitsPerPack, mrpOnPack: l.mrpOnPack, transferMrp: l.transferMrp,
          isAssetItem: l.isAssetItem, taxOnFree: l.taxOnFree, isReplacement: l.isReplacement,
        })),
      });
      toast.dismiss(tid);
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex items-center gap-3 px-4 py-3 border border-green-200`}>
          <div className="flex-1 text-sm font-medium text-gray-800">Purchase saved!</div>
          <a
            href="/admin/inventory/purchase-query"
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 whitespace-nowrap"
            onClick={() => toast.dismiss(t.id)}
          >
            View in Purchase Query →
          </a>
        </div>
      ), { duration: 6000 });
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to save purchase', { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header summary banner */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-gray-900">{header.vendorName}</span>
                <span className="font-mono text-sm font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-lg">{header.invoiceNo}</span>
                {header.purchaseCategory && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{header.purchaseCategory}</span>
                )}
                {header.paymentMode && (
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{header.paymentMode}</span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="text-xs text-gray-500">Store: <span className="font-medium text-gray-700">{header.storeName}</span></span>
                <span className="text-xs text-gray-500">Invoice Date: <span className="font-medium text-gray-700">{header.invoiceDate}</span></span>
                {header.dueDate && (
                  <span className="text-xs text-gray-500">Due: <span className="font-medium text-gray-700">{header.dueDate}</span></span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-600">In Progress</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-orange-50 border-l-4 border-orange-400 rounded-xl px-4 py-3 mt-3">
            <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-orange-700">
              Add items below and click <span className="underline">Save Purchase</span> to complete the GRN process.
            </p>
          </div>
        </div>

        {/* Items section */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Items ({lines.length})</p>
            <button
              onClick={() => setShowItemSearch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200"
            >
              <Plus size={12} /> Add Item
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
              <Package size={24} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No items added yet</p>
              <button onClick={() => setShowItemSearch(true)} className="mt-3 text-xs text-teal-600 hover:underline">
                + Add first item
              </button>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">#</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Item</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Batch</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Expiry</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Qty</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Free</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Rate</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Disc%</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">MRP</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-orange-500 uppercase tracking-widest">CGST%</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-orange-500 uppercase tracking-widest">SGST%</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-orange-500 uppercase tracking-widest">IGST%</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Net</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const taxable = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100);
                    const net     = taxable * (1 + (l.cgstPercent + l.sgstPercent + l.igstPercent) / 100) + (l.roundingAmount ?? 0);
                    return (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-teal-50/30 transition-colors group">
                        <td className="px-3 py-2.5 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[180px]">
                          <div className="truncate" title={l.itemName}>{l.itemName}</div>
                          {l.hsnCode && <div className="text-[10px] text-gray-400 font-mono mt-0.5">HSN: {l.hsnCode}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 font-mono">{l.batchNumber || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.expiryDate || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{l.acceptedQuantity}</td>
                        <td className="px-3 py-2.5 text-right text-teal-600 font-medium">{l.freeQuantity > 0 ? l.freeQuantity : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">₹{l.purchaseRate.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {l.discountPercent > 0
                            ? <span className="text-emerald-600 font-medium">{l.discountPercent}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">₹{l.mrp.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.cgstPercent > 0 ? `${l.cgstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.sgstPercent > 0 ? `${l.sgstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.igstPercent > 0 ? `${l.igstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">₹{net.toFixed(2)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(i)}
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit item"
                            >
                              <Edit size={11} />
                            </button>
                            <button
                              onClick={() => removeLine(i)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Summary ─ visually separated card ─────────────────────────── */}
          {lines.length > 0 && (
            <div className="mt-5 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-200 uppercase tracking-widest">Summary</span>
                <span className="ml-auto text-[10px] text-slate-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-5 divide-x divide-gray-100 bg-white">
                {[
                  { label: 'Before Tax', value: totalBeforeTax, color: 'text-gray-800' },
                  { label: 'CGST',       value: totalCgst,      color: 'text-orange-600' },
                  { label: 'SGST',       value: totalSgst,      color: 'text-orange-600' },
                  { label: 'IGST',       value: totalIgst,      color: 'text-orange-600' },
                  { label: 'Net Amount', value: netAmount,       color: 'text-blue-700'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${color}`}>₹{value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-400">
            {lines.length} item{lines.length !== 1 ? 's' : ''} · Net ₹{netAmount.toFixed(2)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDiscardConfirm(true)}
              className="px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
            >
              Discard
            </button>
            <button
              onClick={() => lines.length > 0 ? setShowSaveConfirm(true) : toast.error('Add at least one item')}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              {saving ? 'Saving…' : 'Save Purchase'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showSaveConfirm}
        title="Save Purchase?"
        message="This will save the invoice to Purchase Invoices. Stock is updated only after GRN final approval."
        variant="info"
        confirmText="Save"
        onConfirm={() => { setShowSaveConfirm(false); handleFinalSave(); }}
        onClose={() => setShowSaveConfirm(false)}
      />
      <ConfirmationDialog
        isOpen={showDiscardConfirm}
        title="Discard GRN?"
        message="All header details and added items will be lost. This cannot be undone."
        variant="danger"
        confirmText="Discard"
        onConfirm={() => { setShowDiscardConfirm(false); onDiscard(); }}
        onClose={() => setShowDiscardConfirm(false)}
      />
      {showItemSearch && (
        <div className="z-50">
          <ItemSearchModal storeId={header.storeId} onSelect={handleItemSelected} onClose={() => setShowItemSearch(false)} />
        </div>
      )}
      {pendingItem && (
        <div className="z-50">
          <ItemGstFormModal
            item={pendingItem}
            lastMrp={pendingLastPurch?.lastMrp}
            lastPurchasePrice={pendingLastPurch?.lastPurchasePrice}
            onSave={handleLineSaved}
            onClose={() => { setPendingItem(null); setPendingLastPurch(undefined); }}
          />
        </div>
      )}
      {editingLineIdx !== null && (() => {
        const l = lines[editingLineIdx];
        // Reconstruct a minimal ItemDto from the saved GrnLineItem
        const editItem: ItemDto = {
          id:               l.itemId,
          itemName:         l.itemName,
          unit:             l.unit,
          hsnCode:          l.hsnCode,
          genericName:      undefined,
          requiresColdStorage: false,
          isBarcodeTracked: false,
          itemType:         'Medicine',
          reorderLevel:     0,
          reorderQuantity:  0,
          defaultGstRate:   String(l.gstPercent),
          status:           'active',
        };
        return (
          <div className="z-50">
            <ItemGstFormModal
              item={editItem}
              initial={l}
              isEditing={true}
              onSave={handleLineEdited}
              onClose={() => setEditingLineIdx(null)}
            />
          </div>
        );
      })()}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────────
export default function GrnPage() {
  const { data: vendors = [] } = useVendors();
  const { data: rawStores = [] } = useStores();
  const stores: StoreDto[] = Array.isArray(rawStores) ? rawStores : [];
  const [mode,             setMode]             = useState<'idle' | 'upload' | 'review' | 'header' | 'items'>('idle');
  const [header,           setHeader]           = useState<HeaderData | null>(null);
  const [refCount,         setRefCount]         = useState(0);
  const [extractionPreview, setExtractionPreview] = useState<InvoiceExtractionPreview | null>(null);
  const [uploadProcessing,  setUploadProcessing]  = useState(false);
  const [confirmingExtraction, setConfirmingExtraction] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setExtractionError(null);
    setUploadProcessing(true);
    const tid = toast.loading('Analysing invoice — this may take up to a minute…');
    try {
      const preview = await invoiceExtractionApi.upload(file);
      setExtractionPreview(preview);
      toast.success('Invoice read successfully — please review the extracted fields.', { id: tid });
      setMode('review');
    } catch (err: any) {
      const msg = err?.response?.data ?? 'Could not read invoice. The file may be password-protected, corrupted, or an unsupported format.';
      setExtractionError(msg);
      toast.error(msg, { id: tid });
    } finally {
      setUploadProcessing(false);
    }
  }, []);

  const handleExtractionConfirm = useCallback(async (data: Parameters<React.ComponentProps<typeof ExtractionGrnReview>['onConfirm']>[0]) => {
    if (!extractionPreview) return;
    setConfirmingExtraction(true);
    const tid = toast.loading('Saving purchase…');
    try {
      const req: ConfirmExtractionRequest = {
        sessionId:            extractionPreview.sessionId,
        vendorId:             data.vendorId,
        storeId:              data.storeId,
        invoiceNumber:        data.invoiceNumber,
        invoiceDate:          new Date(data.invoiceDate).toISOString(),
        invoiceType:          data.invoiceType,
        paymentMode:          data.paymentMode   || null,
        creditPeriod:         parseInt(data.creditPeriod) || null,
        dueDate:              data.dueDate        ? new Date(data.dueDate).toISOString() : null,
        reference:            data.reference     || null,
        purchaseCategory:     data.purchaseCategory || null,
        remarks:              data.remarks        || null,
        grnDate:              data.grnDate,
        generateGrn:          true,
        items:                data.items,
        // Audit metadata
        originalFilename:     data.originalFilename,
        documentUrl:          data.documentUrl,
        providerModel:        data.providerModel,
        processingMs:         data.processingMs,
        highFieldCount:       data.highFieldCount,
        reviewFieldCount:     data.reviewFieldCount,
        lowFieldCount:        data.lowFieldCount,
        fieldOverrideCount:   data.fieldOverrideCount,
        overriddenFieldsJson: data.overriddenFieldsJson,
        tcsTotalAmount:       data.tcsTotalAmount ?? 0,
      };
      await invoiceExtractionApi.confirm(req);
      toast.success('Purchase saved from invoice!', { id: tid });
      setRefCount(c => c + 1);
      setMode('idle');
      setExtractionPreview(null);
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to save purchase', { id: tid });
    } finally {
      setConfirmingExtraction(false);
    }
  }, [extractionPreview]);

  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">GRN</h1>
          <p className="text-sm text-gray-500 mt-0.5">Goods Receipt Notes</p>
        </div>
        {mode === 'idle' && (
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={() => setMode('upload')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <Upload size={15} /> Upload Invoice
            </button>
            <button
              onClick={() => setMode('header')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <Plus size={15} /> New GRN
            </button>
          </div>
        )}
      </div>

      {mode === 'idle' && refCount > 0 && (
        <p className="text-xs text-emerald-600 font-medium mb-4">
          ✓ {refCount} purchase{refCount !== 1 ? 's' : ''} saved this session
        </p>
      )}

      {mode === 'upload' && (
        <InvoiceUploadPanel
          isProcessing={uploadProcessing}
          onFileSelected={handleFileSelected}
          onCancel={() => { setMode('idle'); setUploadProcessing(false); setExtractionError(null); }}
          extractionError={extractionError}
          onRetry={() => setExtractionError(null)}
        />
      )}

      {mode === 'review' && extractionPreview && (
        <ExtractionGrnReview
          preview={extractionPreview}
          vendors={vendors}
          stores={stores}
          onConfirm={handleExtractionConfirm}
          onClose={() => { setMode('idle'); setExtractionPreview(null); }}
        />
      )}

      {mode === 'header' && (
        <InlineHeaderForm
          vendors={vendors}
          stores={stores}
          onSave={data => { setHeader(data); setMode('items'); }}
          onCancel={() => setMode('idle')}
        />
      )}

      {mode === 'items' && header && (
        <InlineGrnCard
          header={header}
          onDiscard={() => { setMode('idle'); setHeader(null); }}
          onSaved={() => { setRefCount(c => c + 1); setMode('idle'); setHeader(null); }}
        />
      )}
    </div>
  );
}

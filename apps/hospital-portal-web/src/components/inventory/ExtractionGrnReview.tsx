'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, Edit, AlertTriangle, ChevronDown, ChevronUp, Package, Search, Plus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { ItemSearchModal, LastPurchaseInfo } from '@/components/inventory/ItemSearchModal';
import { ItemGstFormModal, GrnLineItem } from '@/components/inventory/ItemGstFormModal';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  VendorDto,
  StoreDto,
  InvoiceExtractionPreview,
  ExtractedLineItem,
  ConfirmedLineItem,
  CreateItemRequest,
  CreateVendorRequest,
  inventoryItemApi,
  inventoryVendorApi,
  type ItemDto,
} from '@/lib/api/inventory-service.api';

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEM_TYPES   = ['Drug', 'Surgical', 'Consumable', 'Optical', 'Equipment', 'General'];
const UNITS        = ['Nos', 'Strips', 'Bottles', 'Vials', 'Ampoules', 'Boxes', 'Kgs', 'Ltrs', 'Pairs', 'Sets'];
const GST_RATES    = [0, 5, 12, 18, 28];
const VENDOR_CATEGORIES = ['Pharmacy', 'Surgical', 'Equipment', 'Laboratory', 'General', 'Optical'];

// ─── Header state ─────────────────────────────────────────────────────────────
interface HdrState {
  vendorId: string;
  storeId: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceType: 'Invoice' | 'Packing Slip';
  paymentMode: string;
  creditPeriod: string;
  dueDate: string;
  reference: string;
  purchaseCategory: string;
  grnDate: string;
  remarks: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  preview: InvoiceExtractionPreview;
  vendors: VendorDto[];
  stores: StoreDto[];
  onConfirm: (data: {
    vendorId: string; storeId: string;
    invoiceNumber: string; invoiceDate: string; invoiceType: string;
    paymentMode: string; creditPeriod: string; dueDate: string;
    reference: string; purchaseCategory: string; grnDate: string; remarks: string;
    items: ConfirmedLineItem[];
    originalFilename?: string; documentUrl?: string; providerModel?: string;
    processingMs?: number;
    highFieldCount?: number; reviewFieldCount?: number; lowFieldCount?: number;
    fieldOverrideCount?: number; overriddenFieldsJson?: string;
    tcsTotalAmount?: number;
  }) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Expand one extracted line item into 1..N GrnLineItems.
 *  If serial_numbers present and count matches quantity → one row per serial.
 *  Otherwise returns a single row. */
function expandLineItemToGrn(src: ExtractedLineItem): GrnLineItem[] {
  const gst  = src.gstPercent?.value  ?? 0;
  const cgst = src.cgstPercent?.value ?? gst / 2;
  const sgst = src.sgstPercent?.value ?? gst / 2;
  const igst = src.igstPercent?.value ?? 0;
  const qty  = src.orderedQuantity?.value ?? 1;

  const base: GrnLineItem = {
    itemId:           src.resolvedItemId   ?? '',
    itemName:         src.resolvedItemName ?? src.rawDescription.value ?? '',
    hsnCode:          src.hsnCode?.value   ?? '',
    unit:             'Nos',
    barcode:          '',
    orderedQuantity:  qty,
    acceptedQuantity: qty,
    rejectedQuantity: 0,
    freeQuantity:     src.freeQuantity?.value     ?? 0,
    batchNumber:      src.batchNumber?.value      ?? '',
    expiryDate:       toDateStr(src.expiryDate?.value) || '',
    purchaseRate:     src.purchaseRate?.value     ?? 0,
    mrp:              src.mrp?.value              ?? 0,
    discountPercent:  src.discountPercent?.value  ?? 0,
    sellingPrice:     src.sellingPrice?.value     ?? 0,
    gstPercent:  gst,
    cgstPercent: cgst,
    sgstPercent: sgst,
    igstPercent: igst,
    packing: 0, unitsPerPack: 0, mrpOnPack: 0, transferMrp: 0, mrpPerUnit: 0,
    isAssetItem: false, taxOnFree: false, isReplacement: false,
    itemRemarks: '', roundingAmount: 0,
    // Traceability
    manufacturerName: src.manufacturerName?.value ?? null,
    countryOfOrigin:  src.countryOfOrigin?.value  ?? null,
    mfgDate:          toDateStr(src.mfgDate?.value) || null,
    scheduleType:     src.scheduleType?.value     ?? null,
    isColdChain:      src.isColdChain?.value      ?? false,
    brandName:        src.brandName?.value        ?? null,
    vendorSku:        src.vendorSku?.value        ?? null,
    isInterState:     src.isInterState?.value     ?? igst > 0,
    extraFieldsJson:  src.extraFieldsJson?.value  ?? null,
    serialNumber:     null,
  };

  const serials = src.serialNumbers?.value ?? [];
  // If we have exactly as many serials as quantity → split into separate rows
  if (serials.length > 0 && serials.length === Math.round(qty)) {
    return serials.map(sn => ({ ...base, orderedQuantity: 1, acceptedQuantity: 1, serialNumber: sn }));
  }

  // Default single row (attach first serial if any)
  return [{ ...base, serialNumber: serials[0] ?? null }];
}

function calcDueDate(invoiceDate: string, creditPeriod: string): string {
  const days = parseInt(creditPeriod) || 0;
  if (!invoiceDate || days <= 0) return '';
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Strip time component from ISO strings (e.g. 2025-10-27T00:00:00 → 2025-10-27) */
function toDateStr(val?: string | null): string {
  if (!val) return '';
  return val.slice(0, 10);
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';
const lblCls   = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1';

function ROField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className={lblCls}>{label}</p>
      <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

// ─── QuickCreateItemModal ────────────────────────────────────────────────────
interface QuickCreateProps {
  prefillName: string;
  prefillHsn: string;
  prefillGst: number;
  onCreated: (item: ItemDto) => void;
  onClose: () => void;
}

function QuickCreateItemModal({ prefillName, prefillHsn, prefillGst, onCreated, onClose }: QuickCreateProps) {
  const [form, setForm] = useState({
    itemName:    prefillName,
    genericName: '',
    itemType:    'Drug',
    unit:        'Nos',
    hsnCode:     prefillHsn,
    gstPercent:  prefillGst,
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.itemName.trim()) { setError('Item name is required.'); return; }
    setBusy(true); setError('');
    try {
      // Duplicate check — block if item with same name already exists (case-insensitive)
      const existing = await inventoryItemApi.list({ search: form.itemName.trim(), pageSize: 10 });
      const duplicate = existing.items?.find(
        it => it.itemName.toLowerCase() === form.itemName.trim().toLowerCase()
      );
      if (duplicate) {
        setError(`"${duplicate.itemName}" already exists in item master. Search and select it instead.`);
        setBusy(false);
        return;
      }
      const req: CreateItemRequest = {
        itemName:             form.itemName.trim(),
        genericName:          form.genericName.trim() || undefined,
        itemType:             form.itemType,
        unit:                 form.unit,
        hsnCode:              form.hsnCode.trim() || undefined,
        defaultGstRate:       String(form.gstPercent),
        requiresColdStorage:  false,
        isBarcodeTracked:     false,
        reorderLevel:         0,
        reorderQuantity:      0,
      };
      const created = await inventoryItemApi.create(req);
      toast.success(`"${created.itemName}" added to item master`);
      onCreated(created);
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to create item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Register New Item</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add this item to the inventory master before proceeding</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-5 space-y-4">
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lblCls}>Item Name <span className="text-rose-500">*</span></label>
              <input value={form.itemName} onChange={set('itemName')} className={inputCls} placeholder="Enter item name" />
            </div>
            <div className="col-span-2">
              <label className={lblCls}>Generic Name</label>
              <input value={form.genericName} onChange={set('genericName')} className={inputCls} placeholder="Generic / chemical name" />
            </div>
            <div>
              <label className={lblCls}>Item Type</label>
              <select value={form.itemType} onChange={set('itemType')} className={inputCls}>
                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lblCls}>Unit</label>
              <select value={form.unit} onChange={set('unit')} className={inputCls}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={lblCls}>HSN Code</label>
              <input value={form.hsnCode} onChange={set('hsnCode')} className={inputCls} placeholder="e.g. 30049099" />
            </div>
            <div>
              <label className={lblCls}>GST %</label>
              <select value={String(form.gstPercent)} onChange={e => setForm(f => ({ ...f, gstPercent: parseFloat(e.target.value) }))} className={inputCls}>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
          >
            <Plus size={14} />
            {busy ? 'Saving…' : 'Register Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ExtractionGrnReview({ preview, vendors, stores, onConfirm, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const { options: purchaseCategoryOptions } = useMasterValues('inventory.purchase_category');
  const { options: paymentModeOptions } = useMasterValues('billing.payment_mode');

  // ── Header init from extraction ────────────────────────────────────────────
  const [hdr, setHdr] = useState<HdrState>(() => {
    const h       = preview.header;
    const vendorId = h.resolvedVendorId ?? h.vendorCandidates?.[0]?.id ?? '';
    const storeId  = h.resolvedStoreId  ?? h.storeCandidates?.[0]?.id  ?? '';
    const creditP  = String(h.creditPeriod?.value ?? '');
    const invDate  = toDateStr(h.invoiceDate?.value) || today;
    return {
      vendorId, storeId,
      invoiceNo:        h.invoiceNumber?.value ?? '',
      invoiceDate:      invDate,
      invoiceType:      h.invoiceType?.value === 'Packing Slip' ? 'Packing Slip' : 'Invoice',
      paymentMode:      h.paymentMode?.value  ?? '',
      creditPeriod:     creditP,
      dueDate:          calcDueDate(invDate, creditP),
      reference:        h.reference?.value    ?? '',
      purchaseCategory: '',
      grnDate:          toDateStr(h.grnDate?.value) || today,
      remarks:          h.remarks?.value      ?? '',
    };
  });

  const [showHdrEdit,      setShowHdrEdit]      = useState(false);
  const [lines,            setLines]            = useState<GrnLineItem[]>(() => preview.lineItems.flatMap(expandLineItemToGrn));
  const [editIdx,          setEditIdx]          = useState<number | null>(null);
  const [searchIdx,        setSearchIdx]        = useState<number | null>(null);
  const [pendingSearchIdx, setPendingSearchIdx] = useState<number | null>(null);
  const [createItemIdx,    setCreateItemIdx]    = useState<number | null>(null);
  const [searchItem,       setSearchItem]       = useState<ItemDto | null>(null);
  const [searchLp,         setSearchLp]         = useState<LastPurchaseInfo | undefined>(undefined);
  const [showSaveConfirm,    setShowSaveConfirm]    = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [gstinAcknowledged,  setGstinAcknowledged]  = useState(false);
  const [showVendorCreate,   setShowVendorCreate]   = useState(false);
  const [extraVendors,       setExtraVendors]       = useState<VendorDto[]>([]);
  const [expandedExtra,      setExpandedExtra]      = useState<Set<number>>(new Set());

  // Auto-update due date
  useEffect(() => {
    setHdr(h => ({ ...h, dueDate: calcDueDate(h.invoiceDate, h.creditPeriod) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdr.invoiceDate, hdr.creditPeriod]);

  // Auto-open header edit if vendor or store not resolved
  useEffect(() => {
    if (!hdr.vendorId || !hdr.storeId) setShowHdrEdit(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allVendors     = useMemo(() => [...vendors, ...extraVendors], [vendors, extraVendors]);
  const unmatchedCount = lines.filter(l => !l.itemId).length;
  const selectedVendor = allVendors.find(v => v.id === hdr.vendorId) ?? null;
  const selectedStore  = stores.find(s => s.id === hdr.storeId)   ?? null;

  const totalBeforeTax = useMemo(() => lines.reduce((s, l) => s + l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100), 0), [lines]);
  const totalCgst      = useMemo(() => lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.cgstPercent / 100; }, 0), [lines]);
  const totalSgst      = useMemo(() => lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.sgstPercent / 100; }, 0), [lines]);
  const totalIgst      = useMemo(() => lines.reduce((s, l) => { const t = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100); return s + t * l.igstPercent / 100; }, 0), [lines]);
  const totalRounding  = useMemo(() => lines.reduce((s, l) => s + (l.roundingAmount ?? 0), 0), [lines]);
  const tcsAmount      = preview.totals.tcsAmount?.value ?? 0;
  const netAmount      = totalBeforeTax + totalCgst + totalSgst + totalIgst + totalRounding + tcsAmount;

  // ── Visual grouping for serialised items ───────────────────────────────────
  const groupKey = (l: GrnLineItem) =>
    `${l.itemName}|${l.batchNumber ?? ''}|${l.expiryDate ?? ''}|${l.purchaseRate}`;
  const groups = useMemo(() => {
    const map = new Map<string, number[]>();
    lines.forEach((l, i) => {
      const k = groupKey(l);
      const arr = map.get(k) ?? [];
      arr.push(i);
      map.set(k, arr);
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // GSTIN mismatch: extracted GSTIN vs resolved vendor's GSTIN
  const extractedGstin  = preview.header.vendorGstinOnInvoice?.value ?? preview.header.vendorGstin?.value ?? '';
  const resolvedVendorGstin = selectedVendor ? (selectedVendor as any).gstNumber ?? '' : '';
  const gstinMismatch = !!(extractedGstin && resolvedVendorGstin &&
    extractedGstin.trim().toUpperCase() !== resolvedVendorGstin.trim().toUpperCase());

  const canSave = !!(hdr.vendorId && hdr.storeId && hdr.invoiceNo.trim() && unmatchedCount === 0 && lines.length > 0
    && (!gstinMismatch || gstinAcknowledged));

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearchSelectWrapped = (item: ItemDto, lp?: LastPurchaseInfo) => {
    setPendingSearchIdx(searchIdx);
    setSearchItem(item);
    setSearchLp(lp);
    setSearchIdx(null);
  };

  const handleSearchCreateNew = useCallback((name: string, hsn: string) => {
    setPendingSearchIdx(searchIdx);
    setCreateItemIdx(searchIdx);
    setSearchIdx(null);
  }, [searchIdx]);

  const handleSearchGstSave = (grn: GrnLineItem) => {
    if (pendingSearchIdx === null) return;
    setLines(prev => prev.map((l, i) => i === pendingSearchIdx ? grn : l));
    setSearchItem(null); setSearchLp(undefined); setPendingSearchIdx(null);
  };

  const handleEditSave = (grn: GrnLineItem) => {
    if (editIdx === null) return;
    setLines(prev => prev.map((l, i) => i === editIdx ? grn : l));
    setEditIdx(null);
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!hdr.vendorId)         { toast.error('Select a vendor');                   return; }
    if (!hdr.storeId)          { toast.error('Select a store');                    return; }
    if (!hdr.invoiceNo.trim()) { toast.error('Enter invoice number');              return; }
    if (unmatchedCount > 0)    { toast.error('Resolve all unmatched items first'); return; }
    if (lines.length === 0)    { toast.error('Add at least one item');             return; }
    setSaving(true);
    try {
      await onConfirm({
        vendorId: hdr.vendorId, storeId: hdr.storeId,
        invoiceNumber: hdr.invoiceNo, invoiceDate: hdr.invoiceDate,
        invoiceType: hdr.invoiceType, paymentMode: hdr.paymentMode,
        creditPeriod: hdr.creditPeriod, dueDate: hdr.dueDate,
        reference: hdr.reference, purchaseCategory: hdr.purchaseCategory,
        grnDate: hdr.grnDate, remarks: hdr.remarks,
        // e-Invoice & E-Way Bill — forwarded from extraction header
        irn:                  preview.header.irn?.value                  ?? null,
        ackNo:                preview.header.ackNo?.value                ?? null,
        ackDate:              toDateStr(preview.header.ackDate?.value)   || null,
        eWayBillNo:           preview.header.eWayBillNo?.value           ?? null,
        eWayBillDate:         toDateStr(preview.header.eWayBillDate?.value) || null,
        dateOfDelivery:       toDateStr(preview.header.dateOfDelivery?.value) || null,
        isReverseCharge:      preview.header.isReverseCharge?.value      ?? false,
        vendorGstinOnInvoice: preview.header.vendorGstinOnInvoice?.value ?? null,
        items: lines.map((l): ConfirmedLineItem => ({
          itemId: l.itemId, orderedQuantity: l.orderedQuantity, freeQuantity: l.freeQuantity,
          batchNumber: l.batchNumber || null, expiryDate: l.expiryDate || null,
          barcode: l.barcode || null, mrp: l.mrp, purchaseRate: l.purchaseRate,
          discountPercent: l.discountPercent, hsnCode: l.hsnCode || null,
          gstPercent: l.gstPercent, cgstPercent: l.cgstPercent,
          sgstPercent: l.sgstPercent, igstPercent: l.igstPercent,
          sellingPrice: l.sellingPrice, packing: l.packing, unitsPerPack: l.unitsPerPack,
          mrpOnPack: l.mrpOnPack, transferMrp: l.transferMrp,
          isAssetItem: l.isAssetItem, taxOnFree: l.taxOnFree, isReplacement: l.isReplacement,
          itemRemarks: l.itemRemarks || null,
          // Traceability
          serialNumber:    l.serialNumber    ?? null,
          manufacturerName: l.manufacturerName ?? null,
          countryOfOrigin: l.countryOfOrigin ?? null,
          mfgDate:         l.mfgDate         ?? null,
          scheduleType:    l.scheduleType    ?? null,
          isColdChain:     l.isColdChain     ?? false,
          brandName:       l.brandName       ?? null,
          vendorSku:       l.vendorSku       ?? null,
          isInterState:    l.isInterState    ?? (l.igstPercent > 0),
          extraFieldsJson: l.extraFieldsJson ?? null,
        })),
        originalFilename: preview.originalFilename,
        documentUrl:      preview.documentUrl  ?? undefined,
        providerModel:    preview.providerModel,
        processingMs:     preview.processingMs,
        tcsTotalAmount:   tcsAmount,
      });
    } finally {
      setSaving(false);
    }
  };

  const buildEditItem = (l: GrnLineItem): ItemDto => ({
    id: l.itemId, itemName: l.itemName, unit: l.unit, hsnCode: l.hsnCode,
    genericName: undefined, requiresColdStorage: false, isBarcodeTracked: false,
    itemType: 'Medicine', reorderLevel: 0, reorderQuantity: 0,
    defaultGstRate: String(l.gstPercent), status: 'active',
  });

  const toggleExtraFields = useCallback((i: number) => {
    setExpandedExtra(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }, []);

  const toTitleCase = (key: string) =>
    key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── 1. Header bar ──────────────────────────────────────────────── */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-gray-900">
                  {selectedVendor?.name ?? <span className="text-rose-500 italic">No vendor — click Edit Header</span>}
                </span>
                {hdr.invoiceNo && (
                  <span className="font-mono text-sm font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-lg">{hdr.invoiceNo}</span>
                )}
                {hdr.invoiceType && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase tracking-wide">{hdr.invoiceType}</span>
                )}
                {hdr.paymentMode && (
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{hdr.paymentMode}</span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="text-xs text-gray-500">Store: <span className="font-medium text-gray-700">{selectedStore?.storeName ?? '—'}</span></span>
                {hdr.invoiceDate && <span className="text-xs text-gray-500">Invoice Date: <span className="font-medium text-gray-700">{hdr.invoiceDate}</span></span>}
                {hdr.grnDate    && <span className="text-xs text-gray-500">GRN Date: <span className="font-medium text-gray-700">{hdr.grnDate}</span></span>}
              </div>
            </div>
            <button
              onClick={() => setShowHdrEdit(e => !e)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-white hover:bg-teal-50 border border-teal-200 rounded-xl transition-colors"
            >
              <Edit size={12} />
              {showHdrEdit ? 'Done' : 'Edit Header'}
              {showHdrEdit ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* ── 2. Collapsible header edit form ────────────────────────────── */}
        {showHdrEdit && (
          <div className="px-5 py-5 border-b border-gray-100 bg-gray-50/40">
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-4">Invoice Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Vendor *</label>
                <select value={hdr.vendorId} onChange={e => setHdr(h => ({ ...h, vendorId: e.target.value }))} className={inputCls}>
                  <option value="">Select vendor…</option>
                  {allVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {!hdr.vendorId && preview.header.vendorName?.value && (
                  <button
                    type="button"
                    onClick={() => setShowVendorCreate(true)}
                    className="mt-1 text-[11px] text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
                  >
                    <Plus size={10} />
                    Add &quot;{preview.header.vendorName.value}&quot; as new vendor
                  </button>
                )}
              </div>
              <div>
                <label className={lblCls}>Store *</label>
                <select value={hdr.storeId} onChange={e => setHdr(h => ({ ...h, storeId: e.target.value }))} className={inputCls}>
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
                      <input type="radio" name="invoiceTypeExtract" value={t} checked={hdr.invoiceType === t} onChange={() => setHdr(h => ({ ...h, invoiceType: t }))} className="accent-teal-600" />
                      <span className="text-sm text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={lblCls}>Purchase Category</label>
                <select value={hdr.purchaseCategory} onChange={e => setHdr(h => ({ ...h, purchaseCategory: e.target.value }))} className={inputCls}>
                  <option value="">Select…</option>
                  {purchaseCategoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lblCls}>Payment Mode</label>
                <select value={hdr.paymentMode} onChange={e => setHdr(h => ({ ...h, paymentMode: e.target.value }))} className={inputCls}>
                  <option value="">Select…</option>
                  {paymentModeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lblCls}>{hdr.invoiceType === 'Packing Slip' ? 'Packing Slip No *' : 'Invoice No *'}</label>
                <input value={hdr.invoiceNo} onChange={e => setHdr(h => ({ ...h, invoiceNo: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>Invoice Date</label>
                <input type="date" value={hdr.invoiceDate} onChange={e => setHdr(h => ({ ...h, invoiceDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>Credit Period (days)</label>
                <input type="number" min="0" value={hdr.creditPeriod} onChange={e => setHdr(h => ({ ...h, creditPeriod: e.target.value }))} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>Due Date (auto)</label>
                <input type="date" value={hdr.dueDate} readOnly className={`${inputCls} bg-gray-50 text-gray-500 cursor-default`} />
              </div>
              <div>
                <label className={lblCls}>Reference</label>
                <input value={hdr.reference} onChange={e => setHdr(h => ({ ...h, reference: e.target.value }))} placeholder="PO No / Ref…" className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>GRN Date</label>
                <input type="date" value={hdr.grnDate} onChange={e => setHdr(h => ({ ...h, grnDate: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={lblCls}>Remarks</label>
                <input value={hdr.remarks} onChange={e => setHdr(h => ({ ...h, remarks: e.target.value }))} placeholder="Optional" className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowHdrEdit(false)} className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors">
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── 3. Unmatched banner ─────────────────────────────────────────── */}
        {unmatchedCount > 0 && (
          <div className="mx-5 mt-4 flex items-center gap-2.5 bg-orange-50 border-l-4 border-orange-400 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-orange-700">
              {unmatchedCount} item{unmatchedCount !== 1 ? 's' : ''} not matched to inventory master —
              click the <Search size={11} className="inline" /> icon on each row to search or create the item.
            </p>
          </div>
        )}

        {/* ── 4. Items table ──────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Items ({lines.length})</p>
          </div>

          {lines.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
              <Package size={24} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No items extracted</p>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-x-auto">
              <table className="w-full text-xs min-w-[960px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Item', 'Batch', 'Expiry', 'Qty', 'Free', 'Rate', 'Disc%', 'MRP', 'CGST%', 'SGST%', 'IGST%', 'Net', 'Actions'].map((col, ci) => (
                      <th
                        key={col}
                        className={[
                          'px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-widest',
                          ci >= 9 && ci <= 11 ? 'text-orange-500' : 'text-gray-500',
                          ci >= 4 && ci <= 12 ? 'text-right' : ci === 13 ? 'text-center' : 'text-left',
                        ].join(' ')}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const unmatched = !l.itemId;
                    const taxable   = l.acceptedQuantity * l.purchaseRate * (1 - l.discountPercent / 100);
                    const net       = taxable * (1 + (l.cgstPercent + l.sgstPercent + l.igstPercent) / 100) + (l.roundingAmount ?? 0);
                    const key       = groupKey(l);
                    const groupIdxs = groups.get(key) ?? [i];
                    const isMulti   = groupIdxs.length > 1;
                    const isFirst   = groupIdxs[0] === i;
                    const collapsed = collapsedGroups.has(key);

                    // Skip non-first members of a collapsed group
                    if (isMulti && !isFirst && collapsed) return null;

                    const groupHeaderRow = isMulti && isFirst ? (
                      <tr key={`grp-${key}`} className="bg-slate-50 border-b border-slate-100">
                        <td className="px-3 py-1.5 text-gray-400 font-mono">{/* spacer */}</td>
                        <td colSpan={12} className="px-3 py-1.5">
                          <button
                            onClick={() => toggleGroup(key)}
                            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                          >
                            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                            <span className="truncate max-w-[220px]">{l.itemName}</span>
                            <span className="ml-1 px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded-full font-mono">
                              {groupIdxs.length} serials
                            </span>
                            {l.batchNumber && <span className="text-slate-400 text-[10px]">Batch {l.batchNumber}</span>}
                            {l.expiryDate  && <span className="text-slate-400 text-[10px]">Exp {l.expiryDate}</span>}
                            <span className="text-slate-500 text-[10px]">₹{l.purchaseRate.toFixed(2)}</span>
                          </button>
                        </td>
                        <td />
                      </tr>
                    ) : null;

                    return (
                      <React.Fragment key={i}>
                        {groupHeaderRow}
                        <tr
                          className={[
                            'border-b border-gray-50 last:border-0 transition-colors',
                            unmatched ? 'bg-orange-50/60 border-l-4 border-l-orange-400' : 'hover:bg-teal-50/20',
                            isMulti ? 'bg-white' : '',
                          ].join(' ')}
                        >
                          <td className={['px-3 py-2.5 text-gray-400 font-mono', isMulti ? 'pl-6' : ''].join(' ')}>{i + 1}</td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div>
                            <div className="font-medium text-gray-800 truncate" title={l.itemName}>{l.itemName || <span className="italic text-gray-400">Unnamed item</span>}</div>
                            {l.hsnCode && <div className="text-[10px] text-gray-400 font-mono mt-0.5">HSN: {l.hsnCode}</div>}
                            {unmatched && (
                              <div className="flex items-center gap-1 mt-0.5 text-orange-500 text-[10px] font-semibold">
                                <AlertTriangle size={9} /> Not in master
                              </div>
                            )}
                            {/* Traceability badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {l.serialNumber && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-mono rounded border border-blue-100" title="Serial number">
                                  S/N: {l.serialNumber}
                                </span>
                              )}
                              {l.manufacturerName && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-50 text-gray-600 text-[9px] rounded border border-gray-200" title="Manufacturer">
                                  {l.manufacturerName}
                                </span>
                              )}
                              {l.isColdChain && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-cyan-50 text-cyan-700 text-[9px] rounded border border-cyan-100" title="Cold chain required">
                                  🥶 Cold Chain
                                </span>
                              )}
                              {l.scheduleType && l.scheduleType !== 'OTC' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 text-[9px] font-semibold rounded border border-red-100" title="Drug schedule">
                                  SCH-{l.scheduleType}
                                </span>
                              )}
                              {l.extraFieldsJson && (() => {
                                try {
                                  const extra = JSON.parse(l.extraFieldsJson);
                                  const count = Object.keys(extra).length;
                                  if (count === 0) return null;
                                  return (
                                    <button
                                      onClick={() => toggleExtraFields(i)}
                                      className="inline-flex items-center px-1.5 py-0.5 bg-violet-50 text-violet-700 text-[9px] rounded border border-violet-100 hover:bg-violet-100 transition-colors"
                                      title="Extra extracted fields"
                                    >
                                      ⊕ {count} extra
                                    </button>
                                  );
                                } catch { return null; }
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 font-mono">{l.batchNumber || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.expiryDate || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{l.acceptedQuantity}</td>
                        <td className="px-3 py-2.5 text-right text-teal-600 font-medium">{l.freeQuantity > 0 ? l.freeQuantity : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">₹{l.purchaseRate.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {l.discountPercent > 0 ? <span className="text-emerald-600 font-medium">{l.discountPercent}%</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">₹{l.mrp.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.cgstPercent > 0 ? `${l.cgstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.sgstPercent > 0 ? `${l.sgstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{l.igstPercent > 0 ? `${l.igstPercent}%` : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                          {unmatched ? <span className="text-gray-300">—</span> : `₹${net.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {unmatched ? (
                              <>
                                <button
                                  onClick={() => { setPendingSearchIdx(i); setCreateItemIdx(i); }}
                                  title="Register as new item"
                                  className="p-1.5 rounded-lg text-teal-600 hover:text-teal-800 hover:bg-teal-50 transition-colors"
                                >
                                  <Plus size={11} />
                                </button>
                                <button
                                  onClick={() => setSearchIdx(i)}
                                  title="Search & link existing item"
                                  className="p-1.5 rounded-lg text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                                >
                                  <Search size={11} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditIdx(i)}
                                title="Edit item details"
                                className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Edit size={11} />
                              </button>
                            )}
                            <button onClick={() => removeLine(i)} title="Remove row" className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedExtra.has(i) && l.extraFieldsJson && (() => {
                        try {
                          const extra = JSON.parse(l.extraFieldsJson) as Record<string, unknown>;
                          const entries = Object.entries(extra).filter(([, v]) => v !== null && v !== '');
                          if (entries.length === 0) return null;
                          return (
                            <tr className="bg-violet-50/40 border-b border-gray-50">
                              <td />
                              <td colSpan={13} className="px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                  {entries.map(([k, v]) => (
                                    <span key={k} className="inline-flex items-center gap-1 text-[9px] bg-white border border-violet-100 rounded-lg px-2 py-1">
                                      <span className="text-violet-500 font-semibold">{toTitleCase(k)}:</span>
                                      <span className="text-gray-700">{String(v)}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        } catch { return null; }
                      })()}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 5. Summary bar ─────────────────────────────────────────────── */}
          {lines.length > 0 && (
            <div className="mt-5 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-200 uppercase tracking-widest">Summary</span>
                <span className="ml-auto text-[10px] text-slate-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={`grid divide-x divide-gray-100 bg-white ${tcsAmount > 0 ? 'grid-cols-6' : 'grid-cols-5'}`}>
                {[
                  { label: 'Before Tax', value: totalBeforeTax, color: 'text-gray-800',   show: true },
                  { label: 'CGST',       value: totalCgst,      color: 'text-orange-600', show: true },
                  { label: 'SGST',       value: totalSgst,      color: 'text-orange-600', show: true },
                  { label: 'IGST',       value: totalIgst,      color: 'text-orange-600', show: true },
                  { label: 'TCS',        value: tcsAmount,      color: 'text-orange-600', show: tcsAmount > 0 },
                  { label: 'Net Amount', value: netAmount,       color: 'text-blue-700',   show: true },
                ].filter(c => c.show).map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${color}`}>₹{value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 6. Footer ───────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          {/* GSTIN mismatch warning */}
          {gstinMismatch && (
            <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <span className="text-amber-500 mt-0.5 text-base">⚠</span>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-800">GSTIN Mismatch</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Invoice shows <strong>{extractedGstin}</strong> but vendor record has <strong>{resolvedVendorGstin}</strong>.
                  Please verify before saving.
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={gstinAcknowledged} onChange={e => setGstinAcknowledged(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600" />
                  <span className="text-xs text-amber-800">I have verified and acknowledge this discrepancy</span>
                </label>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {lines.length} item{lines.length !== 1 ? 's' : ''} · Net ₹{netAmount.toFixed(2)}
              {unmatchedCount > 0 && <span className="ml-2 text-orange-500 font-medium">· {unmatchedCount} unmatched</span>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDiscardConfirm(true)} className="px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors">
                Discard
              </button>
              <button
                onClick={() => canSave ? setShowSaveConfirm(true) : undefined}
                disabled={!canSave || saving}
                title={
                  !hdr.vendorId ? 'Select a vendor first (Edit Header)' :
                  !hdr.storeId  ? 'Select a store first (Edit Header)'  :
                  unmatchedCount > 0 ? `Resolve ${unmatchedCount} unmatched item${unmatchedCount !== 1 ? 's' : ''} first` :
                  gstinMismatch && !gstinAcknowledged ? 'Acknowledge GSTIN mismatch first' :
                  lines.length === 0 ? 'No items to save' : undefined
                }
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                {saving ? 'Saving…' : 'Save Purchase'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation dialogs ─────────────────────────────────────────── */}
      <ConfirmationDialog
        isOpen={showSaveConfirm}
        title="Save Purchase?"
        message="This will save the invoice to Purchase Invoices. Stock is updated only after GRN final approval."
        variant="info"
        confirmText="Save"
        onConfirm={() => { setShowSaveConfirm(false); handleSave(); }}
        onClose={() => setShowSaveConfirm(false)}
      />
      <ConfirmationDialog
        isOpen={showDiscardConfirm}
        title="Discard extracted invoice?"
        message="All extracted data will be discarded. This cannot be undone."
        variant="danger"
        confirmText="Discard"
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
        onClose={() => setShowDiscardConfirm(false)}
      />

      {/* ── QuickVendorCreateModal — register new vendor (z-80) ─────────── */}
      {showVendorCreate && (
        <QuickVendorCreateModal
          prefillName={preview.header.vendorName?.value ?? ''}
          prefillGstin={extractedGstin}
          onCreated={v => {
            setExtraVendors(ev => [...ev, v]);
            setHdr(h => ({ ...h, vendorId: v.id }));
            setShowVendorCreate(false);
          }}
          onClose={() => setShowVendorCreate(false)}
        />
      )}

      {/* ── ItemSearchModal — unmatched row (z-60) ───────────────────────── */}
      {searchIdx !== null && (
        <div className="z-[60]">
          <ItemSearchModal
            storeId={hdr.storeId}
            onSelect={handleSearchSelectWrapped}
            onClose={() => setSearchIdx(null)}
            onCreateNew={handleSearchCreateNew}
          />
        </div>
      )}

      {/* ── QuickCreateItemModal — register new item (z-80) ──────────────── */}
      {createItemIdx !== null && (() => {
        const l = lines[createItemIdx];
        return (
          <QuickCreateItemModal
            prefillName={l?.itemName ?? ''}
            prefillHsn={l?.hsnCode  ?? ''}
            prefillGst={l?.gstPercent ?? 0}
            onCreated={item => {
              // Immediately clear "Not in master" badge for this row
              if (createItemIdx !== null) {
                setLines(prev => prev.map((l, i) =>
                  i === createItemIdx ? { ...l, itemId: item.id, itemName: item.itemName } : l
                ));
              }
              setSearchItem(item);
              setCreateItemIdx(null);
            }}
            onClose={() => {
              setCreateItemIdx(null);
              setPendingSearchIdx(null);
            }}
          />
        );
      })()}

      {/* ── ItemGstFormModal — after search, pre-filled (z-70) ───────────── */}
      {searchItem !== null && pendingSearchIdx !== null && (
        <div className="z-[70]">
          <ItemGstFormModal
            item={searchItem}
            lastMrp={searchLp?.lastMrp}
            lastPurchasePrice={searchLp?.lastPurchasePrice}
            initial={{
              orderedQuantity: lines[pendingSearchIdx]?.orderedQuantity,
              freeQuantity:    lines[pendingSearchIdx]?.freeQuantity,
              purchaseRate:    lines[pendingSearchIdx]?.purchaseRate,
              mrp:             lines[pendingSearchIdx]?.mrp,
              discountPercent: lines[pendingSearchIdx]?.discountPercent,
              batchNumber:     lines[pendingSearchIdx]?.batchNumber,
              expiryDate:      lines[pendingSearchIdx]?.expiryDate,
              gstPercent:      lines[pendingSearchIdx]?.gstPercent,
              cgstPercent:     lines[pendingSearchIdx]?.cgstPercent,
              sgstPercent:     lines[pendingSearchIdx]?.sgstPercent,
              igstPercent:     lines[pendingSearchIdx]?.igstPercent,
            }}
            onSave={handleSearchGstSave}
            onClose={() => { setSearchItem(null); setSearchLp(undefined); setPendingSearchIdx(null); }}
          />
        </div>
      )}

      {/* ── ItemGstFormModal — edit matched row (z-60) ───────────────────── */}
      {editIdx !== null && (() => {
        const l = lines[editIdx];
        return (
          <div className="z-[60]">
            <ItemGstFormModal
              item={buildEditItem(l)}
              initial={l}
              isEditing={true}
              onSave={handleEditSave}
              onClose={() => setEditIdx(null)}
            />
          </div>
        );
      })()}
    </>
  );
}

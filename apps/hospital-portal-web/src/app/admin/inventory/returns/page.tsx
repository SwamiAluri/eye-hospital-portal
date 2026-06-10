'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, Eye, Truck, FileText, CheckCircle,
  XCircle, ChevronLeft, ChevronRight, Trash2, X, Package,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ItemSearchModal } from '@/components/inventory/ItemSearchModal';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  inventoryReturnApi,
  inventoryVendorApi,
  inventoryStockApi,
  inventoryInvoiceApi,
  inventoryGrnApi,
  inventoryStoreApi,
  PurchaseReturnDto,
  PurchaseReturnItemDto,
  CreatePurchaseReturnRequest,
  CreateReturnItemRequest,
  RecordCreditNoteRequest,
  VendorDto,
  StockBatchDto,
  StoreDto,
  PurchaseInvoiceDto,
  GrnHeaderDto,
  ItemDto,
} from '@/lib/api/inventory-service.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const RETURN_REASONS = ['Damaged', 'Expired', 'Excess', 'QualityRejection', 'Other'];
const RETURN_CAUSES  = ['Damaged', 'Expired', 'Excess', 'QualityRejection', 'Other'];
const SOURCE_TYPES   = ['Manual', 'Invoice', 'GRN'];
const ALL_STATUSES   = ['All', 'Pending', 'SentToVendor', 'CreditNoteReceived', 'Settled', 'Cancelled'];

const STATUS_LABELS: Record<string, string> = {
  All:                 'All',
  Pending:             'Pending',
  SentToVendor:        'Sent to Vendor',
  CreditNoteReceived:  'Credit Note Received',
  Settled:             'Settled',
  Cancelled:           'Cancelled',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Pending:             'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
    SentToVendor:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    CreditNoteReceived:  'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    Settled:             'bg-green-50 text-green-700 ring-1 ring-green-200',
    Cancelled:           'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  };
  return `text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`;
}

function causeBadge(cause: string) {
  const map: Record<string, string> = {
    Damaged:          'bg-red-50 text-red-700',
    Expired:          'bg-orange-50 text-orange-700',
    Excess:           'bg-purple-50 text-purple-700',
    QualityRejection: 'bg-pink-50 text-pink-700',
    Other:            'bg-gray-100 text-gray-600',
  };
  return `text-xs px-2 py-0.5 rounded-full ${map[cause] ?? 'bg-gray-100 text-gray-600'}`;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n?: number) {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Local types ─────────────────────────────────────────────────────────────

interface SourceItem {
  itemId: string;
  itemName: string;
  purchaseRate: number;
  batchNumber?: string;
  expiryDate?: string;
  hsnCode?: string;
  gstPercent?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
}

interface ReturnLine {
  itemId: string;
  itemName: string;
  stockBatchId?: string;
  batchNumber?: string;
  batchStock?: number;
  expiryDate?: string;
  purchaseRate: number;
  returnQuantity: number;
  freeQuantity: number;
  amount: number;
  returnCause: string;
  hsnCode?: string;
  gstPercent: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  netAmount: number;
}

// ─── Source Item Picker Modal ────────────────────────────────────────────────

function SourceItemPickerModal({
  title, items, onSelect, onClose,
}: {
  title: string;
  items: SourceItem[];
  onSelect: (item: SourceItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => items.filter(i => i.itemName.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-3 py-2 border-b">
          <input
            autoFocus
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search item…"
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No items found</p>
          ) : filtered.map(item => (
            <button
              key={item.itemId}
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 text-left"
            >
              <span className="text-sm text-gray-900">{item.itemName}</span>
              <span className="text-xs text-gray-500">₹{item.purchaseRate.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Credit Note Modal ────────────────────────────────────────────────────────

function CreditNoteModal({
  returnId, returnNumber, onClose, onSaved, initialValues,
}: {
  returnId: string; returnNumber: string; onClose: () => void; onSaved: () => void;
  initialValues?: { creditNoteNumber: string; creditNoteAmount: number; creditNoteDate: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [creditNoteNumber, setCreditNoteNumber] = useState(initialValues?.creditNoteNumber ?? '');
  const [creditNoteAmount, setCreditNoteAmount] = useState(initialValues?.creditNoteAmount != null ? String(initialValues.creditNoteAmount) : '');
  const [creditNoteDate,   setCreditNoteDate]   = useState(initialValues?.creditNoteDate ?? today);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!creditNoteNumber.trim()) { toast.error('Credit note number is required'); return; }
    const amt = parseFloat(creditNoteAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid credit note amount'); return; }
    setSaving(true);
    try {
      const req: RecordCreditNoteRequest = {
        creditNoteNumber: creditNoteNumber.trim(),
        creditNoteAmount: amt,
        creditNoteDate:   creditNoteDate,
      };
      await inventoryReturnApi.recordCreditNote(returnId, req);
      toast.success('Credit note recorded');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to record credit note');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-semibold">{initialValues ? 'Amend Credit Note' : 'Record Credit Note'} — {returnNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {initialValues && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Updating will overwrite the existing credit note.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Credit Note Number *</label>
            <input value={creditNoteNumber} onChange={e => setCreditNoteNumber(e.target.value)}
              placeholder="e.g. CN-2024-001"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Amount *</label>
            <input type="number" min="0" step="0.01" value={creditNoteAmount} onChange={e => setCreditNoteAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date *</label>
            <input type="date" value={creditNoteDate} onChange={e => setCreditNoteDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Credit Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const [data,    setData]    = useState<PurchaseReturnDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [confirming, setConfirming]           = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    inventoryReturnApi.get(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: 'sendToVendor' | 'settle') => {
    if (!data) return;
    setActing(action);
    try {
      if (action === 'sendToVendor') {
        const updated = await inventoryReturnApi.sendToVendor(data.id);
        setData(d => d ? { ...d, settlementStatus: updated.settlementStatus, sentToVendorAt: updated.sentToVendorAt } : d);
        toast.success('Marked as sent to vendor');
      } else {
        const updated = await inventoryReturnApi.settle(data.id);
        setData(d => d ? { ...d, settlementStatus: updated.settlementStatus, settledAt: updated.settledAt } : d);
        toast.success('Return settled');
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Action failed');
    } finally { setActing(null); }
  };

  const doCancel = async () => {
    if (!data) return;
    // Require reason modal for CreditNoteReceived; still show it for other statuses so there's a clear confirmation
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!data || confirming) return;
    if (data.settlementStatus === 'CreditNoteReceived' && !cancelReason.trim()) {
      toast.error('Cancellation reason is required when a credit note has been received');
      return;
    }
    setConfirming(true);
    try {
      await inventoryReturnApi.cancel(data.id, cancelReason.trim() || undefined);
      toast.success('Return cancelled');
      setShowCancelModal(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Cancel failed');
    } finally { setConfirming(false); }
  };

  const balance = data ? (data.totalAmount - (data.creditNoteAmount ?? 0)) : 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Purchase Return Detail</h2>
              {data && <p className="text-xs text-gray-500 mt-0.5">{data.returnNumber}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 py-12">Loading…</p>
          ) : !data ? (
            <p className="text-center text-red-500 py-12">Return not found.</p>
          ) : (
            <div className="p-5 space-y-5">
              {/* Status bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={statusBadge(data.settlementStatus)}>{STATUS_LABELS[data.settlementStatus] ?? data.settlementStatus}</span>
                {data.sentToVendorAt && <span className="text-gray-400 text-xs">Sent: {fmtDate(data.sentToVendorAt)}</span>}
                {data.settledAt      && <span className="text-gray-400 text-xs">Settled: {fmtDate(data.settledAt)}</span>}
                <span className="ml-auto" />
                <span className={`text-xs px-2 py-0.5 rounded-full ${data.sourceType === 'Manual' ? 'bg-gray-100 text-gray-600' : data.sourceType === 'Invoice' ? 'bg-teal-50 text-teal-700' : 'bg-cyan-50 text-cyan-700'}`}>
                  Source: {data.sourceType}
                </span>
              </div>

              {/* Header grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-gray-500">Vendor:</span> <span className="font-medium">{data.vendorName}</span></div>
                <div><span className="text-gray-500">Return Date:</span> <span className="font-medium">{fmtDate(data.returnDate)}</span></div>
                {data.vendorContact && <div><span className="text-gray-500">Contact:</span> {data.vendorContact}</div>}
                {data.vendorPhone   && <div><span className="text-gray-500">Phone:</span> {data.vendorPhone}</div>}
                {data.purchaseCategory && <div><span className="text-gray-500">Category:</span> {data.purchaseCategory}</div>}
                <div><span className="text-gray-500">Return Reason:</span>
                  <span className={`ml-1 ${causeBadge(data.returnReason)}`}>{data.returnReason}</span>
                </div>
                <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold text-gray-900">{fmtCurrency(data.totalAmount)}</span></div>
                <div><span className="text-gray-500">Credit Note Amount:</span> <span className={`font-semibold ${data.creditNoteAmount ? 'text-green-700' : 'text-gray-400'}`}>{fmtCurrency(data.creditNoteAmount)}</span></div>
                {data.netReturnAmount != null && <div><span className="text-gray-500">Net Return (incl. GST):</span> <span className="font-semibold text-gray-900">{fmtCurrency(data.netReturnAmount)}</span></div>}
                {(data.cgstAmount || data.sgstAmount || data.igstAmount) && (
                  <div className="col-span-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-4">
                    {data.taxableAmount != null && <span>Taxable: <b>{fmtCurrency(data.taxableAmount)}</b></span>}
                    {data.cgstAmount ? <span>CGST: <b>{fmtCurrency(data.cgstAmount)}</b></span> : null}
                    {data.sgstAmount ? <span>SGST: <b>{fmtCurrency(data.sgstAmount)}</b></span> : null}
                    {data.igstAmount ? <span>IGST: <b>{fmtCurrency(data.igstAmount)}</b></span> : null}
                    {data.itcReversalAmount != null && <span className="text-amber-700">ITC Reversal: <b>{fmtCurrency(data.itcReversalAmount)}</b></span>}
                  </div>
                )}
                {data.creditNoteNumber && <div><span className="text-gray-500">Credit Note No:</span> <span className="font-medium">{data.creditNoteNumber}</span></div>}
                {data.creditNoteDate   && <div><span className="text-gray-500">Credit Note Date:</span> {fmtDate(data.creditNoteDate)}</div>}
                <div><span className="text-gray-500">Balance Outstanding:</span> <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtCurrency(balance)}</span></div>
                {data.paymentMode && <div><span className="text-gray-500">Payment Mode:</span> {data.paymentMode}</div>}
                {data.reference   && <div><span className="text-gray-500">Reference:</span> {data.reference}</div>}
                {data.remarks && <div className="col-span-2"><span className="text-gray-500">Remarks:</span> {data.remarks}</div>}
              </div>

              {/* Items table */}
              {data.items && data.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Return Items</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Product</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">HSN</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Batch</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Expiry</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Rate</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Taxable</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">GST%</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">CGST</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">SGST</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">IGST</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Net Amt</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.items.map((item: PurchaseReturnItemDto) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.itemName}</td>
                            <td className="px-3 py-2 text-gray-500">{item.hsnCode ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{item.batchNumber ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{item.expiryDate ? fmtDate(item.expiryDate) : '—'}</td>
                            <td className="px-3 py-2 text-right">{item.returnQuantity}</td>
                            <td className="px-3 py-2 text-right">₹{item.purchaseRate.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{item.taxableAmount != null ? `₹${item.taxableAmount.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{item.gstPercent != null && item.gstPercent > 0 ? `${item.gstPercent}%` : '—'}</td>
                            <td className="px-3 py-2 text-right text-blue-700">{item.cgstAmount != null && item.cgstAmount > 0 ? `₹${item.cgstAmount.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right text-blue-700">{item.sgstAmount != null && item.sgstAmount > 0 ? `₹${item.sgstAmount.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right text-indigo-700">{item.igstAmount != null && item.igstAmount > 0 ? `₹${item.igstAmount.toFixed(2)}` : '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold">{item.netAmount != null ? `₹${item.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</td>
                            <td className="px-3 py-2">
                              {item.returnCause && <span className={causeBadge(item.returnCause)}>{item.returnCause}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">{data.taxableAmount != null ? fmtCurrency(data.taxableAmount) : '—'}</td>
                          <td />
                          <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700">{data.cgstAmount != null && data.cgstAmount > 0 ? fmtCurrency(data.cgstAmount) : '—'}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700">{data.sgstAmount != null && data.sgstAmount > 0 ? fmtCurrency(data.sgstAmount) : '—'}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-indigo-700">{data.igstAmount != null && data.igstAmount > 0 ? fmtCurrency(data.igstAmount) : '—'}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">{fmtCurrency(data.netReturnAmount ?? data.totalAmount)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {data.settlementStatus !== 'Settled' && data.settlementStatus !== 'Cancelled' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {data.settlementStatus === 'Pending' && (
                    <button onClick={() => doAction('sendToVendor')} disabled={acting !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 disabled:opacity-50">
                      <Truck className="h-3.5 w-3.5" />
                      {acting === 'sendToVendor' ? '…' : 'Mark Sent to Vendor'}
                    </button>
                  )}
                  {(data.settlementStatus === 'Pending' || data.settlementStatus === 'SentToVendor') && (
                    <button onClick={() => setShowCreditNote(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200">
                      <FileText className="h-3.5 w-3.5" />
                      Record Credit Note
                    </button>
                  )}
                  {data.settlementStatus === 'CreditNoteReceived' && (
                    <>
                      <button onClick={() => setShowCreditNote(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200">
                        <FileText className="h-3.5 w-3.5" />
                        Amend Credit Note
                      </button>
                      <button onClick={() => doAction('settle')} disabled={acting !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {acting === 'settle' ? '…' : 'Mark Settled'}
                      </button>
                    </>
                  )}
                  <button onClick={doCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 ml-auto">
                    <XCircle className="h-3.5 w-3.5" /> Cancel Return
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreditNote && data && (
        <CreditNoteModal
          returnId={data.id}
          returnNumber={data.returnNumber}
          onClose={() => setShowCreditNote(false)}
          onSaved={() => { setShowCreditNote(false); load(); onRefresh(); }}
          initialValues={data.settlementStatus === 'CreditNoteReceived' && data.creditNoteNumber ? {
            creditNoteNumber: data.creditNoteNumber,
            creditNoteAmount: data.creditNoteAmount ?? 0,
            creditNoteDate: data.creditNoteDate ?? new Date().toISOString().slice(0, 10),
          } : undefined}
        />
      )}

      {/* ── Cancel Confirmation Modal ────────────────────────────────────── */}
      {showCancelModal && data && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-900">Cancel Return {data.returnNumber}</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {data.settlementStatus === 'CreditNoteReceived' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  A credit note of ₹{(data.creditNoteAmount ?? 0).toFixed(2)} has been applied to this return.
                  Cancelling will reverse the vendor ledger entry and restore the outstanding balance.
                  ITC of ₹{(data.itcReversalAmount ?? 0).toFixed(2)} will need to be re-claimed.
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Cancellation Reason {data.settlementStatus === 'CreditNoteReceived' ? '*' : '(optional)'}
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder={data.settlementStatus === 'CreditNoteReceived'
                    ? 'Required — explain why this return is being cancelled after credit note was received…'
                    : 'Optional — add a reason for the cancellation…'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Back
              </button>
              <button onClick={confirmCancel} disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {confirming ? 'Cancelling…' : 'Confirm Cancel Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inline Create Form ───────────────────────────────────────────────────────

function InlineCreateForm({
  vendors,
  onSaved,
  onCancel,
}: {
  vendors: VendorDto[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const { options: purchaseCategoryOptions } = useMasterValues('inventory.purchase_category');
  const { options: paymentModeOptions } = useMasterValues('billing.payment_mode');

  // ── Header state ──────────────────────────────────────────────────────
  const [purchaseCategory, setPurchaseCategory] = useState('');
  const [sourceType,        setSourceType]        = useState('Manual');
  const [vendorId,          setVendorId]           = useState('');
  const [returnDate,        setReturnDate]         = useState(today);
  const [returnReason,      setReturnReason]       = useState('Damaged');
  const [paymentMode,       setPaymentMode]        = useState('');
  const [reference,         setReference]          = useState('');
  const [remarks,           setRemarks]            = useState('');

  // ── Store state ───────────────────────────────────────────────────────
  const [storeId,       setStoreId]       = useState('');
  const [stores,        setStores]        = useState<StoreDto[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  // ── Invoice state (sourceType === 'Invoice') ──────────────────────────
  const [invoiceId,       setInvoiceId]       = useState('');
  const [invoicesList,    setInvoicesList]    = useState<PurchaseInvoiceDto[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoiceDto | null>(null);

  // ── GRN state (sourceType === 'GRN') ──────────────────────────────────
  const [grnId,       setGrnId]       = useState('');
  const [grnsList,    setGrnsList]    = useState<GrnHeaderDto[]>([]);
  const [grnsLoading, setGrnsLoading] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GrnHeaderDto | null>(null);

  // ── Item entry state ───────────────────────────────────────────────────
  const [entryItem,        setEntryItem]        = useState<ItemDto | null>(null);
  const [entrySourceRate,  setEntrySourceRate]  = useState(0);
  const [entryGstPct,      setEntryGstPct]      = useState(0);   // Manual mode only
  const [entryGstSource,   setEntryGstSource]   = useState<{ cgst: number; sgst: number; igst: number; hsn?: string }>({ cgst: 0, sgst: 0, igst: 0 });
  const [entryBatches,     setEntryBatches]     = useState<StockBatchDto[]>([]);
  const [entryBatchId,     setEntryBatchId]     = useState('');
  const [entryQty,         setEntryQty]         = useState('');
  const [entryFreeQty,     setEntryFreeQty]     = useState('0');
  const [entryCause,       setEntryCause]       = useState('');
  const [showSearch,       setShowSearch]       = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [batchLoading,     setBatchLoading]     = useState(false);

  const [lines,  setLines]  = useState<ReturnLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [showWorkflowInfo, setShowWorkflowInfo] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────
  const selectedVendor = useMemo(() => vendors.find(v => v.id === vendorId) ?? null, [vendors, vendorId]);
  const selectedBatch  = useMemo(() => entryBatches.find(b => b.id === entryBatchId) ?? null, [entryBatches, entryBatchId]);

  const entryReturnAmt = useMemo(() => {
    const q = parseFloat(entryQty) || 0;
    const r = selectedBatch?.purchaseRate ?? entrySourceRate;
    return Math.round(q * r * 100) / 100;
  }, [entryQty, selectedBatch, entrySourceRate]);

  const sourcePickerItems = useMemo((): SourceItem[] => {
    if (sourceType === 'Invoice' && selectedInvoice) {
      return selectedInvoice.items.map(i => ({
        itemId: i.itemId, itemName: i.itemName,
        purchaseRate: i.purchaseRate,
        batchNumber: i.batchNumber, expiryDate: i.expiryDate,
        hsnCode: i.hsnCode ?? undefined,
        gstPercent: i.gstPercent, cgstPercent: i.cgstPercent,
        sgstPercent: i.sgstPercent, igstPercent: i.igstPercent,
      }));
    }
    if (sourceType === 'GRN' && selectedGrn) {
      return selectedGrn.items.map(i => ({
        itemId: i.itemId, itemName: i.itemName,
        purchaseRate: i.purchaseRate,
        batchNumber: i.batchNumber, expiryDate: i.expiryDate,
        cgstPercent: i.cgstPercent, sgstPercent: i.sgstPercent, igstPercent: i.igstPercent,
      }));
    }
    return [];
  }, [sourceType, selectedInvoice, selectedGrn]);

  // ── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    setStoresLoading(true);
    inventoryStoreApi.list().then(setStores).catch(() => {}).finally(() => setStoresLoading(false));
  }, []);

  // Reset lines + source doc when source type changes
  useEffect(() => {
    setInvoiceId(''); setSelectedInvoice(null);
    setGrnId(''); setSelectedGrn(null);
    setEntryItem(null); setEntryBatches([]); setEntryBatchId('');
    setEntryQty(''); setEntryFreeQty('0'); setEntryCause('');
    setEntrySourceRate(0); setLines([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType]);

  // Load invoices for selected vendor when in Invoice mode
  useEffect(() => {
    if (sourceType !== 'Invoice' || !vendorId) {
      setInvoicesList([]); setInvoiceId(''); setSelectedInvoice(null); return;
    }
    setInvoicesLoading(true);
    inventoryInvoiceApi.list({ vendorId, pageSize: 100 })
      .then(r => setInvoicesList(r.items ?? []))
      .catch(() => setInvoicesList([]))
      .finally(() => setInvoicesLoading(false));
  }, [sourceType, vendorId]);

  useEffect(() => {
    if (!invoiceId) { setSelectedInvoice(null); return; }
    inventoryInvoiceApi.get(invoiceId).then(inv => {
      setSelectedInvoice(inv);
      if (inv.storeId) setStoreId(inv.storeId);
    }).catch(() => setSelectedInvoice(null));
  }, [invoiceId]);

  // Load GRNs for selected vendor when in GRN mode
  useEffect(() => {
    if (sourceType !== 'GRN' || !vendorId) {
      setGrnsList([]); setGrnId(''); setSelectedGrn(null); return;
    }
    setGrnsLoading(true);
    inventoryGrnApi.list({ pageSize: 200 })
      .then(r => setGrnsList((r.items ?? []).filter(g => g.vendorId === vendorId)))
      .catch(() => setGrnsList([]))
      .finally(() => setGrnsLoading(false));
  }, [sourceType, vendorId]);

  useEffect(() => {
    if (!grnId) { setSelectedGrn(null); return; }
    inventoryGrnApi.get(grnId).then(grn => {
      setSelectedGrn(grn);
      if (grn.storeId) setStoreId(grn.storeId);
    }).catch(() => setSelectedGrn(null));
  }, [grnId]);

  // Load batches scoped to the selected store
  useEffect(() => {
    if (!entryItem) { setEntryBatches([]); setEntryBatchId(''); return; }
    setBatchLoading(true);
    inventoryStockApi.getBatches(storeId || undefined, entryItem.id)
      .then(batches => {
        setEntryBatches(batches);
        if (batches.length === 1) setEntryBatchId(batches[0].id);
        else setEntryBatchId('');
      })
      .catch(() => setEntryBatches([]))
      .finally(() => setBatchLoading(false));
  }, [entryItem, storeId]);

  // ── Actions ────────────────────────────────────────────────────────────
  const clearEntryRow = () => {
    setEntryItem(null); setEntryBatches([]); setEntryBatchId('');
    setEntryQty(''); setEntryFreeQty('0'); setEntryCause('');
    setEntrySourceRate(0); setEntryGstPct(0);
    setEntryGstSource({ cgst: 0, sgst: 0, igst: 0 });
  };

  const handleOpenSearch = () => {
    if (!storeId) { toast.error('Select a store before adding items'); return; }
    if (sourceType === 'Invoice') {
      if (!invoiceId) { toast.error('Select an invoice first'); return; }
      setShowSourcePicker(true);
    } else if (sourceType === 'GRN') {
      if (!grnId) { toast.error('Select a GRN first'); return; }
      setShowSourcePicker(true);
    } else {
      setShowSearch(true);
    }
  };

  const handleSourceItemSelect = (item: SourceItem) => {
    const dto: ItemDto = {
      id: item.itemId, itemName: item.itemName, unit: '',
      itemType: '', requiresColdStorage: false, isBarcodeTracked: false,
      reorderLevel: 0, reorderQuantity: 0, status: 'active',
    };
    setEntryItem(dto);
    setEntrySourceRate(item.purchaseRate);
    setEntryGstSource({
      cgst: item.cgstPercent ?? (item.gstPercent ? item.gstPercent / 2 : 0),
      sgst: item.sgstPercent ?? (item.gstPercent ? item.gstPercent / 2 : 0),
      igst: item.igstPercent ?? 0,
      hsn:  item.hsnCode,
    });
    setShowSourcePicker(false);
  };

  const addLine = () => {
    if (!entryItem)               { toast.error('Select a product');             return; }
    if (!entryCause)              { toast.error('Select a cause of return');     return; }
    const qty = parseFloat(entryQty);
    if (isNaN(qty) || qty <= 0)   { toast.error('Enter a valid quantity');       return; }
    if (entryBatches.length > 0 && !entryBatchId) {
      toast.error('Select a batch for this item'); return;
    }
    if (selectedBatch && qty > selectedBatch.quantityAvailable) {
      toast.error(`Quantity (${qty}) exceeds available batch stock (${selectedBatch.quantityAvailable})`); return;
    }
    const rate = selectedBatch?.purchaseRate ?? entrySourceRate;

    // GST: for Manual use entryGstPct split as CGST/SGST; for Invoice/GRN use inherited rates
    const cgstPct = sourceType === 'Manual' ? entryGstPct / 2 : entryGstSource.cgst;
    const sgstPct = sourceType === 'Manual' ? entryGstPct / 2 : entryGstSource.sgst;
    const igstPct = sourceType === 'Manual' ? 0              : entryGstSource.igst;
    const gstPct  = cgstPct + sgstPct + igstPct;
    const taxableAmt = Math.round(qty * rate * 100) / 100;
    const cgstAmt    = Math.round(taxableAmt * cgstPct / 100 * 100) / 100;
    const sgstAmt    = Math.round(taxableAmt * sgstPct / 100 * 100) / 100;
    const igstAmt    = Math.round(taxableAmt * igstPct / 100 * 100) / 100;
    const netAmt     = taxableAmt + cgstAmt + sgstAmt + igstAmt;

    setLines(prev => [...prev, {
      itemId: entryItem.id, itemName: entryItem.itemName,
      stockBatchId: entryBatchId || undefined,
      batchNumber:  selectedBatch?.batchNumber ?? undefined,
      batchStock:   selectedBatch?.quantityAvailable,
      expiryDate:   selectedBatch?.expiryDate ?? undefined,
      purchaseRate: rate, returnQuantity: qty,
      freeQuantity: parseFloat(entryFreeQty) || 0,
      amount: taxableAmt,
      returnCause: entryCause,
      hsnCode:      entryGstSource.hsn,
      gstPercent:   gstPct,
      cgstPercent:  cgstPct,
      sgstPercent:  sgstPct,
      igstPercent:  igstPct,
      taxableAmount: taxableAmt,
      cgstAmount:   cgstAmt,
      sgstAmount:   sgstAmt,
      igstAmount:   igstAmt,
      netAmount:    netAmt,
    }]);
    clearEntryRow();
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const gstTotals = useMemo(() => ({
    taxable: lines.reduce((s, l) => s + l.taxableAmount, 0),
    cgst:    lines.reduce((s, l) => s + l.cgstAmount,    0),
    sgst:    lines.reduce((s, l) => s + l.sgstAmount,    0),
    igst:    lines.reduce((s, l) => s + l.igstAmount,    0),
    net:     lines.reduce((s, l) => s + l.netAmount,     0),
  }), [lines]);

  const totalAmount = gstTotals.net;

  const handleSave = async () => {
    if (!vendorId)     { toast.error('Select a vendor');       return; }
    if (!storeId)      { toast.error('Select a store');        return; }
    if (!lines.length) { toast.error('Add at least one item'); return; }
    if (sourceType === 'Invoice' && !invoiceId) { toast.error('Select an invoice for Invoice-linked return'); return; }
    if (sourceType === 'GRN'     && !grnId)     { toast.error('Select a GRN for GRN-linked return');         return; }
    setSaving(true);
    const tid = toast.loading('Saving purchase return…');
    try {
      const req: CreatePurchaseReturnRequest = {
        sourceType, vendorId,
        invoiceId: sourceType === 'Invoice' ? invoiceId || undefined : undefined,
        grnId:     sourceType === 'GRN'     ? grnId     || undefined : undefined,
        purchaseCategory: purchaseCategory || undefined,
        returnDate: new Date(returnDate).toISOString(),
        returnReason,
        paymentMode: paymentMode || undefined,
        reference:   reference   || undefined,
        remarks:     remarks     || undefined,
        items: lines.map((l): CreateReturnItemRequest => ({
          itemId: l.itemId, stockBatchId: l.stockBatchId,
          returnQuantity: l.returnQuantity, freeQuantity: l.freeQuantity,
          purchaseRate: l.purchaseRate, returnCause: l.returnCause,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : undefined,
          hsnCode:     l.hsnCode,
          gstPercent:  l.gstPercent  || undefined,
          cgstPercent: l.cgstPercent || undefined,
          sgstPercent: l.sgstPercent || undefined,
          igstPercent: l.igstPercent || undefined,
        })),
      };
      const result = await inventoryReturnApi.create(req);
      toast.dismiss(tid);
      toast.success(`Return ${result.returnNumber} created`);
      onSaved();
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data ?? err?.message ?? 'Failed to create return');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400';
  const lblCls   = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900">New Purchase Return</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedVendor ? `Vendor: ${selectedVendor.name}` : 'Fill in return details to proceed'}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70">
          <X size={16} />
        </button>
      </div>



      {/* Header fields */}
      <div className="px-5 py-5">
        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-4">Return Details</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={lblCls}>Purchase Category</label>
            <select value={purchaseCategory} onChange={e => setPurchaseCategory(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {purchaseCategoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Vendor *</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputCls}>
              <option value="">Select Vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Return Date</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className={inputCls} />
          </div>

          {selectedVendor && (
            <div className="col-span-2 md:col-span-3 grid grid-cols-3 gap-3 bg-orange-50/60 border border-orange-100 rounded-xl p-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier Address</p>
                <p className="text-sm text-gray-700">{selectedVendor.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Person</p>
                <p className="text-sm text-gray-700">{selectedVendor.contactPerson ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                <p className="text-sm text-gray-700">{selectedVendor.phone ?? '—'}</p>
              </div>
            </div>
          )}

          <div>
            <label className={`${lblCls} flex items-center gap-1`}>
              Source Type
              <button type="button" onClick={() => setShowWorkflowInfo(s => !s)}
                className="ml-1 text-orange-400 hover:text-orange-600 leading-none" title="How source types work"
              >ⓘ</button>
            </label>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={inputCls}>
              {SOURCE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={`${lblCls} flex items-center gap-1`}>
              Store *
              {(selectedInvoice || selectedGrn) && (
                <span className="normal-case font-normal text-teal-600 text-[10px]">(auto from source doc)</span>
              )}
            </label>
            <select value={storeId} onChange={e => setStoreId(e.target.value)}
              className={inputCls}
              disabled={storesLoading || !!(selectedInvoice || selectedGrn)}>
              <option value="">{storesLoading ? 'Loading…' : 'Select Store…'}</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.storeName}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Return Reason (Overall)</label>
            <select value={returnReason} onChange={e => setReturnReason(e.target.value)} className={inputCls}>
              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {showWorkflowInfo && (
            <div className="col-span-2 md:col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-gray-700 space-y-1.5">
              <p><span className="font-semibold text-gray-800">Manual</span> — Free-form return. Select store, search any in-stock item, choose batch. Requires strong reason &amp; remarks.</p>
              <p><span className="font-semibold text-teal-700">Invoice</span> — Linked to a purchase invoice. Only invoice line items are selectable. Rate auto-filled from invoice. Store auto-set from invoice.</p>
              <p><span className="font-semibold text-cyan-700">GRN</span> — Linked to a received GRN. Only GRN items are selectable. Rate from GRN&rsquo;s invoice. Store and batch auto-populated from the GRN.</p>
            </div>
          )}

          {/* Invoice selector — shown when sourceType = Invoice and vendor chosen */}
          {sourceType === 'Invoice' && vendorId && (
            <div className="col-span-2 md:col-span-3 bg-teal-50/50 border border-teal-100 rounded-xl p-3">
              <label className={`${lblCls} text-teal-700`}>
                Invoice * <span className="normal-case font-normal text-gray-500">(items from this invoice will be available for return)</span>
              </label>
              <select
                value={invoiceId}
                onChange={e => { setInvoiceId(e.target.value); clearEntryRow(); setLines([]); }}
                className={`${inputCls} border-teal-200`}
                disabled={invoicesLoading}
              >
                <option value="">{invoicesLoading ? 'Loading…' : 'Select Invoice…'}</option>
                {invoicesList.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {fmtDate(inv.invoiceDate)} — {fmtCurrency(inv.netAmount)}
                  </option>
                ))}
              </select>
              {invoiceId && selectedInvoice && (
                <p className="text-xs text-teal-600 mt-1.5">
                  {selectedInvoice.items.length} item(s) available · Net: {fmtCurrency(selectedInvoice.netAmount)}
                </p>
              )}
            </div>
          )}

          {/* GRN selector — shown when sourceType = GRN and vendor chosen */}
          {sourceType === 'GRN' && vendorId && (
            <div className="col-span-2 md:col-span-3 bg-cyan-50/50 border border-cyan-100 rounded-xl p-3">
              <label className={`${lblCls} text-cyan-700`}>
                GRN * <span className="normal-case font-normal text-gray-500">(GRNs for selected vendor)</span>
              </label>
              <select
                value={grnId}
                onChange={e => { setGrnId(e.target.value); clearEntryRow(); setLines([]); }}
                className={`${inputCls} border-cyan-200`}
                disabled={grnsLoading}
              >
                <option value="">{grnsLoading ? 'Loading…' : 'Select GRN…'}</option>
                {grnsList.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.grnNumber ?? g.id.slice(0, 8)} — {fmtDate(g.grnDate)} — {g.invoiceNumber}
                  </option>
                ))}
              </select>
              {grnId && selectedGrn && (
                <p className="text-xs text-cyan-600 mt-1.5">
                  {selectedGrn.items.length} item(s) in GRN · Invoice: {selectedGrn.invoiceNumber}
                </p>
              )}
            </div>
          )}

          <div>
            <label className={lblCls}>Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {paymentModeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO No / Ref…" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={lblCls}>Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Item entry row */}
      <div className="px-5 py-4 border-t border-dashed border-gray-200 bg-gray-50/50">
        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">Add Item</p>
        {!storeId && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Select a store above to enable item and batch selection.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
          <div className="col-span-2">
            <label className={lblCls}>Product *</label>
            <button onClick={handleOpenSearch} disabled={!storeId}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white hover:border-orange-400 text-left truncate disabled:opacity-50 disabled:cursor-not-allowed">
              {entryItem ? (
                <span className="truncate text-gray-800">{entryItem.itemName}</span>
              ) : (
                <><Search className="h-4 w-4 text-gray-400 flex-shrink-0" /><span className="text-gray-400">
                  {sourceType === 'Invoice' ? 'Pick from invoice…' : sourceType === 'GRN' ? 'Pick from GRN…' : 'Search product…'}
                </span></>
              )}
            </button>
          </div>
          <div>
            <label className={lblCls}>Batch</label>
            <select value={entryBatchId} onChange={e => setEntryBatchId(e.target.value)}
              disabled={entryBatches.length === 0} className={`${inputCls} disabled:bg-gray-50`}>
              <option value="">{batchLoading ? 'Loading…' : entryBatches.length === 0 ? 'No batches' : 'Select…'}</option>
              {entryBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber ?? 'AUTO'}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Batch Stock</label>
            <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl min-h-[38px]">
              {selectedBatch ? selectedBatch.quantityAvailable : '—'}
            </div>
          </div>
          <div>
            <label className={lblCls}>Expiry</label>
            <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl min-h-[38px] truncate">
              {selectedBatch?.expiryDate ? fmtDate(selectedBatch.expiryDate) : '—'}
            </div>
          </div>
          <div>
            <label className={lblCls}>Quantity *</label>
            <input type="number" min="0.001" step="any" value={entryQty} onChange={e => setEntryQty(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Free</label>
            <input type="number" min="0" step="any" value={entryFreeQty} onChange={e => setEntryFreeQty(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Item Cause *</label>
            <select value={entryCause} onChange={e => setEntryCause(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {RETURN_CAUSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {sourceType === 'Manual' ? (
            <div>
              <label className={lblCls}>GST %</label>
              <select value={entryGstPct} onChange={e => setEntryGstPct(Number(e.target.value))} className={inputCls}>
                {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          ) : (entryGstSource.cgst + entryGstSource.sgst + entryGstSource.igst > 0) && (
            <div>
              <label className={lblCls}>GST %</label>
              <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl min-h-[38px]">
                {(entryGstSource.cgst + entryGstSource.sgst + entryGstSource.igst).toFixed(0)}%
              </div>
            </div>
          )}
          <div>
            <label className={lblCls}>Return Amt</label>
            <div className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-xl min-h-[38px]">
              {entryReturnAmt > 0 ? `₹${entryReturnAmt.toFixed(2)}` : '—'}
            </div>
          </div>
          <div className="flex gap-2 col-span-2">
            <button onClick={clearEntryRow}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-xl">
              <RefreshCw className="h-3.5 w-3.5" /> Clear
            </button>
            <button onClick={addLine}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Lines table */}
      {lines.length > 0 && (
        <div className="px-5 pb-1">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">Sl</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Product</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Batch</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Expiry</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Ret Qty</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Price</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Taxable</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">CGST</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">SGST</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">IGST</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Net Amt</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Item Cause</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-orange-50/30">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{line.itemName}</td>
                    <td className="px-3 py-2 text-gray-600">{line.batchNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{line.expiryDate ? fmtDate(line.expiryDate) : '—'}</td>
                    <td className="px-3 py-2 text-right">{line.returnQuantity}</td>
                    <td className="px-3 py-2 text-right">₹{line.purchaseRate.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">₹{line.taxableAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.cgstAmount > 0 ? `₹${line.cgstAmount.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.sgstAmount > 0 ? `₹${line.sgstAmount.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{line.igstAmount > 0 ? `₹${line.igstAmount.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">₹{line.netAmount.toFixed(2)}</td>
                    <td className="px-3 py-2"><span className={causeBadge(line.returnCause)}>{line.returnCause}</span></td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900">₹{gstTotals.taxable.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{gstTotals.cgst > 0 ? `₹${gstTotals.cgst.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{gstTotals.sgst > 0 ? `₹${gstTotals.sgst.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{gstTotals.igst > 0 ? `₹${gstTotals.igst.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">₹{gstTotals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* GST Summary block */}
      {lines.length > 0 && (gstTotals.cgst > 0 || gstTotals.sgst > 0 || gstTotals.igst > 0) && (
        <div className="mx-5 mb-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 grid grid-cols-5 gap-4 text-xs text-blue-900">
          <div><div className="text-gray-500 uppercase tracking-wide mb-0.5">Taxable</div><div className="font-semibold">₹{gstTotals.taxable.toFixed(2)}</div></div>
          <div><div className="text-gray-500 uppercase tracking-wide mb-0.5">CGST</div><div className="font-semibold">₹{gstTotals.cgst.toFixed(2)}</div></div>
          <div><div className="text-gray-500 uppercase tracking-wide mb-0.5">SGST</div><div className="font-semibold">₹{gstTotals.sgst.toFixed(2)}</div></div>
          <div><div className="text-gray-500 uppercase tracking-wide mb-0.5">IGST</div><div className="font-semibold">₹{gstTotals.igst.toFixed(2)}</div></div>
          <div><div className="text-gray-500 uppercase tracking-wide mb-0.5">Net Return</div><div className="font-bold text-blue-800">₹{gstTotals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
        <p className="text-xs text-gray-400">
          {lines.length === 0 ? 'Add items above to proceed' : `${lines.length} item(s) · ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving || lines.length === 0}
            className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Return'}
          </button>
        </div>
      </div>

      {showSearch && (
        <ItemSearchModal
          onSelect={item => { setEntryItem(item); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showSourcePicker && sourcePickerItems.length > 0 && (
        <SourceItemPickerModal
          title={sourceType === 'Invoice'
            ? `Invoice Items — ${selectedInvoice?.invoiceNumber ?? ''}`
            : `GRN Items — ${selectedGrn?.grnNumber ?? selectedGrn?.id.slice(0, 8) ?? ''}`}
          items={sourcePickerItems}
          onSelect={handleSourceItemSelect}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const [mode, setMode] = useState<'list' | 'create'>('list');

  const { options: categoryFilterOptions } = useMasterValues('inventory.purchase_category');

  const [data,     setData]     = useState<{ total: number; page: number; pageSize: number; items: PurchaseReturnDto[] } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [page,     setPage]     = useState(1);
  const [vendors,  setVendors]  = useState<VendorDto[]>([]);

  const [statusFilter,   setStatusFilter]   = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [vendorFilter,   setVendorFilter]   = useState('');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [search,         setSearch]         = useState('');
  const [pendingOnly,    setPendingOnly]     = useState(false);
  const [cnSettled,      setCnSettled]      = useState(false);

  const effectiveStatus = cnSettled
    ? 'CreditNoteReceived'
    : pendingOnly
      ? 'Pending'
      : statusFilter === 'All' ? undefined : statusFilter;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await inventoryReturnApi.list({
        page, pageSize: 20,
        status:           effectiveStatus,
        purchaseCategory: categoryFilter || undefined,
        vendorId:         vendorFilter   || undefined,
        fromDate:         fromDate       || undefined,
        toDate:           toDate         || undefined,
        search:           search         || undefined,
      });
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data ?? err?.message ?? 'Failed to load returns.');
    } finally { setLoading(false); }
  }, [page, effectiveStatus, categoryFilter, vendorFilter, fromDate, toDate, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    inventoryVendorApi.list(1, 200)
      .then(r => setVendors(r.items ?? []))
      .catch(() => {});
  }, []);

  const pageCount = data ? Math.ceil(data.total / 20) : 0;

  if (mode === 'create') {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-5 text-sm text-gray-500">
          <button onClick={() => setMode('list')} className="hover:text-gray-800">Purchase Returns</button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-800 font-medium">New Return</span>
        </div>
        <InlineCreateForm
          vendors={vendors}
          onSaved={() => { setMode('list'); load(); }}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50" title="Refresh">
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
        <button onClick={() => setMode('create')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 shadow-sm">
          <Plus className="h-4 w-4" /> New Purchase Return
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Purchase Category</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400">
              <option value="">All Categories</option>
              {categoryFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vendor</label>
            <select value={vendorFilter} onChange={e => { setVendorFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400">
              <option value="">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Search</label>
            <div className="flex gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }}
                placeholder="Return # or vendor…"
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400" />
              <button onClick={() => { setPage(1); load(); }}
                className="px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPendingOnly(false); setCnSettled(false); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !pendingOnly && !cnSettled && statusFilter === s
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
              }`}>
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
          <span className="mx-1 text-gray-200">|</span>
          <button onClick={() => { setPendingOnly(p => !p); setCnSettled(false); setStatusFilter('All'); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              pendingOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-300 hover:border-amber-400'
            }`}>
            ■ Pending Only
          </button>
          <button onClick={() => { setCnSettled(s => !s); setPendingOnly(false); setStatusFilter('All'); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              cnSettled ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300 hover:border-green-400'
            }`}>
            ■ Credit Note Received
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-8">Sl</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Return No</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Credit Note #</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600">Credit Note Amt</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Supplier</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Purchase Type</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600">Return Amount</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600">Balance</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Cleared</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Remarks</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={14} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={14} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Package className="h-10 w-10" />
                      <p>No purchase returns found.</p>
                      <button onClick={() => setMode('create')}
                        className="mt-1 px-4 py-1.5 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50">
                        Create first return
                      </button>
                    </div>
                  </td>
                </tr>
              ) : data.items.map((ret, idx) => {
                const balance = ret.totalAmount - (ret.creditNoteAmount ?? 0);
                const cleared = balance <= 0 && ret.settlementStatus === 'Settled';
                return (
                  <tr key={ret.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailId(ret.id)}>
                    <td className="px-3 py-2.5 text-gray-400">{(page - 1) * 20 + idx + 1}</td>
                    <td className="px-3 py-2.5"><span className={statusBadge(ret.settlementStatus)}>{STATUS_LABELS[ret.settlementStatus] ?? ret.settlementStatus}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(ret.returnDate)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{ret.returnNumber}</td>
                    <td className="px-3 py-2.5 text-gray-600">{ret.creditNoteNumber ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{ret.creditNoteAmount != null ? fmtCurrency(ret.creditNoteAmount) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{ret.sourceType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate">{ret.vendorName}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{ret.purchaseCategory ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{fmtCurrency(ret.netReturnAmount ?? ret.totalAmount)}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmtCurrency(balance)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${cleared ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {cleared ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[120px] truncate">{ret.remarks ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDetailId(ret.id)}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-xs border rounded hover:bg-blue-50 text-blue-600">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Showing page {page} of {pageCount} ({data?.total} returns)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {detailId && (
        <DetailModal id={detailId} onClose={() => setDetailId(null)} onRefresh={load} />
      )}
    </div>
  );
}

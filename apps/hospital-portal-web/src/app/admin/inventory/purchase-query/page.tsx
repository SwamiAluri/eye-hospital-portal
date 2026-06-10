'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, RefreshCw, FileText, XCircle, Paperclip,
  PackageCheck, CheckCircle2, AlertTriangle,
  Pencil, Printer, ChevronLeft, ChevronRight, X, Eye, Send,
  Package, ShoppingCart, Tag, Ban, ClipboardList,
  Calendar, Hash, Building2, CreditCard, Store,
  Plus, Trash2, Edit, Settings, ListOrdered, MoreHorizontal, ArrowRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import {
  inventoryGrnApi,
  inventoryInvoiceApi,
  inventoryVendorApi,
  inventoryBillTransferApi,
  inventorySettlementApi,
  inventoryVendorBankAccountApi,
  GrnHeaderDto,
  VendorDto,
  PurchaseInvoiceDto,
  PurchaseItemDto,
  type BillTransferDto,
  type BillTransferStatus,
  type InvoiceSettlementDto,
  type SettlementStatus,
  type RecordSettlementPaymentRequest,
  type SettlementEventLogDto,
  type VendorPaymentDto,
  type VendorReconciliationReport,
  type ReconciliationLine,
  type VendorBankAccountDto,
} from '@/lib/api/inventory-service.api';
import { getBankBadge, filterBanks, detectBankFromIfsc } from '@/lib/indian-banks';
import { ItemSearchModal, LastPurchaseInfo } from '@/components/inventory/ItemSearchModal';
import { ItemGstFormModal, GrnLineItem } from '@/components/inventory/ItemGstFormModal';
import { InvoiceDetailDrawer } from '@/components/inventory/InvoiceDetailDrawer';
import type { ItemDto } from '@/lib/api/inventory-service.api';
import { useMasterValues } from '@/hooks/use-master-values';
import { useInventoryPaymentModeLabels } from '@/hooks/use-payment-modes';

// ─── Constants ──────────────────────────────────────────────────────────────────
const MODULE_TABS = ['GRN', 'Bill Transfer', 'Settlements'] as const;

const STATUS_TABS = [
  { key: 'All',             label: 'All',              dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'InvoiceDraft',    label: 'Draft',            dot: 'bg-yellow-400',  activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
  { key: 'GRNNotGenerated', label: 'Not Generated',    dot: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white' },
  { key: 'Draft',           label: 'Not Approved',     dot: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'PrimaryApproved', label: 'Primary Approved', dot: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'Approved',        label: 'Approved',         dot: 'bg-blue-500',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'Cancelled',       label: 'Cancelled',        dot: 'bg-rose-500',    activeClass: 'bg-rose-500 border-rose-500 text-white' },
];

const STATUS_BORDER: Record<string, string> = {
  GRNNotGenerated: 'border-l-teal-400',
  InvoiceDraft:    'border-l-yellow-400',
  Draft:           'border-l-amber-400',
  PrimaryApproved: 'border-l-emerald-400',
  Approved:        'border-l-blue-400',
  Cancelled:       'border-l-rose-400',
  Rejected:        'border-l-rose-400',
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  GRNNotGenerated: { bg: 'bg-teal-100 text-teal-700',       label: 'Not Generated'    },
  InvoiceDraft:    { bg: 'bg-yellow-100 text-yellow-700',   label: 'Draft'            },
  Draft:           { bg: 'bg-amber-100 text-amber-700',     label: 'Not Approved'     },
  PrimaryApproved: { bg: 'bg-emerald-100 text-emerald-700', label: 'Primary Approved' },
  Approved:        { bg: 'bg-blue-100 text-blue-700',       label: 'Approved'         },
  Cancelled:       { bg: 'bg-rose-100 text-rose-700',       label: 'Cancelled'        },
  Rejected:        { bg: 'bg-rose-100 text-rose-700',       label: 'Rejected'         },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function fmtINR(n?: number | null) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ─── Mini progress bar ────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-2 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { bg: 'bg-gray-100 text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[100, 90, 80, 130, 110, 90, 90, 80, 90, 90].map((w, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Inline action buttons ────────────────────────────────────────────────────────
function ActionButtons({
  row,
  onEdit,
  onGenerateGrn,
  onSubmitInvoice,
  onCancelGrn,
  onCancelInvoice,
  onPrimaryApproval,
  onFinalApproval,
  onPrint,
  onViewDetails,
}: {
  row: GrnHeaderDto;
  onEdit:            (r: GrnHeaderDto) => void;
  onGenerateGrn:     (r: GrnHeaderDto) => void;
  onSubmitInvoice:   (r: GrnHeaderDto) => void;
  onCancelGrn:       (r: GrnHeaderDto) => void;
  onCancelInvoice:   (r: GrnHeaderDto) => void;
  onPrimaryApproval: (r: GrnHeaderDto) => void;
  onFinalApproval:   (r: GrnHeaderDto) => void;
  onPrint:           (r: GrnHeaderDto) => void;
  onViewDetails:     (r: GrnHeaderDto) => void;
}) {
  const btn = (title: string, icon: React.ReactNode, onClick: () => void, cls: string) => (
    <button
      key={title}
      title={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`p-1.5 rounded-lg transition-colors ${cls}`}
    >
      {icon}
    </button>
  );

  switch (row.grnStatus) {
    case 'GRNNotGenerated':
      if (row.approvalStatus === 'Draft') {
        return (
          <div className="flex items-center gap-0.5">
            {btn('Submit Invoice', <Send size={14} />,   () => onSubmitInvoice(row), 'text-yellow-600 hover:bg-yellow-50')}
            {btn('Edit',           <Pencil size={14} />, () => onEdit(row),          'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
            {btn('Cancel Invoice', <XCircle size={14} />,() => onCancelInvoice(row), 'text-gray-400 hover:text-rose-600 hover:bg-rose-50')}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-0.5">
          {btn('Generate GRN',   <PackageCheck size={14} />, () => onGenerateGrn(row),  'text-teal-600 hover:bg-teal-50')}
          {btn('Edit',           <Pencil size={14} />,       () => onEdit(row),          'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
          {btn('Cancel Invoice', <XCircle size={14} />,      () => onCancelInvoice(row), 'text-gray-400 hover:text-rose-600 hover:bg-rose-50')}
        </div>
      );
    case 'Draft':
      return (
        <div className="flex items-center gap-0.5">
          {btn('Primary Approval', <CheckCircle2 size={14} />, () => onPrimaryApproval(row), 'text-amber-500 hover:bg-amber-50')}
          {btn('Edit',             <Pencil size={14} />,       () => onEdit(row),             'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
          {btn('Print',            <Printer size={14} />,      () => onPrint(row),            'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}
          {btn('Cancel GRN',       <XCircle size={14} />,      () => onCancelGrn(row),        'text-gray-400 hover:text-rose-600 hover:bg-rose-50')}
        </div>
      );
    case 'PrimaryApproved':
      return (
        <div className="flex items-center gap-0.5">
          {btn('Final Approval', <CheckCircle2 size={14} />, () => onFinalApproval(row), 'text-emerald-600 hover:bg-emerald-50')}
          {btn('Edit',           <Pencil size={14} />,       () => onEdit(row),           'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
          {btn('Print',          <Printer size={14} />,      () => onPrint(row),          'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}
          {btn('Cancel GRN',     <XCircle size={14} />,      () => onCancelGrn(row),      'text-gray-400 hover:text-rose-600 hover:bg-rose-50')}
        </div>
      );
    case 'Approved':
      return (
        <div className="flex items-center gap-0.5">
          {btn('View Details', <Eye size={14} />,     () => onViewDetails(row), 'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
          {btn('Print',        <Printer size={14} />, () => onPrint(row),       'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}
        </div>
      );
    default:
      return null;
  }
}

// ─── MetaRow helper ──────────────────────────────────────────────────────────────
function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-xs font-medium text-gray-700">{value || '—'}</span>
    </div>
  );
}

// ─── MetaChip helper (used in GrnDetailsModal metadata strip) ────────────────────
function MetaChip({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-blue-100 shadow-sm rounded-lg px-3 py-1.5">
      {icon && <span className="text-blue-400 flex-shrink-0">{icon}</span>}
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <span className="text-xs font-semibold text-gray-800 truncate max-w-[160px]">{value || '—'}</span>
      </div>
    </div>
  );
}

// ─── GRN Details modal ────────────────────────────────────────────────────────────
function GrnDetailsModal({ row, onClose, onPrint }: { row: GrnHeaderDto; onClose: () => void; onPrint: (r: GrnHeaderDto) => void }) {
  const [fetchedInv, setFetchedInv] = useState<PurchaseInvoiceDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    inventoryInvoiceApi.get(row.invoiceId)
      .then(inv => { if (!cancelled) setFetchedInv(inv); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [row.invoiceId]);

  const items = (fetchedInv?.items ?? []) as PurchaseItemDto[];

  const taxable = fetchedInv?.taxableAmount ?? 0;
  const cgst    = (fetchedInv?.totalGst ?? 0) / 2;
  const sgst    = (fetchedInv?.totalGst ?? 0) / 2;
  const igst    = 0;

  const isCancelled = row.grnStatus === 'Cancelled' || row.grnStatus === 'Rejected';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden mt-6 mb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">Purchase Details</h2>
                {row.grnNumber && (
                  <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">
                    {row.grnNumber}
                  </span>
                )}
                <StatusBadge status={row.grnStatus} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {row.vendorName} · {detailLoading ? 'Loading…' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(row.grnStatus === 'Draft' || row.grnStatus === 'PrimaryApproved' || row.grnStatus === 'Approved') && (
              <button
                onClick={() => { onClose(); onPrint(row); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Printer size={13} /> Print
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Metadata strip ─────────────────────────────────────────── */}
        <div className="bg-blue-50/60 border-b border-blue-100 px-5 py-3 flex flex-wrap gap-2">
          <MetaChip icon={<Hash size={12} />}      label="Invoice No"    value={row.invoiceNumber} />
          <MetaChip icon={<Hash size={12} />}      label="GRN No"        value={row.grnNumber} />
          <MetaChip icon={<Calendar size={12} />}  label="Invoice Date"  value={fmtDate(row.invoiceDate)} />
          <MetaChip icon={<Calendar size={12} />}  label="GRN Date"      value={fmtDate(row.grnDate)} />
          <MetaChip icon={<Building2 size={12} />} label="Supplier"      value={row.vendorName} />
          {row.dueDate         && <MetaChip icon={<Calendar size={12} />}   label="Due Date"      value={fmtDate(row.dueDate)} />}
          {row.storeName       && <MetaChip icon={<Store size={12} />}       label="Store"         value={row.storeName} />}
          {row.paymentMode     && <MetaChip icon={<CreditCard size={12} />}  label="Payment Mode"  value={row.paymentMode} />}
          {row.purchaseCategory && <MetaChip icon={<Tag size={12} />}        label="Category"      value={row.purchaseCategory} />}
        </div>

        {/* ── Cancellation / rejection reason banner ──────────────── */}
        {isCancelled && row.remarks && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 bg-rose-50 border-l-4 border-rose-400 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-rose-700">
                {row.grnStatus === 'Rejected' ? 'Rejection' : 'Cancellation'} Reason:
              </span>
              <span className="text-xs text-rose-600 ml-1">{row.remarks}</span>
            </div>
          </div>
        )}

        {/* ── Body (scrollable) ───────────────────────────────────── */}
        <div className="px-5 py-5 max-h-[65vh] overflow-y-auto space-y-5">

          {/* Items table */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
              Items ({detailLoading ? '…' : items.length})
            </p>
            {detailLoading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                No item details available
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-gray-400 w-8">#</th>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-gray-400">Item Name</th>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-gray-400">Batch</th>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-gray-400">Expiry</th>
                      <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-400">Ordered</th>
                      <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-emerald-500">Accepted</th>
                      <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-rose-400">Rejected</th>
                      <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-teal-500">Free</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-gray-400">Rate</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-emerald-600">Disc%</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-gray-400">MRP</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-orange-500">CGST%</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-orange-500">SGST%</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-orange-500">IGST%</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-widest text-blue-400">P.Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* # */}
                        <td className="px-3 py-3 text-gray-400 text-center font-medium">{i + 1}</td>
                        {/* Item Name + inline batch/expiry tags */}
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-1.5">
                            <div>
                              <p className="font-semibold text-gray-800 leading-tight">{item.itemName || '—'}</p>
                              {item.packing > 0 && (
                                <span className="text-[9px] text-gray-400">
                                  Pack <span className="font-semibold text-gray-600">{item.packing}</span>
                                </span>
                              )}
                            </div>
                            {item.rejectionReason && (
                              <span className="flex-shrink-0 text-[9px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 leading-tight">
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Batch */}
                        <td className="px-3 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                          {item.batchNumber || <span className="text-gray-300">—</span>}
                        </td>
                        {/* Expiry */}
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {item.expiryDate ? fmtDate(item.expiryDate) : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Quantities */}
                        <td className="px-3 py-3 text-center font-medium text-gray-700">{item.orderedQuantity ?? '—'}</td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-600">{(item as any).receivedQuantity ?? (item as any).acceptedQuantity ?? '—'}</td>
                        <td className="px-3 py-3 text-center font-semibold">
                          <span className={(item.rejectedQuantity ?? 0) > 0 ? 'text-rose-600' : 'text-gray-300'}>
                            {item.rejectedQuantity ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-teal-600">{item.freeQuantity ?? 0}</td>
                        {/* Pricing */}
                        <td className="px-3 py-3 text-right text-gray-700">₹{(item.purchaseRate ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-emerald-600 font-medium">{(item as any).discountPercent > 0 ? `${(item as any).discountPercent}%` : <span className="text-gray-300">—</span>}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700">₹{(item.mrp ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-orange-600 font-medium">{((item as any).cgstPercent ?? (item as any).gstPercent / 2 ?? 0) > 0 ? `${((item as any).cgstPercent ?? (item as any).gstPercent / 2).toFixed(1)}%` : <span className="text-gray-300">0%</span>}</td>
                        <td className="px-3 py-3 text-right text-orange-600 font-medium">{((item as any).sgstPercent ?? (item as any).gstPercent / 2 ?? 0) > 0 ? `${((item as any).sgstPercent ?? (item as any).gstPercent / 2).toFixed(1)}%` : <span className="text-gray-300">0%</span>}</td>
                        <td className="px-3 py-3 text-right text-orange-600 font-medium">{((item as any).igstPercent ?? 0) > 0 ? `${(item as any).igstPercent}%` : <span className="text-gray-300">0%</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-700">₹{((item as any).purchaseCost ?? (item as any).netAmount ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Summary — right-aligned below table */}
          <div className="flex justify-end">
            <div className="w-72 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 overflow-hidden">
              {/* Card header */}
              <div className="px-4 py-2.5 border-b border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Financial Summary</span>
              </div>
              {/* Rows */}
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Taxable Amount</span>
                  <span className="text-xs font-medium text-gray-700">{fmtINR(taxable)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">CGST</span>
                  <span className="text-xs font-medium text-gray-700">{fmtINR(cgst)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">SGST</span>
                  <span className="text-xs font-medium text-gray-700">{fmtINR(sgst)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">IGST</span>
                  <span className="text-xs font-medium text-gray-700">{fmtINR(igst)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-blue-100 pt-2 mt-1">
                  <span className="text-xs font-semibold text-gray-600">Net Amount</span>
                  <span className="text-sm font-semibold text-gray-800">{fmtINR(fetchedInv?.netAmount ?? row.netAmount)}</span>
                </div>
              </div>
              {/* Total footer bar */}
              <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-100 uppercase tracking-wide">Total</span>
                <span className="text-xl font-bold text-white">{fmtINR(fetchedInv?.netAmount ?? row.totalAmount)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Print GRN modal ─────────────────────────────────────────────────────────────
function PrintGrnModal({ row, onClose }: { row: GrnHeaderDto; onClose: () => void }) {
  const items = row.items ?? [];
  const taxable = items.reduce((s, i) => s + (i.purchaseRate ?? 0) * (i.acceptedQuantity ?? 0), 0);
  const cgst    = items.reduce((s, i) => s + (i.cgstAmount  ?? 0), 0);
  const sgst    = items.reduce((s, i) => s + (i.sgstAmount  ?? 0), 0);
  const igst    = items.reduce((s, i) => s + (i.igstAmount  ?? 0), 0);

  const doPrint = () => {
    const el = document.getElementById('grn-print-content');
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>GRN – ${row.grnNumber ?? row.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 11px; }
        body { padding: 24px; color: #111; }
        h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .subtitle { color: #555; font-size: 11px; margin-bottom: 16px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .card-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .row .label { color: #6b7280; }
        .row .value { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 2px solid #e5e7eb; }
        td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
        .total-row td { font-weight: 700; border-top: 2px solid #e5e7eb; }
        .footer { margin-top: 24px; border-top: 1px dashed #d1d5db; padding-top: 12px; color: #9ca3af; font-size: 9px; text-align: right; }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const cfg = STATUS_BADGE[row.grnStatus] ?? { bg: '', label: row.grnStatus };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden mt-6 mb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Print GRN</h2>
            <p className="text-xs text-gray-500 mt-0.5">{row.grnNumber ?? row.invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={doPrint}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div className="p-6 overflow-y-auto max-h-[72vh]">
          <div id="grn-print-content">
            <h1>Goods Receipt Note (GRN)</h1>
            <p className="subtitle">
              {row.grnNumber ? `GRN No: ${row.grnNumber}` : `Invoice: ${row.invoiceNumber}`}
              {' · '}
              {cfg.label}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Invoice Details</p>
                <div className="space-y-1.5">
                  <MetaRow label="Invoice No"   value={row.invoiceNumber} />
                  <MetaRow label="GRN No"       value={row.grnNumber ?? '—'} />
                  <MetaRow label="Invoice Date" value={fmtDate(row.invoiceDate)} />
                  <MetaRow label="GRN Date"     value={fmtDate(row.grnDate)} />
                  <MetaRow label="Due Date"     value={fmtDate(row.dueDate)} />
                  <MetaRow label="Status"       value={cfg.label} />
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Supplier & Purchase</p>
                <div className="space-y-1.5">
                  <MetaRow label="Supplier"      value={row.vendorName} />
                  <MetaRow label="Store"         value={row.storeName} />
                  <MetaRow label="Category"      value={row.purchaseCategory} />
                  <MetaRow label="Payment Mode"  value={row.paymentMode} />
                  <MetaRow label="Remarks"       value={row.remarks} />
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    {['#', 'Item Name', 'Batch', 'Expiry', 'Accepted', 'Rejected', 'Free', 'Rate', 'MRP', 'CGST%', 'SGST%', 'IGST%', 'P.Cost'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[9px] font-extrabold text-gray-500 uppercase tracking-widest whitespace-nowrap border-b border-gray-100">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-2.5 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-2.5 py-2 font-medium text-gray-800">{item.itemName || '—'}</td>
                      <td className="px-2.5 py-2 text-gray-600">{item.batchNumber || '—'}</td>
                      <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{fmtDate(item.expiryDate)}</td>
                      <td className="px-2.5 py-2 text-emerald-700 font-semibold">{item.acceptedQuantity ?? 0}</td>
                      <td className="px-2.5 py-2 text-rose-600 font-semibold">{item.rejectedQuantity ?? 0}</td>
                      <td className="px-2.5 py-2 text-teal-600">{item.freeQuantity ?? 0}</td>
                      <td className="px-2.5 py-2 text-gray-700">₹{(item.purchaseRate ?? 0).toFixed(2)}</td>
                      <td className="px-2.5 py-2 text-gray-700">₹{(item.mrp ?? 0).toFixed(2)}</td>
                      <td className="px-2.5 py-2 text-gray-600">{item.cgstPercent ?? 0}%</td>
                      <td className="px-2.5 py-2 text-gray-600">{item.sgstPercent ?? 0}%</td>
                      <td className="px-2.5 py-2 text-gray-600">{item.igstPercent ?? 0}%</td>
                      <td className="px-2.5 py-2 font-semibold text-blue-700">₹{(item.purchaseCost ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mt-4">
              <div className="w-64 space-y-1.5 border border-gray-100 rounded-xl p-4">
                {taxable > 0 && <MetaRow label="Taxable" value={`₹${taxable.toFixed(2)}`} />}
                {cgst > 0    && <MetaRow label="CGST"    value={`₹${cgst.toFixed(2)}`} />}
                {sgst > 0    && <MetaRow label="SGST"    value={`₹${sgst.toFixed(2)}`} />}
                {igst > 0    && <MetaRow label="IGST"    value={`₹${igst.toFixed(2)}`} />}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-600">Net Amount</span>
                  <span className="text-sm font-semibold text-gray-800">₹{(row.netAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                  <span className="text-base font-bold text-blue-700">₹{(row.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Invoice modal ─────────────────────────────────────────────────────────────
const PURCHASE_CATEGORIES_QP = ['Pharmacy', 'OT & Surgery', 'Consumables', 'Optical', 'Laboratory', 'Stationery', 'Equipment', 'General Hospital'] as const;
const PAYMENT_MODES_QP       = ['Cash', 'Credit', 'UPI', 'NEFT', 'RTGS', 'Cheque'] as const;

function purchaseItemToGrnLine(item: PurchaseItemDto): Partial<GrnLineItem> {
  return {
    itemId:           item.itemId,
    itemName:         item.itemName,
    hsnCode:          item.hsnCode ?? '',
    unit:             'Unit',
    orderedQuantity:  item.orderedQuantity,
    acceptedQuantity: item.receivedQuantity > 0 ? item.receivedQuantity : item.orderedQuantity,
    rejectedQuantity: item.rejectedQuantity,
    freeQuantity:     item.freeQuantity,
    batchNumber:      item.batchNumber ?? '',
    expiryDate:       item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : '',
    barcode:          item.barcode ?? '',
    purchaseRate:     item.purchaseRate,
    mrp:              item.mrp,
    discountPercent:  item.discountPercent,
    gstPercent:       item.gstPercent,
    cgstPercent:      item.gstPercent / 2,
    sgstPercent:      item.gstPercent / 2,
    igstPercent:      0,
    sellingPrice:     0,
    packing:          0,
    unitsPerPack:     0,
    mrpOnPack:        0,
    transferMrp:      0,
    mrpPerUnit:       0,
    isAssetItem:      false,
    taxOnFree:        false,
    isReplacement:    false,
    itemRemarks:      item.itemRemarks ?? '',
    roundingAmount:   0,
  };
}

function purchaseItemFromGrnLine(saved: GrnLineItem, original: PurchaseItemDto): PurchaseItemDto {
  return {
    ...original,
    itemId:           saved.itemId,
    itemName:         saved.itemName,
    hsnCode:          saved.hsnCode,
    orderedQuantity:  saved.orderedQuantity,
    receivedQuantity: saved.acceptedQuantity,
    rejectedQuantity: saved.rejectedQuantity,
    freeQuantity:     saved.freeQuantity,
    batchNumber:      saved.batchNumber || undefined,
    expiryDate:       saved.expiryDate || undefined,
    barcode:          saved.barcode || undefined,
    purchaseRate:     saved.purchaseRate,
    mrp:              saved.mrp,
    originalMrp:      original.originalMrp,
    discountPercent:  saved.discountPercent,
    gstPercent:       saved.gstPercent,
    netAmount:        Math.round(
      (saved.acceptedQuantity * saved.purchaseRate * (1 - (saved.discountPercent ?? 0) / 100)) *
      (1 + (saved.gstPercent ?? 0) / 100) * 100
    ) / 100,
    itemRemarks:      saved.itemRemarks || undefined,
  };
}

function itemDtoFromPurchaseItem(item: PurchaseItemDto): ItemDto {
  return {
    id:                  item.itemId,
    itemName:            item.itemName,
    hsnCode:             item.hsnCode,
    unit:                'Unit',
    requiresColdStorage: false,
    isBarcodeTracked:    false,
    itemType:            'Medicine',
    reorderLevel:        0,
    reorderQuantity:     0,
    defaultGstRate:      String(item.gstPercent),
    status:              'active',
  };
}

function EditInvoiceModal({
  row,
  onClose,
  onSaved,
}: {
  row: GrnHeaderDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { labels: paymentModeLabels } = useInventoryPaymentModeLabels();
  const { options: purchaseCategoryOptions } = useMasterValues('inventory.purchase_category');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [invoiceNo,        setInvoiceNo]        = useState('');
  const [invoiceDate,      setInvoiceDate]       = useState('');
  const [invoiceType,      setInvoiceType]       = useState<'Invoice' | 'Packing Slip'>('Invoice');
  const [paymentMode,      setPaymentMode]       = useState('');
  const [creditPeriod,     setCreditPeriod]      = useState('');
  const [dueDate,          setDueDate]           = useState('');
  const [reference,        setReference]         = useState('');
  const [purchaseCategory, setPurchaseCategory]  = useState('');
  const [wasPackingSlip,   setWasPackingSlip]    = useState(false);

  // Item editing states (only active when grnStatus === 'GRNNotGenerated')
  const [editItems,      setEditItems]      = useState<PurchaseItemDto[]>([]);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [pendingItem,    setPendingItem]    = useState<ItemDto | null>(null);
  const [pendingLastP,   setPendingLastP]   = useState<LastPurchaseInfo | undefined>(undefined);

  // Items are editable until final approval (GRNNotGenerated, Draft, PrimaryApproved)
  const canEditItems = row.grnStatus !== 'Approved' && row.grnStatus !== 'Cancelled' && row.grnStatus !== 'Rejected';

  useEffect(() => {
    inventoryInvoiceApi.get(row.invoiceId).then((inv: PurchaseInvoiceDto) => {
      setInvoiceNo(inv.invoiceNumber ?? '');
      setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '');
      const itype = (inv.invoiceType as 'Invoice' | 'Packing Slip') ?? 'Invoice';
      setInvoiceType(itype);
      setWasPackingSlip(itype === 'Packing Slip');
      setPaymentMode(inv.paymentMode ?? '');
      setCreditPeriod(inv.creditPeriod?.toString() ?? '');
      setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '');
      setReference(inv.reference ?? '');
      setPurchaseCategory(inv.purchaseCategory ?? '');
      setEditItems(inv.items ?? []);
    }).catch(() => toast.error('Failed to load invoice')).finally(() => setLoading(false));
  }, [row.invoiceId]);

  useEffect(() => {
    const days = parseInt(creditPeriod) || 0;
    if (!invoiceDate || days <= 0) return;
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [invoiceDate, creditPeriod]);

  const handleSave = async () => {
    if (!invoiceNo.trim()) { toast.error('Invoice number is required'); return; }
    setSaving(true);
    const tid = toast.loading('Saving…');
    try {
      await inventoryInvoiceApi.update(row.invoiceId, {
        invoiceNumber:    invoiceNo,
        invoiceDate:      invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
        invoiceType,
        paymentMode:      paymentMode || undefined,
        creditPeriod:     parseInt(creditPeriod) || undefined,
        dueDate:          dueDate ? new Date(dueDate).toISOString() : undefined,
        reference:        reference || undefined,
        purchaseCategory: purchaseCategory || undefined,
      });
      if (canEditItems && editItems.length > 0) {
        await inventoryInvoiceApi.updateItems(row.invoiceId, editItems.map(item => ({
          id:               item.id,
          itemId:           item.itemId,
          orderedQuantity:  item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          freeQuantity:     item.freeQuantity,
          batchNumber:      item.batchNumber || null,
          expiryDate:       item.expiryDate ? new Date(item.expiryDate).toISOString() : null,
          barcode:          item.barcode || null,
          mrp:              item.mrp,
          originalMrp:      item.originalMrp,
          purchaseRate:     item.purchaseRate,
          discountPercent:  item.discountPercent,
          hsnCode:          item.hsnCode || null,
          gstPercent:       item.gstPercent,
          cgstPercent:      item.gstPercent / 2,
          sgstPercent:      item.gstPercent / 2,
          igstPercent:      0,
          itemRemarks:      item.itemRemarks || null,
        })));
      }
      toast.success('Invoice updated.', { id: tid });
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to update', { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const handleItemSaved = (saved: GrnLineItem) => {
    if (editingItemIdx !== null) {
      setEditItems(prev => prev.map((it, i) => i === editingItemIdx ? purchaseItemFromGrnLine(saved, it) : it));
    } else {
      const newItem: PurchaseItemDto = {
        id:               '',
        itemId:           saved.itemId,
        itemName:         saved.itemName,
        hsnCode:          saved.hsnCode,
        orderedQuantity:  saved.orderedQuantity,
        receivedQuantity: saved.acceptedQuantity,
        rejectedQuantity: saved.rejectedQuantity,
        freeQuantity:     saved.freeQuantity,
        batchNumber:      saved.batchNumber || undefined,
        expiryDate:       saved.expiryDate || undefined,
        barcode:          saved.barcode || undefined,
        originalMrp:      saved.mrp,
        mrp:              saved.mrp,
        purchaseRate:     saved.purchaseRate,
        discountPercent:  saved.discountPercent,
        isFullDiscount:   false,
        gstPercent:       saved.gstPercent,
        netAmount:        Math.round(
          (saved.acceptedQuantity * saved.purchaseRate * (1 - (saved.discountPercent ?? 0) / 100)) *
          (1 + (saved.gstPercent ?? 0) / 100) * 100
        ) / 100,
        itemRemarks:      saved.itemRemarks || undefined,
      };
      setEditItems(prev => [...prev, newItem]);
    }
    setPendingItem(null);
    setEditingItemIdx(null);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400';
  const lblCls   = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden mt-8 mb-8"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Edit Purchase Invoice</h2>
              <p className="text-xs text-gray-500 mt-0.5">{row.invoiceNumber}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors">
              <X size={16} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              {wasPackingSlip && invoiceType === 'Invoice' && (
                <div className="flex items-center gap-2.5 bg-amber-50 border-l-4 border-amber-400 rounded-xl px-4 py-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">
                    You are converting this packing slip to an invoice. Enter the actual invoice number and date.
                  </p>
                </div>
              )}

              {/* ── Header fields ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lblCls}>Type</label>
                  <div className="flex gap-4">
                    {(['Invoice', 'Packing Slip'] as const).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editInvoiceType"
                          value={t}
                          checked={invoiceType === t}
                          onChange={() => setInvoiceType(t)}
                          className="accent-teal-600"
                        />
                        <span className="text-sm text-gray-700">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={lblCls}>{invoiceType === 'Packing Slip' ? 'Packing Slip No *' : 'Invoice No *'}</label>
                  <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder={invoiceType === 'Packing Slip' ? 'e.g. PS-2024-001' : 'e.g. INV-2024-001'} className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>{invoiceType === 'Packing Slip' ? 'Packing Slip Date' : 'Invoice Date'}</label>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Purchase Category</label>
                  <select value={purchaseCategory} onChange={e => setPurchaseCategory(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {(purchaseCategoryOptions.length > 0
                      ? purchaseCategoryOptions.map((c) => c.label)
                      : [...PURCHASE_CATEGORIES_QP]
                    ).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lblCls}>Payment Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {paymentModeLabels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lblCls}>Credit Period (days)</label>
                  <input type="number" min="0" value={creditPeriod} onChange={e => setCreditPeriod(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Due Date (auto)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${inputCls} bg-gray-50`} />
                </div>
                <div className="col-span-2">
                  <label className={lblCls}>Reference</label>
                  <input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO No / Ref…" className={inputCls} />
                </div>
              </div>

              {/* ── Items section ── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Items ({editItems.length})</span>
                  {canEditItems && (
                    <button
                      onClick={() => { setEditingItemIdx(null); setShowItemSearch(true); }}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Free</th>
                        <th className="px-2 py-2">Batch</th>
                        <th className="px-2 py-2">Expiry</th>
                        <th className="px-2 py-2 text-right">MRP</th>
                        <th className="px-2 py-2 text-right">Rate</th>
                        <th className="px-2 py-2 text-right">Disc%</th>
                        <th className="px-2 py-2 text-right">GST%</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                        {canEditItems && <th className="px-2 py-2" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editItems.length === 0 ? (
                        <tr>
                          <td colSpan={canEditItems ? 11 : 10} className="px-3 py-4 text-center text-gray-400 italic">No items</td>
                        </tr>
                      ) : editItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{it.itemName}</td>
                          <td className="px-2 py-2 text-right text-gray-700">{it.receivedQuantity > 0 ? it.receivedQuantity : it.orderedQuantity}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{it.freeQuantity || '—'}</td>
                          <td className="px-2 py-2 text-gray-600">{it.batchNumber || '—'}</td>
                          <td className="px-2 py-2 text-gray-600">{it.expiryDate ? new Date(it.expiryDate).toLocaleDateString('en-IN') : '—'}</td>
                          <td className="px-2 py-2 text-right text-gray-700">₹{it.mrp.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right text-gray-700">₹{it.purchaseRate.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right text-gray-600">{it.discountPercent || 0}%</td>
                          <td className="px-2 py-2 text-right text-gray-600">{it.gstPercent}%</td>
                          <td className="px-2 py-2 text-right font-semibold text-gray-800">₹{it.netAmount.toFixed(2)}</td>
                          {canEditItems && (
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingItemIdx(idx); setPendingItem(itemDtoFromPurchaseItem(it)); setPendingLastP(undefined); }}
                                  className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit item"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!canEditItems && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 font-medium">
                    Items are locked after final approval.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Item Search nested modal ── */}
      {showItemSearch && (
        <ItemSearchModal
          onSelect={(item, lastP) => {
            setPendingItem(item);
            setPendingLastP(lastP);
            setShowItemSearch(false);
          }}
          onClose={() => setShowItemSearch(false)}
          storeId={row.storeId}
        />
      )}

      {/* ── Item GST form nested modal ── */}
      {pendingItem && (
        <ItemGstFormModal
          item={pendingItem}
          initial={editingItemIdx !== null ? purchaseItemToGrnLine(editItems[editingItemIdx]) : undefined}
          lastMrp={pendingLastP?.lastMrp}
          lastPurchasePrice={pendingLastP?.lastPurchasePrice}
          isEditing={editingItemIdx !== null}
          onSave={handleItemSaved}
          onClose={() => { setPendingItem(null); setEditingItemIdx(null); }}
        />
      )}
    </>
  );
}

// ─── Inline mini-forms for modals ────────────────────────────────────────────────
function BtRemarksForm({
  onConfirm, onCancel, processing,
}: { onConfirm: (r: string) => Promise<void>; onCancel: () => void; processing: boolean }) {
  const [v, setV] = React.useState('');
  return (
    <div className="space-y-3">
      <textarea
        value={v} onChange={e => setV(e.target.value)}
        placeholder="Remarks (optional)"
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={processing} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={() => onConfirm(v)} disabled={processing}
          className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {processing ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

// Phase 2 FE-202: SOD override form
function SodOverrideForm({
  requireReason, reasonCatalog, onConfirm, onCancel, processing,
}: {
  requireReason: boolean;
  reasonCatalog: { reasonCode: string; reasonLabel: string }[];
  onConfirm: (remarks: string, overrideReasonCode: string, overrideReasonText: string) => Promise<void>;
  onCancel: () => void;
  processing: boolean;
}) {
  const [remarks, setRemarks] = React.useState('');
  const [code, setCode] = React.useState(reasonCatalog[0]?.reasonCode ?? '');
  const [customText, setCustomText] = React.useState('');
  const overrideReasonText = reasonCatalog.find(r => r.reasonCode === code)?.reasonLabel ?? customText;
  const valid = !requireReason || (code && overrideReasonText.trim());
  return (
    <div className="space-y-3">
      {requireReason && (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Override Reason *</label>
            <select value={code} onChange={e => setCode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
              {reasonCatalog.map(r => <option key={r.reasonCode} value={r.reasonCode}>{r.reasonLabel}</option>)}
              <option value="CUSTOM">Other…</option>
            </select>
          </div>
          {code === 'CUSTOM' && (
            <textarea value={customText} onChange={e => setCustomText(e.target.value)}
              placeholder="Describe the override reason…" rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
          )}
        </>
      )}
      <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
        placeholder="Additional remarks (optional)" rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none resize-none" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={processing} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={() => valid && onConfirm(remarks, code === 'CUSTOM' ? 'OTHER_OVERRIDE' : code, code === 'CUSTOM' ? customText : overrideReasonText)}
          disabled={processing || !valid}
          className="px-4 py-2 text-sm rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
          {processing ? 'Processing…' : 'Approve with Override'}
        </button>
      </div>
    </div>
  );
}

// Phase 1 FE-101: Policy modal
function BtPolicyModal({
  policy, onSave, onClose,
}: {
  policy: { lowValueOverrideThreshold: number; allowLowValueFlexOverride: boolean; requireOverrideReason: boolean };
  onSave: (updated: { lowValueOverrideThreshold: number; allowLowValueFlexOverride: boolean; requireOverrideReason: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [threshold, setThreshold] = React.useState(String(policy.lowValueOverrideThreshold));
  const [flexOverride, setFlexOverride] = React.useState(policy.allowLowValueFlexOverride);
  const [requireReason, setRequireReason] = React.useState(policy.requireOverrideReason);
  const [saving, setSaving] = React.useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Bill Transfer Policy</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Low-Value Override Threshold (₹)</label>
            <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} min={0} step={1000}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={flexOverride} onChange={e => setFlexOverride(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Allow low-value SOD flex override</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={requireReason} onChange={e => setRequireReason(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Require override reason code</span>
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={async () => {
              setSaving(true);
              try { await onSave({ lowValueOverrideThreshold: parseFloat(threshold), allowLowValueFlexOverride: flexOverride, requireOverrideReason: requireReason }); }
              finally { setSaving(false); }
            }}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonForm({
  reasons, onConfirm, onCancel, processing,
}: { reasons: string[]; onConfirm: (r: string) => Promise<void>; onCancel: () => void; processing: boolean }) {
  const OTHER = '__other__';
  const [selected, setSelected] = React.useState(reasons[0] ?? OTHER);
  const [otherText, setOtherText] = React.useState('');
  const value = selected === OTHER ? otherText : selected;
  const valid = value.trim().length > 0;
  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
      >
        {reasons.map(r => <option key={r} value={r}>{r}</option>)}
        {!reasons.includes(OTHER) && <option value={OTHER}>Other…</option>}
      </select>
      {selected === OTHER && (
        <textarea
          value={otherText} onChange={e => setOtherText(e.target.value)}
          placeholder="Describe the reason…"
          rows={3}
          autoFocus
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
        />
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={processing} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={() => { if (!valid) return; onConfirm(value.trim()); }} disabled={processing || !valid}
          className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {processing ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function RecordPaymentForm({
  maxAmount, vendorId, settlementId, onConfirm, onCancel, processing,
}: {
  maxAmount: number;
  vendorId: string;
  settlementId: string;
  onConfirm: (r: RecordSettlementPaymentRequest) => Promise<void>;
  onCancel: () => void;
  processing: boolean;
}) {
  const [amount,  setAmount]  = React.useState('');
  const [method,  setMethod]  = React.useState<'NEFT' | 'RTGS' | 'Cheque' | 'Cash' | 'UPI'>('NEFT');
  const [date,    setDate]    = React.useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = React.useState('');
  // NEFT / RTGS
  const [utr,        setUtr]        = React.useState('');
  // Cheque
  const [chequeNo,   setChequeNo]   = React.useState('');
  const [chequeDate, setChequeDate] = React.useState('');
  const [clearDate,  setClearDate]  = React.useState('');
  // UPI
  const [upiId,  setUpiId]  = React.useState('');
  const [upiApp, setUpiApp] = React.useState('');
  // Cash
  const [rcptNo, setRcptNo] = React.useState('');
  const [rcptBy, setRcptBy] = React.useState('');
  // Bank account selection
  const [savedAccounts,    setSavedAccounts]    = React.useState<VendorBankAccountDto[]>([]);
  const [accountsLoading,  setAccountsLoading]  = React.useState(false);
  const [accountMode,      setAccountMode]      = React.useState<'saved' | 'new'>('saved');
  const [selectedAccountId,setSelectedAccountId]= React.useState<string | null>(null);
  // New account fields
  const [bankSearch,    setBankSearch]    = React.useState('');
  const [bankDropOpen,  setBankDropOpen]  = React.useState(false);
  const [newBankName,   setNewBankName]   = React.useState('');
  const [newAcct,       setNewAcct]       = React.useState('');
  const [newAcctConfirm,setNewAcctConfirm]= React.useState('');
  const [newIfsc,       setNewIfsc]       = React.useState('');
  const [newHolderName, setNewHolderName] = React.useState('');
  const [newAcctType,   setNewAcctType]   = React.useState<'current'|'savings'|'cc'|'od'>('current');
  const [saveToVendor,  setSaveToVendor]  = React.useState(true);
  // UTR tooltip
  const [utrTooltip,    setUtrTooltip]    = React.useState(false);
  // File upload
  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bankDropRef  = React.useRef<HTMLDivElement>(null);

  const usesBankAccount = method === 'NEFT' || method === 'RTGS' || method === 'Cheque';
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400';
  const lblCls   = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1';
  const amt = parseFloat(amount);

  // Load vendor bank accounts
  React.useEffect(() => {
    if (!vendorId) return;
    setAccountsLoading(true);
    inventoryVendorBankAccountApi.list(vendorId)
      .then(accts => {
        setSavedAccounts(accts);
        if (accts.length === 0) { setAccountMode('new'); }
        else {
          const primary = accts.find(a => a.isPrimary);
          setSelectedAccountId(primary?.id ?? accts[0].id);
        }
      })
      .catch(() => setAccountMode('new'))
      .finally(() => setAccountsLoading(false));
  }, [vendorId]);

  // Close bank dropdown on outside click
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bankDropRef.current && !bankDropRef.current.contains(e.target as Node)) setBankDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedAccount  = savedAccounts.find(a => a.id === selectedAccountId) ?? null;
  const effectiveBankName  = usesBankAccount ? (accountMode === 'saved' ? selectedAccount?.bankName ?? '' : newBankName) : '';
  const effectiveAccountNo = usesBankAccount ? (accountMode === 'saved' ? selectedAccount?.accountNumber ?? '' : newAcct) : '';
  const effectiveIfsc      = usesBankAccount ? (accountMode === 'saved' ? selectedAccount?.ifscCode ?? '' : newIfsc) : '';

  const txnRef = method === 'NEFT' || method === 'RTGS' ? utr
    : method === 'Cheque' ? chequeNo
    : method === 'UPI'    ? upiId
    : rcptNo;

  const acctMatch       = newAcct === newAcctConfirm;
  const newAcctValid    = !usesBankAccount || accountMode !== 'new' || (newBankName.trim().length > 0 && newAcct.trim().length > 0 && acctMatch && newIfsc.trim().length >= 11);
  const valid           = amt > 0 && amt <= maxAmount && txnRef.trim().length > 0 && newAcctValid;
  const filteredBanks   = filterBanks(bankSearch);

  const handleConfirm = async () => {
    const base: RecordSettlementPaymentRequest = {
      amount: amt,
      paymentMethod: method,
      transactionReference: txnRef.trim(),
      paymentDate: new Date(date).toISOString(),
      remarks: remarks || undefined,
    };
    if (method === 'NEFT' || method === 'RTGS') {
      Object.assign(base, { utrNumber: utr || undefined, bankName: effectiveBankName || undefined, accountNumber: effectiveAccountNo || undefined, ifscCode: effectiveIfsc || undefined });
    } else if (method === 'Cheque') {
      Object.assign(base, { bankName: effectiveBankName || undefined, accountNumber: effectiveAccountNo || undefined, ifscCode: effectiveIfsc || undefined, chequeDate: chequeDate || undefined, expectedClearanceDate: clearDate || undefined });
    } else if (method === 'UPI') {
      Object.assign(base, { upiId: upiId || undefined, upiApp: upiApp || undefined });
    } else if (method === 'Cash') {
      Object.assign(base, { cashReceiptNumber: rcptNo || undefined, cashReceivedBy: rcptBy || undefined });
    }
    await onConfirm(base);
    // Fire-and-forget: save new bank account
    if (usesBankAccount && accountMode === 'new' && saveToVendor && newAcct && newBankName && newIfsc) {
      inventoryVendorBankAccountApi.create(vendorId, {
        accountHolderName: newHolderName || '',
        bankName: newBankName,
        accountNumber: newAcct,
        ifscCode: newIfsc,
        accountType: newAcctType,
        isPrimary: savedAccounts.length === 0,
      }).catch(() => undefined);
    }
    // Fire-and-forget: upload payment proof
    if (attachmentFile) {
      inventorySettlementApi.uploadPaymentProof(settlementId, attachmentFile).catch(() => undefined);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { toast.error('Only JPG, PNG, WebP, or PDF allowed'); return; }
    setAttachmentFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div>
        <label className={lblCls}>Amount (max {maxAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })})</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0.01} max={maxAmount} step={0.01} className={inputCls} />
      </div>

      {/* Method */}
      <div>
        <label className={lblCls}>Payment Method</label>
        <select value={method} onChange={e => setMethod(e.target.value as typeof method)} className={inputCls}>
          {(['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI'] as const).map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Primary ref with UTR tooltip */}
      <div>
        <label className={lblCls}>
          {(method === 'NEFT' || method === 'RTGS') ? (
            <span className="flex items-center gap-1">
              UTR Number *
              <span className="relative cursor-pointer" onMouseEnter={() => setUtrTooltip(true)} onMouseLeave={() => setUtrTooltip(false)}>
                <svg className="w-3 h-3 text-gray-400 inline" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {utrTooltip && (
                  <div className="absolute left-5 top-0 z-50 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 w-56 shadow-xl pointer-events-none">
                    22-character code your bank assigns to every NEFT/RTGS transfer. Find it on your bank&apos;s payment confirmation SMS or receipt.
                  </div>
                )}
              </span>
            </span>
          ) : method === 'Cheque' ? 'Cheque Number *'
            : method === 'UPI'    ? 'RRN / Transaction ID *'
            : 'Receipt Number *'}
        </label>
        <input
          value={txnRef}
          onChange={e => {
            if (method === 'NEFT' || method === 'RTGS') setUtr(e.target.value);
            else if (method === 'Cheque') setChequeNo(e.target.value);
            else if (method === 'UPI') setUpiId(e.target.value);
            else setRcptNo(e.target.value);
          }}
          className={inputCls}
        />
      </div>

      {/* Bank account selector — NEFT / RTGS / Cheque */}
      {usesBankAccount && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={lblCls + ' mb-0'}>Vendor Bank Account</span>
            {savedAccounts.length > 0 && (
              <div className="flex text-[11px] border border-gray-200 rounded-lg overflow-hidden">
                {(['saved', 'new'] as const).map(m => (
                  <button key={m} onClick={() => setAccountMode(m)}
                    className={`px-2.5 py-1 transition-colors ${accountMode === m ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {m === 'saved' ? 'Saved' : '+ New'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {accountsLoading && <p className="text-[11px] text-gray-400">Loading accounts…</p>}

          {!accountsLoading && accountMode === 'saved' && savedAccounts.length > 0 && (
            <div className="space-y-1.5">
              {savedAccounts.map(acct => {
                const badge = getBankBadge(acct.bankName);
                const typeLabel = { current: 'Current', savings: 'Savings', cc: 'CC', od: 'OD' }[acct.accountType] ?? acct.accountType;
                return (
                  <label key={acct.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${selectedAccountId === acct.id ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="bank-account" value={acct.id}
                      checked={selectedAccountId === acct.id} onChange={() => setSelectedAccountId(acct.id)}
                      className="accent-emerald-600" />
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${badge.bg}`}>{badge.initials}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-800 truncate">{acct.bankName}</span>
                      <span className="text-[11px] text-gray-500">{acct.maskedAccountNumber} · {typeLabel}</span>
                    </span>
                    {acct.isPrimary && <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md shrink-0">Primary</span>}
                  </label>
                );
              })}
            </div>
          )}

          {/* New account form */}
          {!accountsLoading && accountMode === 'new' && (
            <div className="space-y-3 p-3 bg-gray-50/70 rounded-xl border border-gray-200">
              {/* Bank combobox */}
              <div ref={bankDropRef} className="relative">
                <label className={lblCls}>Bank Name *</label>
                <input value={bankSearch}
                  onChange={e => { setBankSearch(e.target.value); setNewBankName(e.target.value); setBankDropOpen(true); }}
                  onFocus={() => setBankDropOpen(true)}
                  className={inputCls} />
                {bankDropOpen && filteredBanks.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                    {filteredBanks.slice(0, 30).map(b => {
                      const badge = getBankBadge(b.name);
                      return (
                        <button key={b.ifscPrefix} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setNewBankName(b.name); setBankSearch(b.name); setBankDropOpen(false); }}
                          className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${badge.bg}`}>{badge.initials}</span>
                          <span>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Account Number + Confirm */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lblCls}>Account Number *</label>
                  <input value={newAcct} onChange={e => setNewAcct(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`${lblCls} flex items-center gap-1`}>
                    Confirm Account *
                    {newAcct && newAcctConfirm && (newAcct === newAcctConfirm
                      ? <span className="text-emerald-600 font-bold normal-case">&#10003;</span>
                      : <span className="text-rose-500 font-bold normal-case">&#10007;</span>)}
                  </label>
                  <input value={newAcctConfirm} onChange={e => setNewAcctConfirm(e.target.value)}
                    className={`${inputCls} ${newAcct && newAcctConfirm && !acctMatch ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/20' : ''}`} />
                </div>
              </div>

              {/* IFSC */}
              <div>
                <label className={lblCls}>IFSC Code *</label>
                <input value={newIfsc} maxLength={11}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setNewIfsc(v);
                    if (v.length >= 4 && !newBankName) {
                      const b = detectBankFromIfsc(v);
                      if (b) { setNewBankName(b.name); setBankSearch(b.name); }
                    }
                  }}
                  className={inputCls} />
              </div>

              {/* Holder name + Account Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lblCls}>Account Holder</label>
                  <input value={newHolderName} onChange={e => setNewHolderName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Account Type</label>
                  <select value={newAcctType} onChange={e => setNewAcctType(e.target.value as typeof newAcctType)} className={inputCls}>
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                    <option value="cc">CC (Cash Credit)</option>
                    <option value="od">OD (Overdraft)</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={saveToVendor} onChange={e => setSaveToVendor(e.target.checked)} className="w-3.5 h-3.5 rounded accent-emerald-600" />
                <span className="text-[12px] text-gray-600">Save to vendor profile for future payments</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Cheque extra dates */}
      {method === 'Cheque' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Cheque Date</label>
            <input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Expected Clearance</label>
            <input type="date" value={clearDate} onChange={e => setClearDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {/* UPI App */}
      {method === 'UPI' && (
        <div>
          <label className={lblCls}>UPI App</label>
          <select value={upiApp} onChange={e => setUpiApp(e.target.value)} className={inputCls}>
            <option value="">— Select app (optional) —</option>
            {['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Bank App', 'Other'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {/* Cash — received by */}
      {method === 'Cash' && (
        <div>
          <label className={lblCls}>Received By</label>
          <input value={rcptBy} onChange={e => setRcptBy(e.target.value)} className={inputCls} />
        </div>
      )}

      {/* Payment Date */}
      <div>
        <label className={lblCls}>Payment Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
      </div>

      {/* Remarks */}
      <div>
        <label className={lblCls}>Remarks</label>
        <input value={remarks} onChange={e => setRemarks(e.target.value)} className={inputCls} />
      </div>

      {/* Payment proof upload */}
      <div>
        <label className={lblCls}>Payment Proof (optional)</label>
        {attachmentFile ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="flex-1 truncate text-gray-700">{attachmentFile.name}</span>
            <span className="text-gray-400 text-[11px] shrink-0">{(attachmentFile.size / 1024).toFixed(0)} KB</span>
            <button onClick={() => setAttachmentFile(null)} className="text-gray-400 hover:text-rose-500 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-600 transition-colors w-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload screenshot or PDF
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileChange} />
          </>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} disabled={processing} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleConfirm} disabled={processing || !valid}
          className="px-4 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {processing ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </div>
  );
}


function VendorPaymentForm({
  maxAmount, onConfirm, onCancel, processing,
}: {
  maxAmount: number;
  onConfirm: (r: { paymentReference: string; paymentDate: string; amount: number; paymentMode: string; chequeNumber?: string; bankTransactionId?: string; remarks?: string }) => Promise<void>;
  onCancel: () => void;
  processing: boolean;
}) {
  const [amount,   setAmount]   = React.useState('');
  const [mode,     setMode]     = React.useState<'NEFT' | 'RTGS' | 'Cheque' | 'Cash' | 'UPI'>('NEFT');
  const [ref,      setRef]      = React.useState('');
  const [date,     setDate]     = React.useState(new Date().toISOString().slice(0, 10));
  const [cheque,   setCheque]   = React.useState('');
  const [bankTxId, setBankTxId] = React.useState('');
  const [remarks,  setRemarks]  = React.useState('');
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400';
  const lblCls   = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1';
  const amt   = parseFloat(amount);
  const valid = amt > 0 && amt <= maxAmount && ref.trim();
  return (
    <div className="space-y-3">
      <div>
        <label className={lblCls}>Amount (max {maxAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })})</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0.01} max={maxAmount} step={0.01} className={inputCls} />
      </div>
      <div>
        <label className={lblCls}>Payment Mode</label>
        <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} className={inputCls}>
          {(['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI'] as const).map(m => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className={lblCls}>Payment Reference *</label>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="UTR / Reference number" className={inputCls} />
      </div>
      <div>
        <label className={lblCls}>Payment Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
      </div>
      {mode === 'Cheque' && (
        <div>
          <label className={lblCls}>Cheque Number</label>
          <input value={cheque} onChange={e => setCheque(e.target.value)} placeholder="Cheque number" className={inputCls} />
        </div>
      )}
      {(mode === 'NEFT' || mode === 'RTGS' || mode === 'UPI') && (
        <div>
          <label className={lblCls}>Bank Transaction ID</label>
          <input value={bankTxId} onChange={e => setBankTxId(e.target.value)} placeholder="Bank transaction ID" className={inputCls} />
        </div>
      )}
      <div>
        <label className={lblCls}>Remarks</label>
        <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional" className={inputCls} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={processing} className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => onConfirm({
            amount: parseFloat(amount),
            paymentMode: mode,
            paymentReference: ref,
            paymentDate: new Date(date).toISOString(),
            chequeNumber: mode === 'Cheque' ? cheque || undefined : undefined,
            bankTransactionId: (mode === 'NEFT' || mode === 'RTGS' || mode === 'UPI') ? bankTxId || undefined : undefined,
            remarks: remarks || undefined,
          })}
          disabled={processing || !valid}
          className="px-4 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {processing ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </div>
  );
}

// ─── Bill Transfer Detail Modal ──────────────────────────────────────────────────
function BtDetailModal({
  bt,
  grn,
  loading,
  onClose,
}: {
  bt: BillTransferDto;
  grn: GrnHeaderDto | null;
  loading: boolean;
  onClose: () => void;
}) {
  const isGrnOnly = bt.status === 'NotGenerated';
  const items = grn?.items ?? [];

  // Always derive financial totals from live GRN items — stored BT/invoice columns can be stale.
  const itemTaxable = items.reduce((s, i) => s + (i.purchaseCost ?? 0), 0);
  const itemCgst    = items.reduce((s, i) => s + (i.cgstAmount   ?? 0), 0);
  const itemSgst    = items.reduce((s, i) => s + (i.sgstAmount   ?? 0), 0);
  const itemIgst    = items.reduce((s, i) => s + (i.igstAmount   ?? 0), 0);
  const itemGst     = itemCgst + itemSgst + itemIgst;
  const itemTotal   = itemTaxable + itemGst;
  const netPayable  = itemTotal + (bt.tcsAmount ?? 0);

  const badge = (BT_BADGE as Record<string, { bg: string; label: string }>)[bt.status] ?? { bg: 'bg-gray-100 text-gray-600', label: bt.status };
  const slaColorMap: Record<string, string> = {
    OnTrack: 'bg-teal-50 text-teal-700 border-teal-200',
    AtRisk:  'bg-amber-50 text-amber-700 border-amber-200',
    Breached:'bg-rose-50 text-rose-700 border-rose-200',
  };
  const hasRejection = bt.status === 'L1Rejected' || bt.status === 'L2Rejected';
  const rejectionRemarks = bt.status === 'L1Rejected' ? bt.l1Remarks : bt.status === 'L2Rejected' ? bt.l2Remarks : null;
  const hasL1 = !!(bt.l1ApprovedBy || bt.l1ApprovedAt || bt.l1Remarks);
  const hasL2 = !!(bt.l2ApprovedBy || bt.l2ApprovedAt || bt.l2Remarks);
  const hasApprovalTrail = hasL1 || hasL2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                {isGrnOnly ? 'GRN Preview' : 'Bill Transfer'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {bt.grnNumber && (
                  <span className="font-mono text-sm font-bold text-gray-900">{bt.grnNumber}</span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {bt.vendorName ?? '—'} · {loading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 max-h-[78vh] overflow-y-auto space-y-5">

          {/* Rejection banner */}
          {hasRejection && rejectionRemarks && (
            <div className="flex items-start gap-2.5 bg-orange-50 border-l-4 border-orange-400 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-orange-700">
                  {bt.status === 'L1Rejected' ? 'L1 Rejection Reason' : 'L2 Rejection Reason'}:
                </span>
                <span className="text-xs text-orange-600 ml-1">{rejectionRemarks}</span>
              </div>
            </div>
          )}

          {/* Section 1 – Invoice & GRN Details */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {isGrnOnly ? 'GRN Details' : 'Invoice & GRN Details'}
              </p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {([
                { label: 'GRN Number',        value: bt.grnNumber },
                ...(!isGrnOnly ? [{ label: 'Invoice Number', value: bt.invoiceNumber }] : []),
                { label: 'GRN Date',           value: fmtDate(bt.grnDate ?? grn?.grnDate) },
                ...(!isGrnOnly ? [{ label: 'Invoice Date',   value: fmtDate(bt.invoiceDate) }] : []),
                { label: 'Vendor',             value: bt.vendorName ?? grn?.vendorName },
                { label: 'Store',              value: grn?.storeName },
                { label: 'Purchase Category', value: grn?.purchaseCategory },
                { label: 'Payment Mode',       value: grn?.paymentMode },
                ...(!isGrnOnly ? [{ label: 'Created At',     value: fmtDate(bt.createdAt) }] : []),
                { label: 'Remarks',            value: bt.remarks ?? grn?.remarks },
              ] as { label: string; value?: string | null }[]).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-xs font-medium text-gray-800 mt-0.5">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 – Financial Summary */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Financial Summary</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {isGrnOnly ? (
                <>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Taxable Amount</p>
                    <p className="text-base font-bold text-gray-900 mt-1">{fmtINR(itemTaxable)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">GST (Total)</p>
                    <p className="text-base font-bold text-orange-700 mt-1">{fmtINR(itemGst)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">C: {fmtINR(itemCgst)} · S: {fmtINR(itemSgst)} · I: {fmtINR(itemIgst)}</p>
                  </div>
                  <div className="bg-emerald-600 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wide">Net Payable</p>
                    <p className="text-base font-bold text-white mt-1">{fmtINR(netPayable)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Taxable Amount</p>
                    <p className="text-base font-bold text-gray-900 mt-1">{fmtINR(itemTaxable)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">GST (C+S+I)</p>
                    <p className="text-base font-bold text-orange-700 mt-1">{fmtINR(itemGst)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">C: {fmtINR(itemCgst)} · S: {fmtINR(itemSgst)} · I: {fmtINR(itemIgst)}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">TCS</p>
                    <p className="text-base font-bold text-gray-700 mt-1">{fmtINR(bt.tcsAmount)}</p>
                  </div>
                  <div className="bg-emerald-600 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wide">Net Payable</p>
                    <p className="text-base font-bold text-white mt-1">{fmtINR(netPayable)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section 3 – Status & SLA */}
          {!isGrnOnly && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Status & SLA</p>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="flex flex-wrap gap-5">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Current Status</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg}`}>{badge.label}</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">SLA State</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${slaColorMap[bt.slaState] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {bt.slaState}
                  </span>
                </div>
                {bt.l1DueAt && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">L1 Due</p>
                    <p className="text-xs font-medium text-gray-700">{fmtDate(bt.l1DueAt)}</p>
                  </div>
                )}
                {bt.l2DueAt && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">L2 Due</p>
                    <p className="text-xs font-medium text-gray-700">{fmtDate(bt.l2DueAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 5 – GRN Line Items */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                GRN Line Items ({loading ? '…' : items.length})
              </p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {loading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                <Package size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-400">No line items recorded</p>
                <p className="text-xs text-gray-300 mt-1">Items may have been created outside the portal</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[1050px] text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['#', 'Item Name', 'Batch', 'Expiry', 'Ordered', 'Accepted', 'Rejected', 'Rate', 'MRP', 'CGST%', 'SGST%', 'IGST%', 'GST Amt', 'Total'].map((h, idx) => (
                        <th key={h} className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap ${idx === 0 ? 'w-8 text-center' : idx >= 4 && idx <= 6 ? 'text-center' : idx >= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => {
                      const gstAmt = (item.cgstAmount ?? 0) + (item.sgstAmount ?? 0) + (item.igstAmount ?? 0);
                      return (
                        <tr key={(item as any).id ?? i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-3 py-2.5 text-center text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-800">{item.itemName || '—'}</p>
                            {(item.packing ?? 0) > 0 && <p className="text-[10px] text-gray-400">Pack: {item.packing}</p>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">{item.batchNumber || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{item.expiryDate ? fmtDate(item.expiryDate) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-center font-medium text-gray-700">{item.orderedQuantity ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{item.acceptedQuantity ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center font-semibold">
                            <span className={(item.rejectedQuantity ?? 0) > 0 ? 'text-rose-600' : 'text-gray-300'}>{item.rejectedQuantity ?? 0}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">₹{(item.purchaseRate ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">₹{(item.mrp ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-orange-600">{item.cgstPercent ?? 0}%</td>
                          <td className="px-3 py-2.5 text-right text-orange-600">{item.sgstPercent ?? 0}%</td>
                          <td className="px-3 py-2.5 text-right text-orange-600">{item.igstPercent ?? 0}%</td>
                          <td className="px-3 py-2.5 text-right text-orange-700 font-medium">₹{gstAmt.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-700">₹{(item.purchaseCost ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs">
                      <td colSpan={5} className="px-3 py-2.5 text-gray-500 text-right text-[10px] uppercase tracking-wide">Totals</td>
                      <td className="px-3 py-2.5 text-center text-emerald-700">{items.reduce((s, i) => s + (i.acceptedQuantity ?? 0), 0)}</td>
                      <td className="px-3 py-2.5" />
                      <td colSpan={5} className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right text-orange-700">₹{items.reduce((s, i) => s + (i.cgstAmount ?? 0) + (i.sgstAmount ?? 0) + (i.igstAmount ?? 0), 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700">₹{items.reduce((s, i) => s + (i.purchaseCost ?? 0), 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Bill Transfer status config ─────────────────────────────────────────────────
const BT_STATUS_TABS = [
  { key: 'All',            label: 'All',            dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'NotGenerated',  label: 'Pending BT',     dot: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white' },
  { key: 'Draft',        label: 'Draft',          dot: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'Resubmitted',  label: 'Resubmitted',    dot: 'bg-purple-500',  activeClass: 'bg-purple-500 border-purple-500 text-white' },
  { key: 'L1Approved',   label: 'L1 Approved',    dot: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white' },
  { key: 'L1Rejected',   label: 'L1 Rejected',    dot: 'bg-orange-500',  activeClass: 'bg-orange-500 border-orange-500 text-white' },
  { key: 'L2Rejected',   label: 'L2 Rejected',    dot: 'bg-orange-600',  activeClass: 'bg-orange-600 border-orange-600 text-white' },
  { key: 'FullyApproved',label: 'Fully Approved',  dot: 'bg-blue-500',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'Cancelled',    label: 'Cancelled',       dot: 'bg-rose-500',    activeClass: 'bg-rose-500 border-rose-500 text-white' },
];
const BT_BADGE: Record<string, { bg: string; label: string }> = {
  NotGenerated:  { bg: 'bg-teal-100 text-teal-700',     label: 'Pending BT'     },
  Draft:         { bg: 'bg-amber-100 text-amber-700',   label: 'Draft'          },
  Resubmitted:   { bg: 'bg-purple-100 text-purple-700', label: 'Resubmitted'    },
  L1Approved:    { bg: 'bg-teal-100 text-teal-700',     label: 'L1 Approved'    },
  L1Rejected:    { bg: 'bg-orange-100 text-orange-700', label: 'L1 Rejected'    },
  L2Rejected:    { bg: 'bg-orange-100 text-orange-700', label: 'L2 Rejected'    },
  FullyApproved: { bg: 'bg-blue-100 text-blue-700',     label: 'Fully Approved' },
  Cancelled:     { bg: 'bg-rose-100 text-rose-700',     label: 'Cancelled'      },
};
const SL_STATUS_TABS = [
  { key: 'All',           label: 'All',            dot: 'bg-slate-400',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Pending',      label: 'Pending',        dot: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'PartiallyPaid',label: 'Partially Paid', dot: 'bg-blue-500',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
  { key: 'FullySettled', label: 'Settled',        dot: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'Overdue',      label: 'Overdue',        dot: 'bg-rose-600',    activeClass: 'bg-rose-600 border-rose-600 text-white' },
  { key: 'OnHold',       label: 'On Hold',        dot: 'bg-yellow-500',  activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
  { key: 'WrittenOff',   label: 'Written Off',    dot: 'bg-gray-500',    activeClass: 'bg-gray-500 border-gray-500 text-white' },
  { key: 'Cancelled',    label: 'Cancelled',      dot: 'bg-rose-500',    activeClass: 'bg-rose-500 border-rose-500 text-white' },
];
const SL_BADGE: Record<string, { bg: string; label: string }> = {
  Pending:       { bg: 'bg-amber-100 text-amber-700',   label: 'Pending'       },
  PartiallyPaid: { bg: 'bg-blue-100 text-blue-700',     label: 'Partially Paid'},
  FullySettled:  { bg: 'bg-emerald-100 text-emerald-700',label: 'Settled'      },
  Overdue:       { bg: 'bg-rose-100 text-rose-700',     label: 'Overdue'       },
  OnHold:        { bg: 'bg-yellow-100 text-yellow-700', label: 'On Hold'       },
  WrittenOff:    { bg: 'bg-gray-100 text-gray-600',     label: 'Written Off'   },
  Cancelled:     { bg: 'bg-rose-100 text-rose-700',     label: 'Cancelled'     },
};

// ─── Page wrapper (Suspense boundary required for useSearchParams in Next.js 13) ─
export default function PurchaseQueryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
      <PurchaseQueryInner />
    </Suspense>
  );
}

// ─── Inner page (needs useSearchParams — must be inside Suspense) ────────────────
function PurchaseQueryInner() {
  const { tenantId } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Map URL ?tab= values to display labels
  const TAB_SLUG_MAP: Record<string, string> = {
    grn: 'GRN',
    bt: 'Bill Transfer',
    settlements: 'Settlements',
  };
  const TAB_LABEL_TO_SLUG: Record<string, string> = {
    'GRN': 'grn',
    'Bill Transfer': 'bt',
    'Settlements': 'settlements',
  };

  const tabParam = searchParams.get('tab') ?? 'grn';
  const [moduleTab, setModuleTabState] = useState<string>(TAB_SLUG_MAP[tabParam] ?? 'GRN');

  const setModuleTab = (label: string) => {
    setModuleTabState(label);
    const slug = TAB_LABEL_TO_SLUG[label] ?? 'grn';
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', slug);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Sync from URL when navigating back/forward
  useEffect(() => {
    const slug = searchParams.get('tab') ?? 'grn';
    const label = TAB_SLUG_MAP[slug] ?? 'GRN';
    setModuleTabState(label);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Data
  const [rows,    setRows]    = useState<GrnHeaderDto[]>([]);
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoStr = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
  const [statusTab,            setStatusTab]            = useState('All');
  const [search,               setSearch]               = useState('');
  const [supplierFilter,       setSupplierFilter]       = useState('');
  const [purchaseCategoryFilter, setPurchaseCategoryFilter] = useState('');
  const [fromDate,             setFromDate]             = useState(thirtyDaysAgoStr);
  const [toDate,               setToDate]               = useState(todayStr);

  // Detail modal + pagination
  const [detailRow,        setDetailRow]        = useState<GrnHeaderDto | null>(null);
  const [invoiceDrawerInv, setInvoiceDrawerInv] = useState<PurchaseInvoiceDto | null>(null);
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);

  // Confirm dialog
  const [confirm, setConfirm] = useState<null | {
    title:    string;
    subtitle: string;
    variant:  'danger' | 'warning' | 'info';
    action:   () => Promise<void>;
  }>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit modal
  const [editRow,  setEditRow]  = useState<GrnHeaderDto | null>(null);
  // Print modal
  const [printRow, setPrintRow] = useState<GrnHeaderDto | null>(null);

  // ── Bill Transfer state ──────────────────────────────────────────────────────
  const [btRows,        setBtRows]        = useState<BillTransferDto[]>([]);
  const [btLoading,     setBtLoading]     = useState(false);
  const [btStatusTab,   setBtStatusTab]   = useState('All');
  const [btPage,        setBtPage]        = useState(1);
  const [btTotal,       setBtTotal]       = useState(0);
  const [btSearch,      setBtSearch]      = useState('');
  const [btLastSync,    setBtLastSync]    = useState<Date | null>(null);
  const [btConfirm, setBtConfirm] = useState<null | {
    title: string; subtitle: string; action: () => Promise<void>;
  }>(null);
  const [btProcessing, setBtProcessing] = useState(false);
  const [btRemarksModal, setBtRemarksModal] = useState<null | {
    title: string;
    onConfirm: (remarks: string) => Promise<void>;
  }>(null);
  // Phase 2: SOD override modal
  const [btSodModal, setBtSodModal] = useState<null | {
    title: string;
    invoiceAmount: number;
    threshold: number;
    requireReason: boolean;
    reasonCatalog: { reasonCode: string; reasonLabel: string }[];
    onConfirm: (remarks: string, overrideReasonCode: string, overrideReasonText: string) => Promise<void>;
  }>(null);
  // Phase 2: SOD result badge
  const [btLastSodDecision, setBtLastSodDecision] = useState<import('@/lib/api/inventory-service.api').SodDecisionDto | null>(null);
  // Phase 3: version conflict banner
  const [btVersionConflict, setBtVersionConflict] = useState(false);
  // Phase 3: event log timeline drawer
  const [btTimelineId,    setBtTimelineId]    = useState<string | null>(null);
  const [btTimelineLogs,  setBtTimelineLogs]  = useState<import('@/lib/api/inventory-service.api').BillTransferEventLogDto[]>([]);
  const [btTimelineLoading, setBtTimelineLoading] = useState(false);
  // BT detail view (row-click modal)
  const [btViewBt,      setBtViewBt]      = useState<BillTransferDto | null>(null);
  const [btViewGrn,     setBtViewGrn]     = useState<GrnHeaderDto | null>(null);
  const [btViewLoading, setBtViewLoading] = useState(false);
  // Phase 4: compliance + policy
  const [btCompliance, setBtCompliance] = useState<import('@/lib/api/inventory-service.api').BtComplianceReportDto | null>(null);
  const [btPolicyModal, setBtPolicyModal] = useState(false);
  const [btPolicy, setBtPolicy] = useState<import('@/lib/api/inventory-service.api').BillTransferPolicyDto | null>(null);
  const [btPolicyLoading, setBtPolicyLoading] = useState(false);

  // ── Invoice deep-link: ?invoiceId= filters GRN tab to a specific invoice ────
  const invoiceIdParam = searchParams.get('invoiceId');
  const [deepLinkInvoiceId, setDeepLinkInvoiceId] = useState<string | null>(invoiceIdParam);
  // Fetch the invoice number for breadcrumb display
  const [deepLinkInvoiceNum, setDeepLinkInvoiceNum] = useState<string | null>(null);

  // Derived: rows visible for the active status tab (stable reference via useMemo)
  // Also filter by deep-link invoice if present
  const visibleBtRows = React.useMemo(
    () => {
      const byStatus = btStatusTab === 'All' ? btRows : btRows.filter(r => r.status === btStatusTab);
      return deepLinkInvoiceId ? byStatus.filter(r => r.invoiceId === deepLinkInvoiceId) : byStatus;
    },
    [btRows, btStatusTab, deepLinkInvoiceId]
  );

  // ── Invoice Settlement state ─────────────────────────────────────────────────
  const [slRows,        setSlRows]        = useState<InvoiceSettlementDto[]>([]);
  const [slLoading,     setSlLoading]     = useState(false);
  const [slStatusTab,   setSlStatusTab]   = useState('All');
  const [slPage,        setSlPage]        = useState(1);
  const [slTotal,       setSlTotal]       = useState(0);
  const [slSearch,      setSlSearch]      = useState('');
  const [slLastSync,    setSlLastSync]    = useState<Date | null>(null);
  const [slDetail,      setSlDetail]      = useState<InvoiceSettlementDto | null>(null);
  const [slEventLogs,   setSlEventLogs]   = useState<SettlementEventLogDto[]>([]);
  const [slLogsLoading, setSlLogsLoading] = useState(false);
  const [slPayModal,    setSlPayModal]    = useState<InvoiceSettlementDto | null>(null);
  const [slCreditNoteModal, setSlCreditNoteModal] = useState<InvoiceSettlementDto | null>(null);
  const [slCreditReturnId, setSlCreditReturnId] = useState('');
  const [slConfirm, setSlConfirm] = useState<null | {
    title: string; subtitle: string; action: () => Promise<void>;
  }>(null);
  const [slProcessing, setSlProcessing]   = useState(false);
  const [slReasonModal, setSlReasonModal] = useState<null | {
    title: string; reasons: string[]; onConfirm: (reason: string) => Promise<void>;
  }>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grnResult, vResult] = await Promise.all([
        inventoryGrnApi.list({ includeUngenerated: true, pageSize: 500 }),
        inventoryVendorApi.list(1, 200),
      ]);
      setRows(grnResult.items ?? []);
      setVendors(vResult.items ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Bill Transfer load ────────────────────────────────────────────────────────
  const loadBt = useCallback(async () => {
    setBtLoading(true);
    try {
      const res = await inventoryBillTransferApi.list({ page: 1, pageSize: 200 });
      // Deduplicate by id in case backend returns duplicate synthetic rows
      const seen = new Set<string>();
      const all = (res.items ?? []).filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      const filtered = btSearch
        ? all.filter(r =>
            r.vendorName?.toLowerCase().includes(btSearch.toLowerCase()) ||
            r.grnNumber?.toLowerCase().includes(btSearch.toLowerCase()) ||
            r.invoiceNumber?.toLowerCase().includes(btSearch.toLowerCase())
          )
        : all;
      setBtRows(filtered);
      setBtTotal(res.total ?? 0);
      setBtLastSync(new Date());
      setBtVersionConflict(false);
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to load bill transfers');
    } finally {
      setBtLoading(false);
    }
  }, [btSearch]);

  // Auto-refresh BT every 30s when on the tab (FE-301)
  useEffect(() => {
    if (moduleTab !== 'Bill Transfer') return;
    loadBt();
    const id = setInterval(loadBt, 30_000);
    return () => clearInterval(id);
  }, [moduleTab, loadBt]);

  // Load compliance when entering BT tab (FE-402)
  useEffect(() => {
    if (moduleTab !== 'Bill Transfer') return;
    inventoryBillTransferApi.getComplianceReport()
      .then(r => setBtCompliance(r))
      .catch(() => {/* non-critical */});
  }, [moduleTab]);

  // ── Settlement load ───────────────────────────────────────────────────────────
  const loadSl = useCallback(async () => {
    setSlLoading(true);
    try {
      const status = slStatusTab === 'All' ? undefined : slStatusTab as SettlementStatus;
      const res = await inventorySettlementApi.list({ page: slPage, pageSize: 100, status });
      setSlRows(res.items ?? []);
      setSlTotal(res.total ?? 0);
      setSlLastSync(new Date());
    } catch (err: any) {
      toast.error(err?.response?.data ?? 'Failed to load settlements');
    } finally {
      setSlLoading(false);
    }
  }, [slStatusTab, slPage]);

  useEffect(() => {
    if (moduleTab !== 'Settlements') return;
    loadSl();
    const id = setInterval(loadSl, 30_000);
    return () => clearInterval(id);
  }, [moduleTab, loadSl]);

  const loadSlEventLogs = useCallback(async (settlementId: string) => {
    setSlLogsLoading(true);
    try {
      const logs = await inventorySettlementApi.getEventLogs(settlementId);
      setSlEventLogs(logs);
    } catch {
      setSlEventLogs([]);
    } finally {
      setSlLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!deepLinkInvoiceId) { setDeepLinkInvoiceNum(null); return; }
    inventoryInvoiceApi.get(deepLinkInvoiceId)
      .then(inv => setDeepLinkInvoiceNum(inv.invoiceNumber))
      .catch(() => setDeepLinkInvoiceNum(deepLinkInvoiceId));
  }, [deepLinkInvoiceId]);

  const clearDeepLink = () => {
    setDeepLinkInvoiceId(null);
    setDeepLinkInvoiceNum(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('invoiceId');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // ── URL-driven drawer state ───────────────────────────────────────────────────
  // ?id=<settlementId> → auto-open settlement detail drawer
  const settlementIdParam = searchParams.get('id');
  useEffect(() => {
    if (!settlementIdParam || !slRows.length) return;
    const found = slRows.find(s => s.id === settlementIdParam);
    if (found && !slDetail) {
      setSlDetail(found);
      setSlEventLogs([]);
      loadSlEventLogs(found.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementIdParam, slRows]);

  // ?vendorId=<vendorId> → auto-open vendor reconciliation drawer (VP tab)
  const vendorIdParam = searchParams.get('vendorId');
  useEffect(() => {
    if (!vendorIdParam || moduleTab !== 'Vendor Payments') return;
    // reconciliationTarget is set from vendor-payments page; here open detail if vendor row exists
    // (this page doesn't have a vendor list — skip reconciliation drawer; handled in vendor-payments page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorIdParam, moduleTab]);

  // ── Filtering ─────────────────────────────────────────────────────────────────
  // Non-status filters (used for both stat cards and table so they stay in sync)
  const dateFiltered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.vendorName?.toLowerCase().includes(q) ||
      (r.grnNumber?.toLowerCase().includes(q) ?? false);
    const matchSupplier  = !supplierFilter         || r.vendorId         === supplierFilter;
    const matchCategory  = !purchaseCategoryFilter || r.purchaseCategory === purchaseCategoryFilter;
    const rowDate = (r.grnDate ?? r.invoiceDate ?? '').slice(0, 10);
    const matchFrom = !fromDate || rowDate >= fromDate;
    const matchTo   = !toDate   || rowDate <= toDate;
    const matchInvoice = !deepLinkInvoiceId || r.invoiceId === deepLinkInvoiceId;
    return matchSearch && matchSupplier && matchCategory && matchFrom && matchTo && matchInvoice;
  });

  const filtered = dateFiltered.filter(r => {
    if (statusTab === 'All') return true;
    if (statusTab === 'InvoiceDraft')    return r.grnStatus === 'GRNNotGenerated' && r.approvalStatus === 'Draft';
    if (statusTab === 'GRNNotGenerated') return r.grnStatus === 'GRNNotGenerated' && r.approvalStatus === 'PrimaryApproved';
    if (statusTab === 'Cancelled')       return r.grnStatus === 'Cancelled' || r.grnStatus === 'Rejected';
    return r.grnStatus === statusTab;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────────
  const totalFiltered = filtered.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage      = Math.min(page, totalPages);
  const sliceStart    = (safePage - 1) * pageSize;
  const pageRows      = filtered.slice(sliceStart, sliceStart + pageSize);
  const showingFrom   = totalFiltered === 0 ? 0 : sliceStart + 1;
  const showingTo     = Math.min(sliceStart + pageSize, totalFiltered);

  // ── Tab counts — sourced from dateFiltered so they always match the table ──────
  const counts = STATUS_TABS.reduce((acc, t) => {
    if (t.key === 'All') {
      acc[t.key] = dateFiltered.length;
    } else if (t.key === 'InvoiceDraft') {
      acc[t.key] = dateFiltered.filter(r => r.grnStatus === 'GRNNotGenerated' && r.approvalStatus === 'Draft').length;
    } else if (t.key === 'GRNNotGenerated') {
      acc[t.key] = dateFiltered.filter(r => r.grnStatus === 'GRNNotGenerated' && r.approvalStatus === 'PrimaryApproved').length;
    } else if (t.key === 'Cancelled') {
      acc[t.key] = dateFiltered.filter(r => r.grnStatus === 'Cancelled' || r.grnStatus === 'Rejected').length;
    } else {
      acc[t.key] = dateFiltered.filter(r => r.grnStatus === t.key).length;
    }
    return acc;
  }, {} as Record<string, number>);

  // BT tab counts (computed from loaded btRows)
  const btCounts = React.useMemo(() => {
    const acc: Record<string, number> = { All: btRows.length };
    for (const r of btRows) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [btRows]);

  // Settlements tab counts (computed from loaded slRows)
  const slCounts = React.useMemo(() => {
    const acc: Record<string, number> = { All: slTotal || slRows.length };
    for (const r of slRows) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [slRows, slTotal]);

  // ── Actions ────────────────────────────────────────────────────────────────────
  const runWithConfirm = (
    title: string, subtitle: string, variant: 'danger' | 'warning' | 'info', action: () => Promise<void>,
  ) => setConfirm({ title, subtitle, variant, action });

  const execConfirm = async () => {
    if (!confirm || isProcessing) return;
    const fn = confirm.action;
    setConfirm(null);
    setIsProcessing(true);
    const tid = toast.loading('Processing…');
    try {
      await fn();
      toast.success('Done', { id: tid });
      load();
    } catch (err: any) {
      const msg = err?.response?.data ?? err?.message ?? 'Action failed';
      toast.error(String(msg).substring(0, 300), { id: tid });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateGrn    = (r: GrnHeaderDto) => runWithConfirm('Generate GRN?',     `Create a GRN for invoice "${r.invoiceNumber}".`,                                                             'info',    async () => { await inventoryGrnApi.generateFromInvoice(r.invoiceId, new Date().toISOString()); setStatusTab('Draft'); setPage(1); });
  const handleSubmitInvoice  = (r: GrnHeaderDto) => runWithConfirm('Submit Invoice?',   `Submit invoice "${r.invoiceNumber}" for approval. Once submitted it cannot be edited.`,                         'info',    async () => { await inventoryInvoiceApi.submit(r.invoiceId); setStatusTab('GRNNotGenerated'); setPage(1); });
  const handleCancelGrn      = (r: GrnHeaderDto) => runWithConfirm('Cancel GRN?',        `GRN "${r.grnNumber ?? r.invoiceNumber}" will be cancelled. This cannot be undone.`,                          'danger',  () => inventoryGrnApi.cancel(r.id).then(() => undefined));
  const handleCancelInvoice  = (r: GrnHeaderDto) => runWithConfirm('Cancel Invoice?',    `Invoice "${r.invoiceNumber}" will be cancelled. This cannot be undone.`,                                     'danger',  () => inventoryInvoiceApi.cancel(r.invoiceId));
  const handlePrimaryApproval= (r: GrnHeaderDto) => runWithConfirm('Primary Approval?',  `Give primary approval for GRN "${r.grnNumber ?? r.invoiceNumber}".`,                                        'warning', () => inventoryGrnApi.primaryApprove(r.id).then(() => undefined));
  const handleFinalApproval  = (r: GrnHeaderDto) => runWithConfirm('Final Approval?',    `Final approval of GRN "${r.grnNumber ?? r.invoiceNumber}" will update stock. This cannot be undone.`,      'warning', () => inventoryGrnApi.finalApprove(r.id).then(() => undefined));
  const handleEdit           = (r: GrnHeaderDto) => setEditRow(r);
  const handlePrint          = (r: GrnHeaderDto) => setPrintRow(r);
  const handleViewDetails    = async (r: GrnHeaderDto) => {
    const tid = toast.loading('Loading invoice…');
    try {
      const inv = await inventoryInvoiceApi.get(r.invoiceId);
      setInvoiceDrawerInv(inv);
      toast.dismiss(tid);
    } catch {
      toast.error('Could not load invoice details.', { id: tid });
    }
  };

  const resetFilters = () => { setSearch(''); setSupplierFilter(''); setPurchaseCategoryFilter(''); setFromDate(thirtyDaysAgoStr); setToDate(todayStr); setPage(1); };

  // ── Exception banner counts (GRN tab) ────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueGrnCount = rows.filter(r =>
    r.grnStatus === 'Approved' &&
    r.dueDate &&
    new Date(r.dueDate) < today &&
    (r.netAmount ?? r.totalAmount ?? 0) > 0
  ).length;

  // ── Stat cards config ─────────────────────────────────────────────────────────
  const STAT_CARDS = [
    { key: 'All',             label: 'Total Invoices',    icon: ClipboardList, color: 'text-slate-600',   iconBg: 'bg-slate-100',   bar: 'bg-slate-400'   },
    { key: 'InvoiceDraft',    label: 'Draft',             icon: FileText,      color: 'text-yellow-600',  iconBg: 'bg-yellow-100',  bar: 'bg-yellow-400'  },
    { key: 'GRNNotGenerated', label: 'GRN Pending',       icon: Package,       color: 'text-teal-600',    iconBg: 'bg-teal-100',    bar: 'bg-teal-500'    },
    { key: 'Draft',           label: 'Not Approved',      icon: ShoppingCart,  color: 'text-amber-600',   iconBg: 'bg-amber-100',   bar: 'bg-amber-500'   },
    { key: 'PrimaryApproved', label: 'Primary Approved',  icon: CheckCircle2,  color: 'text-emerald-600', iconBg: 'bg-emerald-100', bar: 'bg-emerald-500' },
    { key: 'Approved',        label: 'Fully Approved',    icon: Tag,           color: 'text-blue-600',    iconBg: 'bg-blue-100',    bar: 'bg-blue-500'    },
    { key: 'Cancelled',       label: 'Cancelled',         icon: Ban,           color: 'text-rose-600',    iconBg: 'bg-rose-100',    bar: 'bg-rose-500'    },
  ];
  const BT_STAT_CARDS = [
    { key: 'All',           label: 'Total BTs',       icon: ClipboardList, color: 'text-slate-600',   iconBg: 'bg-slate-100',   bar: 'bg-slate-400',  onClick: () => { setBtStatusTab('All'); } },
    { key: 'NotGenerated',  label: 'Pending BT',      icon: Package,       color: 'text-teal-600',    iconBg: 'bg-teal-100',    bar: 'bg-teal-500',   onClick: () => { setBtStatusTab('NotGenerated'); } },
    { key: 'Draft',         label: 'Draft',           icon: ShoppingCart,  color: 'text-amber-600',   iconBg: 'bg-amber-100',   bar: 'bg-amber-500',  onClick: () => { setBtStatusTab('Draft'); } },
    { key: 'L1Approved',    label: 'L1 Approved',     icon: CheckCircle2,  color: 'text-emerald-600', iconBg: 'bg-emerald-100', bar: 'bg-emerald-500',onClick: () => { setBtStatusTab('L1Approved'); } },
    { key: 'FullyApproved', label: 'Fully Approved',  icon: Tag,           color: 'text-blue-600',    iconBg: 'bg-blue-100',    bar: 'bg-blue-500',   onClick: () => { setBtStatusTab('FullyApproved'); } },
    { key: 'Cancelled',     label: 'Cancelled',       icon: Ban,           color: 'text-rose-600',    iconBg: 'bg-rose-100',    bar: 'bg-rose-500',   onClick: () => { setBtStatusTab('Cancelled'); } },
  ];
  const SL_STAT_CARDS = [
    { key: 'All',           label: 'Total',           icon: ClipboardList, color: 'text-slate-600',   iconBg: 'bg-slate-100',   bar: 'bg-slate-400',  onClick: () => { setSlStatusTab('All'); setSlPage(1); } },
    { key: 'Pending',       label: 'Pending',         icon: ShoppingCart,  color: 'text-amber-600',   iconBg: 'bg-amber-100',   bar: 'bg-amber-500',  onClick: () => { setSlStatusTab('Pending'); setSlPage(1); } },
    { key: 'PartiallyPaid', label: 'Partially Paid',  icon: CreditCard,    color: 'text-blue-600',    iconBg: 'bg-blue-100',    bar: 'bg-blue-500',   onClick: () => { setSlStatusTab('PartiallyPaid'); setSlPage(1); } },
    { key: 'FullySettled',  label: 'Settled',         icon: CheckCircle2,  color: 'text-emerald-600', iconBg: 'bg-emerald-100', bar: 'bg-emerald-500',onClick: () => { setSlStatusTab('FullySettled'); setSlPage(1); } },
    { key: 'Overdue',       label: 'Overdue',         icon: AlertTriangle, color: 'text-rose-600',    iconBg: 'bg-rose-100',    bar: 'bg-rose-500',   onClick: () => { setSlStatusTab('Overdue'); setSlPage(1); } },
    { key: 'OnHold',        label: 'On Hold',         icon: Calendar,      color: 'text-yellow-600',  iconBg: 'bg-yellow-100',  bar: 'bg-yellow-500', onClick: () => { setSlStatusTab('OnHold'); setSlPage(1); } },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      {/* Stat cards — tab-aware */}
      {moduleTab === 'GRN' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {STAT_CARDS.map(card => {
            const Icon = card.icon;
            const count = counts[card.key] ?? 0;
            const total = counts['All'] || 1;
            const isActive = statusTab === card.key;
            return (
              <button
                key={card.key}
                onClick={() => { setStatusTab(card.key); setPage(1); }}
                className={`text-left p-3.5 rounded-2xl border transition-all duration-150 ${
                  isActive
                    ? 'bg-white border-blue-200 shadow-md ring-2 ring-blue-100'
                    : 'bg-white border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon size={15} className={card.color} />
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{card.label}</p>
                <MiniBar value={count} max={total} color={card.bar} />
              </button>
            );
          })}
        </div>
      )}
      {moduleTab === 'Bill Transfer' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {BT_STAT_CARDS.map(card => {
            const Icon = card.icon;
            const count = btCounts[card.key] ?? 0;
            const total = btCounts['All'] || 1;
            const isActive = btStatusTab === card.key;
            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className={`text-left p-3.5 rounded-2xl border transition-all duration-150 ${
                  isActive
                    ? 'bg-white border-blue-200 shadow-md ring-2 ring-blue-100'
                    : 'bg-white border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon size={15} className={card.color} />
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{card.label}</p>
                <MiniBar value={count} max={total} color={card.bar} />
              </button>
            );
          })}
        </div>
      )}
      {moduleTab === 'Settlements' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {SL_STAT_CARDS.map(card => {
            const Icon = card.icon;
            const count = slCounts[card.key] ?? 0;
            const total = slCounts['All'] || 1;
            const isActive = slStatusTab === card.key;
            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className={`text-left p-3.5 rounded-2xl border transition-all duration-150 ${
                  isActive
                    ? 'bg-white border-blue-200 shadow-md ring-2 ring-blue-100'
                    : 'bg-white border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon size={15} className={card.color} />
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{card.label}</p>
                <MiniBar value={count} max={total} color={card.bar} />
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Module tabs (B2) */}
        <div className="border-b border-gray-100">
          <div className="flex px-4">
            {MODULE_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setModuleTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  moduleTab === tab
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {moduleTab === 'Bill Transfer' ? (
          <>
            {/* Bill Transfer: status tabs */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-50 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {BT_STATUS_TABS.map(t => {
                  const isActive = btStatusTab === t.key;
                  const cnt = t.key === 'All' ? btRows.length : btRows.filter(r => r.status === t.key).length;
                  return (
                    <button key={t.key} onClick={() => setBtStatusTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                        isActive ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : t.dot}`} />
                      {t.label}
                      {cnt > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>{cnt}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bill Transfer: deep-link breadcrumb */}
            {deepLinkInvoiceId && (
              <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <FileText size={14} className="shrink-0 text-blue-500" />
                <span>
                  Showing bill transfers for invoice{' '}
                  <strong>{deepLinkInvoiceNum ?? '…'}</strong>
                </span>
                <button
                  onClick={clearDeepLink}
                  className="ml-auto p-0.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 shrink-0"
                  title="Clear filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Bill Transfer: exception banners */}
            {btRows.some(r => r.status === 'L2Rejected') && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>
                  <strong>{btRows.filter(r => r.status === 'L2Rejected').length}</strong> bill transfer{btRows.filter(r => r.status === 'L2Rejected').length !== 1 ? 's' : ''} rejected by L2 — resubmission needed.
                </span>
                <button
                  onClick={() => setBtStatusTab('L2Rejected')}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:underline shrink-0"
                >
                  View →
                </button>
              </div>
            )}
            {(btCompliance?.slaBreached ?? btRows.filter(r => r.slaState === 'Breached').length) > 0 && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                <span>
                  <strong>{btCompliance?.slaBreached ?? btRows.filter(r => r.slaState === 'Breached').length}</strong> bill transfer SLA{(btCompliance?.slaBreached ?? 0) !== 1 ? 's' : ''} breached — escalation required.
                </span>
              </div>
            )}
            {/* Bill Transfer: search + refresh + policy */}
            <div className="px-4 py-3 border-b border-gray-50 flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={btSearch} onChange={e => setBtSearch(e.target.value)}
                  placeholder="Search vendor, GRN, invoice…"
                  className="pl-8 pr-3 py-1.5 text-sm w-full border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <button onClick={loadBt} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <RefreshCw size={14} className={btLoading ? 'animate-spin' : ''} />
              </button>
              {/* Policy admin button (FE-101) */}
              <button
                onClick={async () => {
                  setBtPolicyLoading(true);
                  try {
                    const p = await inventoryBillTransferApi.getPolicy();
                    setBtPolicy(p);
                    setBtPolicyModal(true);
                  } catch { toast.error('Failed to load policy'); }
                  finally { setBtPolicyLoading(false); }
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Settings size={12} />
                {btPolicyLoading ? 'Loading…' : 'Policy'}
              </button>
              {/* Staleness indicator (FE-303) */}
              {btLastSync && (
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  Synced {Math.round((Date.now() - btLastSync.getTime()) / 1000)}s ago
                </span>
              )}
            </div>

            {/* Version conflict banner (FE-302) */}
            {btVersionConflict && (
              <div className="mx-4 mt-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                <span>⚠ This record was updated by another user. Reload to see latest changes.</span>
                <button onClick={loadBt} className="ml-3 font-semibold underline hover:no-underline">Reload</button>
              </div>
            )}

            {/* Compliance insights strip (FE-402) */}
            {btCompliance && (
              <div className="mx-4 mt-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl flex gap-6 text-[11px] text-gray-600 flex-wrap">
                <span><b className="text-gray-800">{btCompliance.totalBillTransfers}</b> total</span>
                <span><b className="text-teal-700">{btCompliance.strictApprovals}</b> strict</span>
                <span><b className="text-amber-700">{btCompliance.overrideApprovals}</b> overrides ({btCompliance.overridePct}%)</span>
                <span><b className="text-rose-700">{btCompliance.slaBreached}</b> SLA breached</span>
                <span><b className="text-gray-800">{btCompliance.meanApprovalCycleHours}h</b> mean cycle</span>
                {/* Export button (FE-403) */}
                {btTimelineId && (
                  <button
                    onClick={async () => {
                      const logs = await inventoryBillTransferApi.getEventLog(btTimelineId);
                      const csv = ['Event ID,Action,From,To,Actor,Override,Reason,Date',
                        ...logs.map(l => [l.eventId, l.action, l.fromStatus ?? '', l.toStatus, l.actorUserId,
                          l.overrideApplied, l.reasonText ?? '', l.createdAt].join(','))
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `bt-timeline-${btTimelineId}.csv`; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="ml-auto flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                  >
                    ↓ Export timeline
                  </button>
                )}
              </div>
            )}

            {/* Bill Transfer: table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">GRN #</th>
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-right">Invoice Amt</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right">TCS</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">SLA</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {btLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : visibleBtRows.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No bill transfers found.</td></tr>
                  ) : (
                      visibleBtRows.map(bt => {
                      const badge = BT_BADGE[bt.status] ?? { bg: 'bg-gray-100 text-gray-600', label: bt.status };
                      const gst = bt.cgstAmount + bt.sgstAmount + bt.igstAmount;
                      // SLA badge (FE-401)
                      const slaColors: Record<string, string> = {
                        OnTrack: 'bg-teal-50 text-teal-700',
                        AtRisk:  'bg-amber-50 text-amber-700',
                        Breached:'bg-rose-50 text-rose-700',
                      };
                      const slaDot: Record<string, string> = {
                        OnTrack: 'bg-teal-400',
                        AtRisk:  'bg-amber-400',
                        Breached:'bg-rose-500',
                      };
                      const slaLabel = bt.slaState === 'Breached' ? '⚠ Breached'
                        : bt.slaState === 'AtRisk' ? '⏰ AtRisk'
                        : 'OnTrack';
                      const dueAt = bt.status === 'L1Approved' ? bt.l2DueAt : bt.l1DueAt;
                      const dueStr = dueAt
                        ? `Due ${new Date(dueAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`
                        : null;
                      return (
                        <tr
                          key={bt.id}
                          className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                          onClick={async () => {
                            setBtViewBt(bt);
                            setBtViewGrn(null);
                            setBtViewLoading(true);
                            try {
                              const grn = await inventoryGrnApi.get(bt.grnId);
                              setBtViewGrn(grn);
                            } catch { toast.error('Failed to load GRN details'); }
                            finally { setBtViewLoading(false); }
                          }}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-purple-700">{bt.grnNumber ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">{bt.invoiceNumber ?? '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-800">{bt.vendorName ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums">{fmtINR(bt.invoiceTotalAmount)}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-gray-500">{fmtINR(gst)}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-gray-500">{fmtINR(bt.tcsAmount)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(bt.createdAt)}</td>
                          {/* SLA cell (FE-401) */}
                          <td className="px-4 py-3">
                            {bt.status !== 'NotGenerated' && bt.status !== 'FullyApproved' && bt.status !== 'Cancelled' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${slaColors[bt.slaState] ?? 'bg-gray-100 text-gray-500'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${slaDot[bt.slaState] ?? 'bg-gray-400'}`} />
                                  {slaLabel}
                                </span>
                                {dueStr && <span className="text-[10px] text-gray-400">{dueStr}</span>}
                              </div>
                            ) : <span className="text-gray-300 text-[10px]">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.bg}`}>{badge.label}</span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 flex-nowrap">

                              {/* NotGenerated: Generate button only */}
                              {bt.status === 'NotGenerated' && (
                                <button
                                  title="Generate Bill Transfer"
                                  onClick={async () => {
                                    try {
                                      await inventoryBillTransferApi.generate(bt.grnId);
                                      toast.success('Bill Transfer generated');
                                      loadBt();
                                    } catch (e: any) {
                                      toast.error(e?.response?.data?.message ?? 'Failed to generate');
                                    }
                                  }}
                                  className="inline-flex items-center px-3 py-1 text-xs rounded-full bg-teal-600 text-white hover:bg-teal-700 font-medium transition-colors whitespace-nowrap"
                                >
                                  Generate
                                </button>
                              )}

                              {/* Draft / Resubmitted: L1 Approve + Reject */}
                              {(bt.status === 'Draft' || bt.status === 'Resubmitted') && (
                                <>
                                  <button
                                    title="Accounts Approve (L1)"
                                    onClick={async () => {
                                      let reasonCatalog: { reasonCode: string; reasonLabel: string }[] = [];
                                      try { reasonCatalog = (await inventoryBillTransferApi.getReasonCatalog('Override')).map(r => ({ reasonCode: r.reasonCode, reasonLabel: r.reasonLabel })); } catch {}
                                      const pol = await inventoryBillTransferApi.getPolicy().catch(() => null);
                                      const isPossibleViolation = pol && bt.invoiceTotalAmount <= pol.lowValueOverrideThreshold;
                                      if (isPossibleViolation && pol) {
                                        setBtSodModal({
                                          title: 'Accounts Approval (L1) — SOD Override',
                                          invoiceAmount: bt.invoiceTotalAmount,
                                          threshold: pol.lowValueOverrideThreshold,
                                          requireReason: pol.requireOverrideReason,
                                          reasonCatalog,
                                          onConfirm: async (remarks, overrideReasonCode, overrideReasonText) => {
                                            const result = await inventoryBillTransferApi.l1Approve(bt.id, { remarks, expectedVersion: bt.versionNo, overrideReasonCode, overrideReasonText });
                                            setBtLastSodDecision(result.sodDecision ?? null);
                                            toast.success('L1 approved' + (result.sodDecision?.overrideApplied ? ' (override applied)' : ''));
                                            loadBt();
                                          },
                                        });
                                      } else {
                                        setBtRemarksModal({
                                          title: 'Accounts Approval (L1)',
                                          onConfirm: async (remarks) => {
                                            try {
                                              const result = await inventoryBillTransferApi.l1Approve(bt.id, { remarks, expectedVersion: bt.versionNo });
                                              setBtLastSodDecision(result.sodDecision ?? null);
                                              toast.success('L1 approved'); loadBt();
                                            } catch (e: any) {
                                              if (e?.response?.data?.error === 'version_conflict') { setBtVersionConflict(true); throw e; }
                                              if (e?.response?.data?.error === 'sod_violation') { toast.error('SOD violation: ' + e.response.data.message); throw e; }
                                              throw e;
                                            }
                                          },
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-teal-600 text-white hover:bg-teal-700 font-medium transition-colors whitespace-nowrap"
                                  >
                                    <CheckCircle2 size={12} /> L1 Approve
                                  </button>
                                  <button
                                    title="Reject (L1)"
                                    onClick={() => setBtRemarksModal({
                                      title: 'Reject (L1)',
                                      onConfirm: async (remarks) => {
                                        try {
                                          await inventoryBillTransferApi.l1Reject(bt.id, remarks, bt.versionNo);
                                          toast.success('L1 rejected'); loadBt();
                                        } catch (e: any) {
                                          if (e?.response?.data?.error === 'version_conflict') { setBtVersionConflict(true); throw e; }
                                          throw e;
                                        }
                                      },
                                    })}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50 font-medium transition-colors whitespace-nowrap"
                                  >
                                    <XCircle size={12} /> Reject
                                  </button>
                                </>
                              )}

                              {/* L1Approved: L2 Approve + Reject */}
                              {bt.status === 'L1Approved' && (
                                <>
                                  <button
                                    title="Finance Approve (L2)"
                                    onClick={async () => {
                                      let reasonCatalog: { reasonCode: string; reasonLabel: string }[] = [];
                                      try { reasonCatalog = (await inventoryBillTransferApi.getReasonCatalog('Override')).map(r => ({ reasonCode: r.reasonCode, reasonLabel: r.reasonLabel })); } catch {}
                                      const pol = await inventoryBillTransferApi.getPolicy().catch(() => null);
                                      const isPossibleViolation = pol && bt.invoiceTotalAmount <= pol.lowValueOverrideThreshold;
                                      if (isPossibleViolation && pol) {
                                        setBtSodModal({
                                          title: 'Finance Approval (L2) — SOD Override',
                                          invoiceAmount: bt.invoiceTotalAmount,
                                          threshold: pol.lowValueOverrideThreshold,
                                          requireReason: pol.requireOverrideReason,
                                          reasonCatalog,
                                          onConfirm: async (remarks, overrideReasonCode, overrideReasonText) => {
                                            const result = await inventoryBillTransferApi.l2Approve(bt.id, { remarks, expectedVersion: bt.versionNo, overrideReasonCode, overrideReasonText });
                                            setBtLastSodDecision(result.sodDecision ?? null);
                                            toast.success('L2 approved — settlement created' + (result.sodDecision?.overrideApplied ? ' (override)' : ''));
                                            loadBt();
                                          },
                                        });
                                      } else {
                                        setBtRemarksModal({
                                          title: 'Finance Approval (L2)',
                                          onConfirm: async (remarks) => {
                                            try {
                                              const result = await inventoryBillTransferApi.l2Approve(bt.id, { remarks, expectedVersion: bt.versionNo });
                                              setBtLastSodDecision(result.sodDecision ?? null);
                                              toast.success('L2 approved — settlement created'); loadBt();
                                            } catch (e: any) {
                                              if (e?.response?.data?.error === 'version_conflict') { setBtVersionConflict(true); throw e; }
                                              if (e?.response?.data?.error === 'sod_violation') { toast.error('SOD violation: ' + e.response.data.message); throw e; }
                                              throw e;
                                            }
                                          },
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors whitespace-nowrap"
                                  >
                                    <CheckCircle2 size={12} /> L2 Approve
                                  </button>
                                  <button
                                    title="Reject (L2)"
                                    onClick={() => setBtRemarksModal({
                                      title: 'Reject (L2)',
                                      onConfirm: async (remarks) => {
                                        try {
                                          await inventoryBillTransferApi.l2Reject(bt.id, remarks, bt.versionNo);
                                          toast.success('L2 rejected'); loadBt();
                                        } catch (e: any) {
                                          if (e?.response?.data?.error === 'version_conflict') { setBtVersionConflict(true); throw e; }
                                          throw e;
                                        }
                                      },
                                    })}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border border-orange-400 text-orange-600 hover:bg-orange-50 font-medium transition-colors whitespace-nowrap"
                                  >
                                    <XCircle size={12} /> Reject
                                  </button>
                                </>
                              )}

                              {/* L1Rejected / L2Rejected: Resubmit */}
                              {(bt.status === 'L1Rejected' || bt.status === 'L2Rejected') && (
                                <button
                                  title="Resubmit for Approval"
                                  onClick={() => setBtRemarksModal({
                                    title: 'Resubmit for Approval',
                                    onConfirm: async (remarks) => {
                                      try {
                                        await inventoryBillTransferApi.resubmit(bt.id, remarks, bt.versionNo);
                                        toast.success('Resubmitted'); loadBt();
                                      } catch (e: any) {
                                        if (e?.response?.data?.error === 'version_conflict') { setBtVersionConflict(true); throw e; }
                                        throw e;
                                      }
                                    },
                                  })}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border border-purple-300 text-purple-600 hover:bg-purple-50 font-medium transition-colors whitespace-nowrap"
                                >
                                  <RefreshCw size={12} /> Resubmit
                                </button>
                              )}

                              {/* View Timeline — inline button for all statuses except NotGenerated */}
                              {bt.status !== 'NotGenerated' && (
                                <button
                                  title="View Timeline"
                                  onClick={async () => {
                                    setBtTimelineId(bt.id);
                                    setBtTimelineLoading(true);
                                    try {
                                      const logs = await inventoryBillTransferApi.getEventLog(bt.id);
                                      setBtTimelineLogs(logs);
                                    } catch { toast.error('Failed to load timeline'); }
                                    finally { setBtTimelineLoading(false); }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium transition-colors whitespace-nowrap"
                                >
                                  <ListOrdered size={12} /> Timeline
                                </button>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* BT Detail View Modal (row-click) */}
            {btViewBt && (
              <BtDetailModal
                bt={btViewBt}
                grn={btViewGrn}
                loading={btViewLoading}
                onClose={() => { setBtViewBt(null); setBtViewGrn(null); }}
              />
            )}

            {/* BT remarks modal */}
            {btRemarksModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setBtRemarksModal(null)} />
                <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">{btRemarksModal.title}</h3>
                  <BtRemarksForm
                    onConfirm={async (remarks) => {
                      setBtProcessing(true);
                      try { await btRemarksModal.onConfirm(remarks); setBtRemarksModal(null); }
                      catch (err: any) { toast.error(err?.response?.data?.message ?? err?.response?.data ?? 'Action failed'); }
                      finally { setBtProcessing(false); }
                    }}
                    onCancel={() => setBtRemarksModal(null)}
                    processing={btProcessing}
                  />
                </div>
              </div>
            )}

            {/* SOD Override modal (FE-201/202) */}
            {btSodModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setBtSodModal(null)} />
                <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{btSodModal.title}</h3>
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                    ⚠ SOD rule would normally block this action. Low-value override is available because this invoice
                    ({fmtINR(btSodModal.invoiceAmount)}) is ≤ threshold ({fmtINR(btSodModal.threshold)}).
                  </p>
                  <SodOverrideForm
                    requireReason={btSodModal.requireReason}
                    reasonCatalog={btSodModal.reasonCatalog}
                    onConfirm={async (remarks, overrideReasonCode, overrideReasonText) => {
                      setBtProcessing(true);
                      try {
                        await btSodModal.onConfirm(remarks, overrideReasonCode, overrideReasonText);
                        setBtSodModal(null);
                      } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Action failed'); }
                      finally { setBtProcessing(false); }
                    }}
                    onCancel={() => setBtSodModal(null)}
                    processing={btProcessing}
                  />
                </div>
              </div>
            )}

            {/* Timeline drawer (FE-103) */}
            {btTimelineId && (
              <div className="fixed inset-0 z-50 flex items-end justify-end">
                <div className="absolute inset-0 bg-black/20" onClick={() => setBtTimelineId(null)} />
                <div className="relative z-10 bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Approval Timeline</h3>
                    <button onClick={() => setBtTimelineId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕ Close</button>
                  </div>
                  {btTimelineLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                    </div>
                  ) : btTimelineLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No events yet.</p>
                  ) : (
                    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                      {btTimelineLogs.map((log, i) => (
                        <li key={log.eventId} className="ml-4">
                          <span className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white bg-blue-400" />
                          <p className="text-xs font-semibold text-gray-800">{log.action} → {log.toStatus}</p>
                          {log.fromStatus && <p className="text-[10px] text-gray-400">from {log.fromStatus}</p>}
                          {log.overrideApplied && (
                            <span className="inline-block text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 mt-0.5">Override applied</span>
                          )}
                          {log.reasonText && <p className="text-[11px] text-gray-500 mt-0.5 italic">"{log.reasonText}"</p>}
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}

            {/* Policy settings modal (FE-101) */}
            {btPolicyModal && btPolicy && (
              <BtPolicyModal
                policy={btPolicy}
                onSave={async (updated) => {
                  try {
                    const saved = await inventoryBillTransferApi.upsertPolicy(updated);
                    setBtPolicy(saved as any);
                    setBtPolicyModal(false);
                    toast.success('Policy saved');
                  } catch { toast.error('Failed to save policy'); }
                }}
                onClose={() => setBtPolicyModal(false)}
              />
            )}

            {/* BT confirm dialog */}
            {btConfirm && (
              <ConfirmationDialog
                title={btConfirm.title}
                subtitle={btConfirm.subtitle}
                variant="danger"
                isProcessing={btProcessing}
                onConfirm={async () => {
                  setBtProcessing(true);
                  try { await btConfirm.action(); setBtConfirm(null); }
                  catch (err: any) { toast.error(err?.response?.data ?? 'Action failed'); }
                  finally { setBtProcessing(false); }
                }}
                onCancel={() => setBtConfirm(null)}
              />
            )}
          </>

        ) : moduleTab === 'Settlements' ? (
          <>
            {/* Settlements: status tabs */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-50 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {SL_STATUS_TABS.map(t => {
                  const isActive = slStatusTab === t.key;
                  const cnt = t.key === 'All' ? slRows.length : slRows.filter(r => r.status === t.key).length;
                  return (
                    <button key={t.key} onClick={() => { setSlStatusTab(t.key); setSlPage(1); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                        isActive ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : t.dot}`} />
                      {t.label}
                      {cnt > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>{cnt}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settlements: toolbar — search + refresh + last-sync */}
            {/* Settlements: deep-link breadcrumb */}
            {deepLinkInvoiceNum && (
              <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <FileText size={14} className="shrink-0 text-blue-500" />
                <span>
                  Showing settlements for invoice{' '}
                  <strong>{deepLinkInvoiceNum}</strong>
                </span>
                <button
                  onClick={clearDeepLink}
                  className="ml-auto p-0.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 shrink-0"
                  title="Clear filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Settlements: exception banners */}
            {slRows.some(r => r.status === 'OnHold') && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
                <AlertTriangle size={14} className="shrink-0 text-yellow-500" />
                <span>
                  <strong>{slRows.filter(r => r.status === 'OnHold').length}</strong> settlement{slRows.filter(r => r.status === 'OnHold').length !== 1 ? 's' : ''} on hold — requires resolution.
                </span>
                <button
                  onClick={() => { setSlStatusTab('OnHold'); setSlPage(1); }}
                  className="ml-auto text-xs font-semibold text-yellow-600 hover:underline shrink-0"
                >
                  View →
                </button>
              </div>
            )}
            {slRows.some(r =>
              r.status === 'Overdue' ||
              (r.status === 'Pending' && r.dueDate && new Date(r.dueDate) < new Date())
            ) && (
              <div className="mx-4 mt-1 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>
                  <strong>{slRows.filter(r =>
                    r.status === 'Overdue' ||
                    (r.status === 'Pending' && r.dueDate && new Date(r.dueDate) < new Date())
                  ).length}</strong> settlement{slRows.filter(r =>
                    r.status === 'Overdue' ||
                    (r.status === 'Pending' && r.dueDate && new Date(r.dueDate) < new Date())
                  ).length !== 1 ? 's' : ''} overdue — payment due date has passed.
                </span>
                <button
                  onClick={() => { setSlStatusTab('Overdue'); setSlPage(1); }}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:underline shrink-0"
                >
                  View →
                </button>
              </div>
            )}
            <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-gray-500 shrink-0">Vendor settlement ledger</span>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={slSearch}
                  onChange={e => setSlSearch(e.target.value)}
                  placeholder="Search vendor / GRN / invoice…"
                  className="pl-7 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-full"
                />
              </div>
              {slLastSync && (
                <span className="text-[11px] text-gray-400 shrink-0 hidden sm:inline">
                  Synced {slLastSync.toLocaleTimeString()}
                </span>
              )}
              <button onClick={loadSl} aria-label="Refresh settlements"
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <RefreshCw size={14} className={slLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Settlements: table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">GRN / Invoice</th>
                    <th className="px-4 py-3 text-right">Gross Amt</th>
                    <th className="px-4 py-3 text-right">Credit Adj</th>
                    <th className="px-4 py-3 text-right">TCS</th>
                    <th className="px-4 py-3 text-right">Net Payable</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-left">Due Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {slLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 11 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : (() => {
                    const q = slSearch.trim().toLowerCase();
                    const deepLinkSlRows = deepLinkInvoiceNum
                      ? slRows.filter(r => r.invoiceNumber === deepLinkInvoiceNum)
                      : slRows;
                    const visible = q
                      ? deepLinkSlRows.filter(r =>
                          r.vendorName?.toLowerCase().includes(q) ||
                          r.grnNumber?.toLowerCase().includes(q) ||
                          r.invoiceNumber?.toLowerCase().includes(q)
                        )
                      : deepLinkSlRows;
                    if (visible.length === 0)
                      return <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">No settlements found.</td></tr>;
                    return visible.map(sl => {
                      const badge    = SL_BADGE[sl.status] ?? { bg: 'bg-gray-100 text-gray-600', label: sl.status };
                      const isOverdue = sl.status === 'Overdue' ||
                        (sl.status === 'Pending' && !!sl.dueDate && new Date(sl.dueDate) < new Date());
                      const canPay    = sl.status === 'Pending' || sl.status === 'PartiallyPaid' || sl.status === 'Overdue';
                      const canCredit = canPay;
                      const canHold   = canPay;
                      const canResume = sl.status === 'OnHold';
                      const canCancel = sl.amountPaid === 0 && !['FullySettled','Cancelled','WrittenOff'].includes(sl.status);
                      const canWriteOff = sl.status === 'Overdue' || sl.status === 'OnHold' || sl.status === 'PartiallyPaid';
                      return (
                        <tr key={sl.id}
                          className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${isOverdue ? 'bg-rose-50/40' : ''}`}
                          onClick={() => { setSlDetail(sl); setSlEventLogs([]); loadSlEventLogs(sl.id); }}>
                          <td className="px-4 py-3 text-xs font-medium text-gray-800">
                            <div>{sl.vendorName ?? '—'}</div>
                            {sl.onHoldReason && (
                              <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200">
                                On Hold: {sl.onHoldReason.length > 30 ? sl.onHoldReason.slice(0, 30) + '…' : sl.onHoldReason}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div className="font-mono text-purple-700">{sl.grnNumber ?? '—'}</div>
                            <div className="text-gray-400">{sl.invoiceNumber ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums">{fmtINR(sl.grossAmount)}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-emerald-600">
                            {sl.debitNoteAdjustment > 0 ? `−${fmtINR(sl.debitNoteAdjustment)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-gray-500">{fmtINR(sl.tcsAmount)}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums font-semibold">{fmtINR(sl.netPayableAmount)}</td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-emerald-600">{fmtINR(sl.amountPaid)}</td>
                          <td className={`px-4 py-3 text-xs text-right tabular-nums font-semibold ${sl.balanceRemaining > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                            {fmtINR(sl.balanceRemaining)}
                          </td>
                          <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>
                            {fmtDate(sl.dueDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.bg}`}>{badge.label}</span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              {canPay && (
                                <button aria-label="Record payment" title="Record Payment"
                                  onClick={() => setSlPayModal(sl)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                                  <CreditCard size={14} />
                                </button>
                              )}
                              {canCredit && (
                                <button aria-label="Apply credit note" title="Apply Credit Note"
                                  onClick={() => { setSlCreditNoteModal(sl); setSlCreditReturnId(''); }}
                                  className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50 transition-colors">
                                  <Tag size={14} />
                                </button>
                              )}
                              {canHold && (
                                <button aria-label="Put on hold" title="Put On Hold"
                                  onClick={() => setSlReasonModal({
                                    title: 'Hold Reason',
                                    reasons: [
                                      'Payment dispute with vendor — awaiting resolution',
                                      'Invoice discrepancy — under review',
                                      'Awaiting credit note from vendor',
                                      'Short supply / quality issue pending resolution',
                                      'Vendor bank details under verification',
                                      'Awaiting management approval',
                                      'Cash flow constraint — scheduled for next cycle',
                                      'Duplicate invoice — verification in progress',
                                      'Other',
                                    ],
                                    onConfirm: async (reason) => {
                                      await inventorySettlementApi.hold(sl.id, reason);
                                      toast.success('Settlement put on hold'); loadSl();
                                    },
                                  })}
                                  className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors">
                                  <AlertTriangle size={14} />
                                </button>
                              )}
                              {canResume && (
                                <button aria-label="Resume settlement" title="Resume"
                                  onClick={async () => {
                                    setSlProcessing(true);
                                    try { await inventorySettlementApi.resume(sl.id); toast.success('Resumed'); loadSl(); }
                                    catch (err: any) { toast.error(err?.response?.data ?? 'Failed'); }
                                    finally { setSlProcessing(false); }
                                  }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                                  <RefreshCw size={14} />
                                </button>
                              )}
                              {canWriteOff && (
                                <button aria-label="Write off balance" title="Write Off"
                                  onClick={() => setSlReasonModal({
                                    title: 'Write-Off Reason',
                                    reasons: [
                                      'Vendor dispute settled — balance waived by vendor',
                                      'Amount below cost-effective recovery threshold',
                                      'Vendor business closed / insolvent',
                                      'Legal / compromise settlement',
                                      'Management approval — bad debt write-off',
                                      'Full credit note received in satisfaction',
                                      'Other',
                                    ],
                                    onConfirm: async (reason) => {
                                      await inventorySettlementApi.writeOff(sl.id, reason);
                                      toast.success('Written off'); loadSl();
                                    },
                                  })}
                                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                                  <Ban size={14} />
                                </button>
                              )}
                              {canCancel && (
                                <button aria-label="Cancel settlement" title="Cancel (no payments)"
                                  onClick={() => setSlReasonModal({
                                    title: 'Cancel Reason',
                                    reasons: [
                                      'Invoice raised in error',
                                      'Duplicate bill transfer',
                                      'Wrong vendor selected',
                                      'GRN cancelled subsequently',
                                      'Test / demo data entry',
                                      "Vendor agreement not finalised",
                                      'Other',
                                    ],
                                    onConfirm: async (reason) => {
                                      await inventorySettlementApi.cancel(sl.id, reason);
                                      toast.success('Settlement cancelled'); loadSl();
                                    },
                                  })}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors">
                                  <XCircle size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Settlement detail drawer */}
            {slDetail && (() => {
              const statusCls: Record<string, [string, string]> = {
                Pending:       ['bg-slate-100 text-slate-700',    'Pending'],
                PartiallyPaid: ['bg-amber-100 text-amber-700',    'Partial'],
                FullySettled:  ['bg-emerald-100 text-emerald-700','Settled'],
                Overdue:       ['bg-red-100 text-red-700',        'Overdue'],
                OnHold:        ['bg-yellow-100 text-yellow-800',  'On Hold'],
                Cancelled:     ['bg-rose-100 text-rose-700',      'Cancelled'],
                WrittenOff:    ['bg-gray-100 text-gray-700',      'Written Off'],
              };
              const [badgeCls, badgeLbl] = statusCls[slDetail.status] ?? ['bg-gray-100 text-gray-700', slDetail.status];

              const eventChip = (type: string): [string, string] =>
                ({
                  Created:       ['bg-slate-100 text-slate-600',    'Created'],
                  MarkedOverdue: ['bg-red-100 text-red-700',        'Overdue'],
                  HoldPlaced:    ['bg-yellow-100 text-yellow-700',  'Hold placed'],
                  HoldResumed:   ['bg-emerald-100 text-emerald-700','Hold resumed'],
                  Cancelled:     ['bg-rose-100 text-rose-700',      'Cancelled'],
                  WrittenOff:    ['bg-gray-100 text-gray-600',      'Written off'],
                } as Record<string, [string, string]>)[type] ?? ['bg-blue-100 text-blue-700', type];

              const eventDot = (type: string) =>
                ({
                  Created: 'bg-slate-400', MarkedOverdue: 'bg-red-400',
                  HoldPlaced: 'bg-yellow-400', HoldResumed: 'bg-emerald-400',
                  Cancelled: 'bg-rose-500', WrittenOff: 'bg-gray-400',
                } as Record<string, string>)[type] ?? 'bg-blue-400';

              const payItems = slDetail.payments.map(p => ({
                kind: 'payment' as const, id: p.id, ts: new Date(p.appliedAt).getTime(), data: p,
              }));
              const evItems = slEventLogs
                .filter(e => e.eventType !== 'PaymentRecorded' && e.eventType !== 'CreditNoteApplied')
                .map(e => ({ kind: 'event' as const, id: e.id, ts: new Date(e.occurredAt).getTime(), data: e }));
              const timeline = [...payItems, ...evItems].sort((a, b) => b.ts - a.ts);

              const payMethodDetail = (p: (typeof slDetail.payments)[0]): string => {
                if (p.allocationType === 'CreditNote')
                  return p.reference ? `Return ${p.reference.slice(0, 8)}…` : 'Credit adjustment';
                const m = p.paymentMethod;
                if (!m) return p.reference ?? '';
                if (m === 'NEFT' || m === 'RTGS') return `UTR: ${p.utrNumber ?? p.reference ?? '—'}`;
                if (m === 'Cheque') return `Cheque #${p.chequeNumber ?? '—'}${p.bankName ? ` · ${p.bankName}` : ''}`;
                if (m === 'UPI') return `${p.upiApp ? p.upiApp + ' · ' : ''}${p.upiId ?? p.reference ?? '—'}`;
                if (m === 'Cash') return `Receipt ${p.cashReceiptNumber ?? '—'}${p.cashReceivedBy ? ` · ${p.cashReceivedBy}` : ''}`;
                return p.reference ?? '';
              };

              return (
                <div className="fixed inset-0 z-50 flex items-start justify-end"
                  onKeyDown={e => { if (e.key === 'Escape') setSlDetail(null); }}
                  tabIndex={-1}>
                  <div className="absolute inset-0 bg-black/20" onClick={() => setSlDetail(null)} />
                  <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
                    onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">Settlement Details</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls}`}>
                          {badgeLbl}
                        </span>
                      </div>
                      <button onClick={() => setSlDetail(null)} aria-label="Close drawer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                        <X size={16} />
                      </button>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                      {/* Zone 1 — Financial summary */}
                      <div>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { label: 'Net Payable', val: fmtINR(slDetail.netPayableAmount), cls: 'text-gray-900' },
                            { label: 'Paid',        val: fmtINR(slDetail.amountPaid),        cls: 'text-emerald-700' },
                            { label: 'Balance',     val: fmtINR(slDetail.balanceRemaining),  cls: slDetail.balanceRemaining > 0 ? 'text-amber-700' : 'text-gray-400' },
                          ] as const).map(tile => (
                            <div key={tile.label} className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                              <p className={`text-sm font-bold ${tile.cls}`}>{tile.val}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{tile.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
                          {slDetail.dueDate && (
                            <span><span className="font-medium">Due:</span> {fmtDate(slDetail.dueDate)}</span>
                          )}
                          {slDetail.settledAt && (
                            <span><span className="font-medium text-emerald-700">Settled:</span> {fmtDate(slDetail.settledAt)}</span>
                          )}
                          {(slDetail.debitNoteAdjustment > 0 || slDetail.tcsAmount > 0) && (
                            <span className="text-gray-400">
                              Gross {fmtINR(slDetail.grossAmount)}
                              {slDetail.debitNoteAdjustment > 0 && ` − Adj ${fmtINR(slDetail.debitNoteAdjustment)}`}
                              {slDetail.tcsAmount > 0 && ` − TCS ${fmtINR(slDetail.tcsAmount)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reason alerts */}
                      {slDetail.onHoldReason && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl px-4 py-3 text-xs text-yellow-700">
                          <span className="font-semibold">Hold reason: </span>{slDetail.onHoldReason}
                        </div>
                      )}
                      {slDetail.cancellationReason && (
                        <div className="bg-rose-50 border-l-4 border-rose-400 rounded-xl px-4 py-3 text-xs text-rose-700">
                          <span className="font-semibold">Cancelled: </span>{slDetail.cancellationReason}
                        </div>
                      )}
                      {slDetail.writeOffReason && (
                        <div className="bg-gray-50 border-l-4 border-gray-400 rounded-xl px-4 py-3 text-xs text-gray-600">
                          <span className="font-semibold">Written off: </span>{slDetail.writeOffReason}
                        </div>
                      )}

                      {/* Zone 2 — Context metadata */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <MetaRow label="Vendor"   value={slDetail.vendorName} />
                        <MetaRow label="GRN"      value={slDetail.grnNumber} />
                        <MetaRow label="Invoice"  value={slDetail.invoiceNumber} />
                        <MetaRow label="Created"  value={fmtDate(slDetail.createdAt)} />
                        <MetaRow label="Updated"  value={fmtDate(slDetail.updatedAt)} />
                      </div>

                      {/* Zone 3 — Unified activity timeline */}
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity</p>
                        {slLogsLoading && timeline.length === 0 ? (
                          <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                            ))}
                          </div>
                        ) : timeline.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No activity recorded yet.</p>
                        ) : (
                          <ol className="relative border-l border-gray-200 ml-1.5 space-y-4">
                            {timeline.map(item => {
                              if (item.kind === 'payment') {
                                const p = item.data;
                                const isCN = p.allocationType === 'CreditNote';
                                const detail = payMethodDetail(p);
                                return (
                                  <li key={p.id} className="ml-4 relative">
                                    <span className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isCN ? 'bg-blue-400' : 'bg-emerald-500'}`} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${isCN ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {isCN ? 'Credit Note' : (p.paymentMethod ?? 'Payment')}
                                        </span>
                                        <span className="text-xs font-bold text-emerald-700">{fmtINR(p.amountAllocated)}</span>
                                      </div>
                                      {detail && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{detail}</p>}
                                      {p.bankName && !isCN && p.paymentMethod !== 'Cash' && p.paymentMethod !== 'UPI' && (
                                        <p className="text-[11px] text-gray-400 truncate">
                                          {p.bankName}{p.ifscCode ? ` · ${p.ifscCode}` : ''}
                                        </p>
                                      )}
                                      {p.chequeDate && (
                                        <p className="text-[11px] text-gray-400">
                                          Cheque dt {fmtDate(p.chequeDate)}
                                          {p.expectedClearanceDate ? ` · Clears ${fmtDate(p.expectedClearanceDate)}` : ''}
                                        </p>
                                      )}
                                      {p.remarks && <p className="text-[11px] text-gray-400 italic truncate">{p.remarks}</p>}
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] text-gray-400">{new Date(p.appliedAt).toLocaleString()}</p>
                                        {p.attachmentUrl && (
                                          <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                            title={p.attachmentFilename ?? 'View proof'}
                                            className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 hover:text-violet-800 font-medium underline underline-offset-2">
                                            <Paperclip size={10} />
                                            {p.attachmentFilename ?? 'Proof'}
                                            {p.attachmentSizeKb ? ` (${p.attachmentSizeKb}KB)` : ''}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                );
                              }
                              const ev = item.data;
                              const [evChipCls, evChipLbl] = eventChip(ev.eventType);
                              return (
                                <li key={ev.id} className="ml-4 relative">
                                  <span className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${eventDot(ev.eventType)}`} />
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${evChipCls}`}>
                                        {evChipLbl}
                                      </span>
                                      {ev.amount != null && (
                                        <span className="text-[11px] font-semibold text-amber-700">{fmtINR(ev.amount)}</span>
                                      )}
                                    </div>
                                    {ev.fromStatus && ev.toStatus && ev.fromStatus !== '—' && (
                                      <p className="text-[11px] text-gray-500 mt-0.5">{ev.fromStatus} → {ev.toStatus}</p>
                                    )}
                                    {ev.reason && <p className="text-[11px] text-gray-500 italic">{ev.reason}</p>}
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {ev.actorType === 'system' ? 'System' : 'User'} · {new Date(ev.occurredAt).toLocaleString()}
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Record payment modal */}
            {slPayModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSlPayModal(null)} />
                <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Record Payment</h3>
                  <p className="text-xs text-gray-500 mb-4">Balance: {fmtINR(slPayModal.balanceRemaining)}</p>
                  <RecordPaymentForm
                    maxAmount={slPayModal.balanceRemaining}
                    vendorId={slPayModal.vendorId}
                    settlementId={slPayModal.id}
                    onConfirm={async (req) => {
                      setSlProcessing(true);
                      try {
                        await inventorySettlementApi.recordPayment(slPayModal.id, req);
                        toast.success('Payment recorded');
                        setSlPayModal(null);
                        loadSl();
                      } catch (err: any) {
                        toast.error(err?.response?.data ?? 'Payment failed');
                      } finally { setSlProcessing(false); }
                    }}
                    onCancel={() => setSlPayModal(null)}
                    processing={slProcessing}
                  />
                </div>
              </div>
            )}

            {/* Apply Credit Note modal */}
            {slCreditNoteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSlCreditNoteModal(null)} />
                <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Apply Credit Note</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Vendor: <span className="font-medium">{slCreditNoteModal.vendorName}</span> · Balance: {fmtINR(slCreditNoteModal.balanceRemaining)}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Return ID</label>
                      <input
                        value={slCreditReturnId}
                        onChange={e => setSlCreditReturnId(e.target.value)}
                        placeholder="UUID of the purchase return with credit note"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">The return must be in &apos;CreditNoteReceived&apos; state.</p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={!slCreditReturnId.trim() || slProcessing}
                        onClick={async () => {
                          setSlProcessing(true);
                          try {
                            await inventorySettlementApi.applyCreditNote(slCreditNoteModal.id, slCreditReturnId.trim());
                            toast.success('Credit note applied');
                            setSlCreditNoteModal(null);
                            loadSl();
                          } catch (err: any) {
                            toast.error(err?.response?.data ?? 'Failed to apply credit note');
                          } finally { setSlProcessing(false); }
                        }}
                        className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-violet-700 transition-colors">
                        {slProcessing ? 'Applying…' : 'Apply Credit Note'}
                      </button>
                      <button onClick={() => setSlCreditNoteModal(null)}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settlement reason modal (hold / write-off / cancel) */}
            {slReasonModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSlReasonModal(null)} />
                <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">{slReasonModal.title}</h3>
                  <ReasonForm
                    reasons={slReasonModal.reasons}
                    onConfirm={async (reason) => {
                      setSlProcessing(true);
                      try { await slReasonModal.onConfirm(reason); setSlReasonModal(null); }
                      catch (err: any) { toast.error(err?.response?.data ?? 'Action failed'); }
                      finally { setSlProcessing(false); }
                    }}
                    onCancel={() => setSlReasonModal(null)}
                    processing={slProcessing}
                  />
                </div>
              </div>
            )}

            {/* Settlement confirm dialog */}
            {slConfirm && (
              <ConfirmationDialog
                title={slConfirm.title}
                subtitle={slConfirm.subtitle}
                variant="danger"
                isProcessing={slProcessing}
                onConfirm={async () => {
                  setSlProcessing(true);
                  try { await slConfirm.action(); setSlConfirm(null); }
                  catch (err: any) { toast.error(err?.response?.data ?? 'Action failed'); }
                  finally { setSlProcessing(false); }
                }}
                onCancel={() => setSlConfirm(null)}
              />
            )}
          </>

        ) : (
          <>
            {/* Deep-link breadcrumb banner */}
            {deepLinkInvoiceId && (
              <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <FileText size={14} className="shrink-0 text-blue-500" />
                <span>
                  Showing GRNs for invoice{' '}
                  <strong>{deepLinkInvoiceNum ?? '…'}</strong>
                </span>
                <button
                  onClick={clearDeepLink}
                  className="ml-auto p-0.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 shrink-0"
                  title="Clear filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {/* Overdue exception banner */}
            {overdueGrnCount > 0 && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>
                  <strong>{overdueGrnCount}</strong> approved GRN{overdueGrnCount !== 1 ? 's' : ''} with overdue payment.{' '}
                </span>
                <button
                  onClick={() => { setStatusTab('Approved'); setPage(1); }}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:underline shrink-0"
                >
                  View →
                </button>
              </div>
            )}
            {/* Status filter sub-tabs (pill style) */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-50 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {STATUS_TABS.map(t => {
                  const isActive = statusTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setStatusTab(t.key); setPage(1); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap ${
                        isActive ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : t.dot}`} />
                      {t.label}
                      {counts[t.key] > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {counts[t.key]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter bar (B3) */}
            <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap gap-3 items-center">
              <select
                  value={supplierFilter}
                  onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-w-[160px]"
                >
                  <option value="">All Suppliers</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>

              <select
                  value={purchaseCategoryFilter}
                  onChange={e => { setPurchaseCategoryFilter(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-w-[140px]"
                >
                  <option value="">All Categories</option>
                  {PURCHASE_CATEGORIES_QP.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

              <input
                  type="date"
                  value={fromDate}
                  onChange={e => { setFromDate(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />

              <input
                  type="date"
                  value={toDate}
                  onChange={e => { setToDate(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />

              <div className="relative flex-1 min-w-[180px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Invoice, GRN, vendor…"
                    className="w-full pl-7 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>

              <div className="flex gap-2">
                <button
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  Reset
                </button>
                <button
                  onClick={() => setPage(1)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Table (B5) */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Status', 'Purchase Date', 'Category', 'Supplier', 'Invoice No', 'Invoice Date', 'Due Date', 'GRN No', 'Total', 'Actions'].map((h, i) => (
                      <th key={i} className={`px-3 py-2.5 text-[10px] font-extrabold text-gray-600 uppercase tracking-widest bg-gray-50/70 whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <FileText size={32} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-sm text-gray-400">No records found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        onClick={() => setDetailRow(row)}
                        className={`cursor-pointer border-l-4 ${STATUS_BORDER[row.grnStatus] ?? 'border-l-gray-200'} border-b border-gray-50 hover:bg-blue-50/30 transition-all duration-150 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-3 py-2.5">
                          <StatusBadge status={row.grnStatus} />
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                          {fmtDate(row.grnDate ?? row.invoiceDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.purchaseCategory
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700">{row.purchaseCategory}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[140px] truncate text-xs">
                          {row.vendorName || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {row.invoiceNumber}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                          {fmtDate(row.invoiceDate)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                          {fmtDate(row.dueDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.grnStatus === 'GRNNotGenerated' || !row.grnNumber
                            ? <span className="text-gray-300 text-xs">—</span>
                            : <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{row.grnNumber}</span>
                          }
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 font-semibold whitespace-nowrap text-xs">
                          {fmtINR(row.totalAmount)}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <ActionButtons
                            row={row}
                            onEdit={handleEdit}
                            onGenerateGrn={handleGenerateGrn}
                            onSubmitInvoice={handleSubmitInvoice}
                            onCancelGrn={handleCancelGrn}
                            onCancelInvoice={handleCancelInvoice}
                            onPrimaryApproval={handlePrimaryApproval}
                            onFinalApproval={handleFinalApproval}
                            onPrint={handlePrint}
                            onViewDetails={handleViewDetails}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (B10) */}
            {!loading && totalFiltered > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Showing {showingFrom} to {showingTo} of {totalFiltered} entries
                  </span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white focus:outline-none"
                  >
                    {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft size={12} /> Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                    const p = totalPages <= 5 ? i + 1 : start + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${
                          p === safePage
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editRow && (
        <EditInvoiceModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={load}
        />
      )}

      {printRow && (
        <PrintGrnModal
          row={printRow}
          onClose={() => setPrintRow(null)}
        />
      )}

      {detailRow && (
        <GrnDetailsModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onPrint={r => { setDetailRow(null); setPrintRow(r); }}
        />
      )}

      {/* Invoice Detail Drawer */}
      <InvoiceDetailDrawer
        invoice={invoiceDrawerInv}
        onClose={() => setInvoiceDrawerInv(null)}
        onActionComplete={() => { setInvoiceDrawerInv(null); load(); }}
      />

      {/* Confirm dialog (B7) */}
      <ConfirmationDialog
        isOpen={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.subtitle ?? ''}
        variant={confirm?.variant ?? 'info'}
        confirmText={isProcessing ? 'Processing…' : 'Yes, proceed'}
        cancelText="No, keep it"
        onConfirm={execConfirm}
        onClose={() => { if (!isProcessing) setConfirm(null); }}
      />
    </div>
  );
}

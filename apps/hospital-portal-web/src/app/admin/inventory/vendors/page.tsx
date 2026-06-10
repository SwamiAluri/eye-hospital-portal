'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, RefreshCw, Search, Building2, X, Edit2,
  ToggleLeft, ToggleRight, Star, AlertTriangle, Eye,
  Phone, Mail, Globe, MapPin, CreditCard, Shield,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  inventoryVendorApi,
  VendorDto,
  CreateVendorRequest,
} from '@/lib/api/inventory-service.api';
import {
  creditDaysFromPaymentTermLabel,
  usePaymentTerms,
  useVendorCategories,
  vendorCategoryMeta,
} from '@/hooks/use-inventory-masters';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'All',      label: 'All',      dot: 'bg-slate-400', activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'active',   label: 'Active',   dot: 'bg-green-400', activeClass: 'bg-green-600 border-green-600 text-white' },
  { key: 'inactive', label: 'Inactive', dot: 'bg-gray-400',  activeClass: 'bg-gray-600 border-gray-600 text-white' },
];

const CATEGORIES = [
  { value: 'pharmaceutical',  label: 'Pharma',          color: 'bg-blue-100 text-blue-700'   },
  { value: 'iol_optical',     label: 'IOL / Optical',   color: 'bg-purple-100 text-purple-700' },
  { value: 'surgical',        label: 'Surgical',        color: 'bg-red-100 text-red-700'     },
  { value: 'cold_chain',      label: 'Cold Chain',      color: 'bg-cyan-100 text-cyan-700'   },
  { value: 'general_supplies',label: 'General Supplies', color: 'bg-amber-100 text-amber-700' },
  { value: 'general_stores',  label: 'General Stores',  color: 'bg-orange-100 text-orange-700' },
  { value: 'general',         label: 'General',         color: 'bg-gray-100 text-gray-600'   },
];

const BANK_ACCOUNT_TYPES = [
  { value: 'current', label: 'Current' },
  { value: 'savings', label: 'Savings' },
  { value: 'cc',      label: 'Cash Credit' },
  { value: 'od',      label: 'Overdraft' },
];


function daysUntilExpiry(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ComplianceBadge({ vendor }: { vendor: VendorDto }) {
  const dates = [
    vendor.drugLicenseExpiry,
    vendor.drugLicense20BExpiry,
    vendor.drugLicense21BExpiry,
  ];
  const minDays = dates
    .map(d => daysUntilExpiry(d))
    .filter((d): d is number => d !== null)
    .reduce((min, d) => Math.min(min, d), Infinity);

  if (!isFinite(minDays)) return null;
  if (minDays < 0)
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" /> Expired</span>;
  if (minDays <= 60)
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3" /> {minDays}d</span>;
  return null;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>{[160, 90, 110, 100, 90, 80, 70].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: w }} />
      </td>
    ))}</tr>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 pb-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── VendorDetailModal ──────────────────────────────────────────────────────────

function VendorDetailModal({ vendor, onClose, onEdit }: {
  vendor: VendorDto; onClose: () => void; onEdit: () => void;
}) {
  const { categories } = useVendorCategories();
  const cat = vendorCategoryMeta(vendor.vendorCategory, categories);
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : null;

  // A single field: label + value. Skips null/empty. Supports link + mono variants.
  const F = ({
    label, value, mono, link, span2,
  }: {
    label: string;
    value?: string | number | null;
    mono?: boolean;
    link?: boolean;
    span2?: boolean;
  }) => {
    if (value == null || value === '') return null;
    return (
      <div className={span2 ? 'col-span-2' : ''}>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        {link ? (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all"
          >{String(value)}</a>
        ) : (
          <p className={`text-sm text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
        )}
      </div>
    );
  };

  const hasContact  = vendor.contactPerson || vendor.phone || vendor.email || vendor.website;
  const hasAddress  = vendor.address || vendor.registeredAddress;
  const hasTax      = vendor.gstNumber || vendor.panNumber || vendor.cinNumber
                      || vendor.importExportCode || vendor.apmcRegistration || vendor.foodLicenseNumber;
  const hasDL       = vendor.drugLicenseNumber || vendor.drugLicense20B || vendor.drugLicense21B;
  const hasBanking  = vendor.bankAccountHolderName || vendor.bankName
                      || vendor.bankIfscCode || vendor.bankAccountNumber;

  const SectionHead = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <h4 className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
      {icon}{title}
    </h4>
  );

  return (
    <Modal title="Vendor Details" onClose={onClose} wide>
      <div className="max-h-[82vh] overflow-y-auto">
        <div className="p-6 space-y-5">

          {/* ── Identity ── */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-gray-900 break-words">{vendor.name}</h3>
                {vendor.isPreferred && <Star className="w-5 h-5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                <ComplianceBadge vendor={vendor} />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
                {vendor.vendorCode && (
                  <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {vendor.vendorCode}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {vendor.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                {vendor.isColdChainVendor && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">❄ Cold Chain</span>
                )}
              </div>
            </div>
            <button
              onClick={onEdit}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>

          <div className="h-px bg-gray-100" />

          {/* ── Contact ── */}
          {hasContact && (
            <section>
              <SectionHead icon={<Phone className="w-3.5 h-3.5" />} title="Contact" />
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <F label="Contact Person" value={vendor.contactPerson} />
                <F label="Phone" value={vendor.phone} />
                <F label="Email" value={vendor.email} />
                <F label="Website" value={vendor.website} link />
              </div>
            </section>
          )}

          {/* ── Addresses ── */}
          {hasAddress && (
            <section>
              <SectionHead icon={<MapPin className="w-3.5 h-3.5" />} title="Addresses" />
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Operational Address" value={vendor.address} />
                <F label="Registered Address (as per GST)" value={vendor.registeredAddress} />
              </div>
            </section>
          )}

          {/* ── Tax & Registrations ── */}
          {hasTax && (
            <section>
              <SectionHead icon={<Shield className="w-3.5 h-3.5" />} title="Tax & Registrations" />
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <F label="GSTIN"                  value={vendor.gstNumber}        mono />
                <F label="PAN"                    value={vendor.panNumber}        mono />
                <F label="CIN"                    value={vendor.cinNumber}        mono />
                <F label="Import / Export (IEC)"  value={vendor.importExportCode} mono />
                <F label="APMC Registration"      value={vendor.apmcRegistration} mono />
                <F label="Food Licence No."       value={vendor.foodLicenseNumber} mono />
              </div>
            </section>
          )}

          {/* ── Drug Licences ── */}
          {hasDL && (
            <section>
              <SectionHead icon={<Shield className="w-3.5 h-3.5" />} title="Drug Licences" />
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                {vendor.drugLicenseNumber && (
                  <div className="pb-3 sm:pb-0 sm:pr-4 space-y-3">
                    <F label="Drug Licence No." value={vendor.drugLicenseNumber} mono />
                    <F label="Expiry" value={fmtDate(vendor.drugLicenseExpiry)} />
                  </div>
                )}
                {vendor.drugLicense20B && (
                  <div className="py-3 sm:py-0 sm:px-4 space-y-3">
                    <F label="Form 20-B Licence" value={vendor.drugLicense20B} mono />
                    <F label="20-B Expiry" value={fmtDate(vendor.drugLicense20BExpiry)} />
                  </div>
                )}
                {vendor.drugLicense21B && (
                  <div className="pt-3 sm:pt-0 sm:pl-4 space-y-3">
                    <F label="Form 21-B Licence" value={vendor.drugLicense21B} mono />
                    <F label="21-B Expiry" value={fmtDate(vendor.drugLicense21BExpiry)} />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Banking + Terms (side-by-side) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {hasBanking && (
              <section>
                <SectionHead icon={<CreditCard className="w-3.5 h-3.5" />} title="Banking" />
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
                  <F label="Account Holder"  value={vendor.bankAccountHolderName} />
                  <F label="Bank Name"       value={vendor.bankName} />
                  <F label="Account No."     value={vendor.bankAccountNumber} mono />
                  <F label="Account Type"    value={
                    BANK_ACCOUNT_TYPES.find(t => t.value === vendor.bankAccountType)?.label
                    ?? vendor.bankAccountType
                  } />
                  <F label="IFSC Code"       value={vendor.bankIfscCode}  mono />
                  <F label="SWIFT / BIC"     value={vendor.swiftCode}     mono />
                </div>
              </section>
            )}
            <section>
              <SectionHead icon={<MapPin className="w-3.5 h-3.5" />} title="Terms & Outstanding" />
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
                <F label="Credit Days"       value={vendor.creditDays != null ? `${vendor.creditDays} days` : null} />
                <F label="Late Payment Rate" value={vendor.latePaymentInterestRate != null
                  ? `${vendor.latePaymentInterestRate}% p.a.` : null} />
                <div className="col-span-2">
                  <F
                    label="Outstanding Balance"
                    value={`₹${(vendor.outstandingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  />
                </div>
              </div>
            </section>
          </div>

        </div>
      </div>
    </Modal>
  );
}

// ── VendorFormModal (4-tab) ────────────────────────────────────────────────────

const TABS = [
  { id: 'basic',      label: 'Basic Info' },
  { id: 'contact',    label: 'Contact & Address' },
  { id: 'compliance', label: 'Compliance & Licences' },
  { id: 'banking',    label: 'Banking & Terms' },
];

const BLANK: CreateVendorRequest = {
  name: '',
  vendorCategory: 'general',
  isPreferred: false,
  isColdChainVendor: false,
  bankAccountType: 'current',
  creditDays: 30,
};

function buildInitial(v: VendorDto): CreateVendorRequest {
  return {
    name:                   v.name,
    vendorCode:             v.vendorCode,
    vendorCategory:         v.vendorCategory,
    isPreferred:            v.isPreferred,
    contactPerson:          v.contactPerson,
    phone:                  v.phone,
    email:                  v.email,
    address:                v.address,
    registeredAddress:      v.registeredAddress,
    website:                v.website,
    gstNumber:              v.gstNumber,
    panNumber:              v.panNumber,
    cinNumber:              v.cinNumber,
    drugLicenseNumber:      v.drugLicenseNumber,
    drugLicenseExpiry:      v.drugLicenseExpiry ? v.drugLicenseExpiry.slice(0, 10) : undefined,
    drugLicense20B:         v.drugLicense20B,
    drugLicense20BExpiry:   v.drugLicense20BExpiry ? v.drugLicense20BExpiry.slice(0, 10) : undefined,
    drugLicense21B:         v.drugLicense21B,
    drugLicense21BExpiry:   v.drugLicense21BExpiry ? v.drugLicense21BExpiry.slice(0, 10) : undefined,
    apmcRegistration:       v.apmcRegistration,
    foodLicenseNumber:      v.foodLicenseNumber,
    importExportCode:       v.importExportCode,
    swiftCode:              v.swiftCode,
    latePaymentInterestRate: v.latePaymentInterestRate,
    isColdChainVendor:      v.isColdChainVendor,
    bankName:               v.bankName,
    bankAccountNumber:      v.bankAccountNumber,
    bankIfscCode:           v.bankIfscCode,
    bankAccountHolderName:  v.bankAccountHolderName,
    bankAccountType:        v.bankAccountType,
    creditDays:             v.creditDays,
    status:                 v.status,
  };
}

function VendorFormModal({ initial, onClose, onSaved }: {
  initial?: VendorDto; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateVendorRequest>(initial ? buildInitial(initial) : { ...BLANK });
  const [tab, setTab] = useState('basic');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof CreateVendorRequest>(k: K, val: CreateVendorRequest[K]) =>
    setForm(f => ({ ...f, [k]: val }));

  const txt = (label: string, k: keyof CreateVendorRequest, req = false, readOnly = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        value={(form[k] as string) ?? ''}
        onChange={e => set(k, e.target.value as any)}
        readOnly={readOnly}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
          ${readOnly ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300'}`}
      />
    </div>
  );

  const dateField = (label: string, k: keyof CreateVendorRequest) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        value={(form[k] as string) ?? ''}
        onChange={e => set(k, e.target.value as any)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  const submit = async () => {
    if (!form.name.trim()) { setError('Vendor name is required.'); setTab('basic'); return; }
    setBusy(true); setError('');
    try {
      if (initial) await inventoryVendorApi.update(initial.id, form as any);
      else await inventoryVendorApi.create(form);
      onSaved();
    } catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? `Edit — ${initial.name}` : 'New Vendor'} onClose={onClose} wide>
      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
              ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 min-h-[320px]">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Tab 1 — Basic Info */}
        {tab === 'basic' && (
          <div className="grid grid-cols-2 gap-4">
            {txt('Vendor Name', 'name', true)}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Code <span className="text-gray-400 font-normal">(auto-generated)</span></label>
              <input value={form.vendorCode ?? ''} readOnly
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
              <select value={form.vendorCategory} onChange={e => set('vendorCategory', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status ?? 'active'} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isPreferred} onChange={e => set('isPreferred', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400" /> Mark as Preferred Vendor
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isColdChainVendor} onChange={e => set('isColdChainVendor', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <span className="text-sm text-gray-700">Cold Chain Vendor</span>
              </label>
            </div>
          </div>
        )}

        {/* Tab 2 — Contact & Address */}
        {tab === 'contact' && (
          <div className="grid grid-cols-2 gap-4">
            {txt('Contact Person', 'contactPerson')}
            {txt('Phone', 'phone')}
            {txt('Email', 'email')}
            {txt('Website', 'website')}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Operational Address</label>
              <textarea value={form.address ?? ''} onChange={e => set('address', e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Registered Address <span className="text-gray-400 font-normal">(as per GST)</span></label>
              <textarea value={form.registeredAddress ?? ''} onChange={e => set('registeredAddress', e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        )}

        {/* Tab 3 — Compliance & Licences */}
        {tab === 'compliance' && (
          <div className="grid grid-cols-2 gap-4">
            {txt('GSTIN', 'gstNumber')}
            {txt('PAN Number', 'panNumber')}
            {txt('CIN Number', 'cinNumber')}
            {txt('Drug Licence No.', 'drugLicenseNumber')}
            {dateField('Drug Licence Expiry', 'drugLicenseExpiry')}
            <div />{/* spacer */}
            {txt('Form 20-B Licence', 'drugLicense20B')}
            {dateField('20-B Expiry', 'drugLicense20BExpiry')}
            {txt('Form 21-B Licence', 'drugLicense21B')}
            {dateField('21-B Expiry', 'drugLicense21BExpiry')}
            {txt('APMC Registration', 'apmcRegistration')}
            {txt('Food Licence No.', 'foodLicenseNumber')}
            {txt('Import / Export Code (IEC)', 'importExportCode')}
          </div>
        )}

        {/* Tab 4 — Banking & Terms */}
        {tab === 'banking' && (
          <div className="grid grid-cols-2 gap-4">
            {txt('Account Holder Name', 'bankAccountHolderName')}
            {txt('Bank Name', 'bankName')}
            {txt('Account Number', 'bankAccountNumber')}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
              <select value={form.bankAccountType} onChange={e => set('bankAccountType', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {BANK_ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {txt('IFSC Code', 'bankIfscCode')}
            {txt('SWIFT / BIC Code', 'swiftCode')}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms</label>
              <select
                value=""
                onChange={(e) => {
                  const label = e.target.selectedOptions[0]?.text ?? '';
                  const days = creditDaysFromPaymentTermLabel(label);
                  if (days != null) set('creditDays', days);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Apply preset…</option>
                {paymentTerms.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credit Days</label>
              <input type="number" min={0} value={form.creditDays ?? 30}
                onChange={e => set('creditDays', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Late Payment Interest <span className="text-gray-400 font-normal">(% p.a.)</span></label>
              <input type="number" step="0.01" min={0} value={form.latePaymentInterestRate ?? ''}
                onChange={e => set('latePaymentInterestRate', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {busy ? 'Saving…' : initial ? 'Update Vendor' : 'Create Vendor'}
        </button>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { categories } = useVendorCategories();
  const [rows, setRows] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'view' | 'edit'>(null);
  const [activeVendor, setActiveVendor] = useState<VendorDto | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await inventoryVendorApi.list(1, 200); setRows(d.items ?? []); }
    catch (err: any) { setError(err?.response?.data ?? err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusTab !== 'All') r = r.filter(v => statusTab === 'active' ? v.status === 'active' : v.status !== 'active');
    if (categoryFilter) r = r.filter(v => v.vendorCategory === categoryFilter);
    if (search) r = r.filter(v =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.vendorCode ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (v.contactPerson ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return r;
  }, [rows, statusTab, categoryFilter, search]);

  const toggleStatus = async (v: VendorDto) => {
    const newStatus = v.status === 'active' ? 'inactive' : 'active';
    setActing(v.id);
    try {
      await inventoryVendorApi.update(v.id, { ...buildInitial(v), status: newStatus } as any);
      toast.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (err: any) { toast.error(err?.response?.data ?? 'Status change failed.'); }
    finally { setActing(null); }
  };

  const openView = (v: VendorDto) => { setActiveVendor(v); setModal('view'); };
  const openEdit = (v: VendorDto) => { setActiveVendor(v); setModal('edit'); };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supplier accounts and compliance documents</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Vendor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatusTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors
              ${statusTab === t.key ? t.activeClass : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-full px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, contact…"
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={load} className="text-red-700 text-xs underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vendor', 'Code', 'Category', 'Contact', 'GSTIN', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) :
             filtered.length === 0 ? (
               <tr><td colSpan={7} className="px-4 py-16 text-center">
                 <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                 <p className="text-gray-400 text-sm">No vendors found</p>
               </td></tr>
             ) : filtered.map(r => {
               const cat = vendorCategoryMeta(r.vendorCategory, categories);
               return (
                 <tr key={r.id} className={`border-l-4 ${r.status === 'active' ? 'border-l-green-400' : 'border-l-gray-200'} hover:bg-gray-50 transition-colors`}>
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-1.5">
                       <span className="font-medium text-gray-900">{r.name}</span>
                       {r.isPreferred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                       <ComplianceBadge vendor={r} />
                     </div>
                   </td>
                   <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.vendorCode ?? '—'}</td>
                   <td className="px-4 py-3">
                     <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
                   </td>
                   <td className="px-4 py-3 text-gray-600 text-xs">{r.contactPerson ?? '—'}</td>
                   <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.gstNumber ?? '—'}</td>
                   <td className="px-4 py-3">
                     <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                       {r.status === 'active' ? 'Active' : 'Inactive'}
                     </span>
                   </td>
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-1">
                       <button onClick={() => openView(r)} title="View Details"
                         className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                         <Eye className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => openEdit(r)} title="Edit"
                         className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                         <Edit2 className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => toggleStatus(r)} disabled={acting === r.id}
                         title={r.status === 'active' ? 'Deactivate' : 'Activate'}
                         className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                         {r.status === 'active'
                           ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                           : <ToggleLeft className="w-3.5 h-3.5" />}
                       </button>
                     </div>
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <VendorFormModal
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); toast.success('Vendor created!'); }}
        />
      )}
      {modal === 'edit' && activeVendor && (
        <VendorFormModal
          initial={activeVendor}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); toast.success('Vendor updated!'); }}
        />
      )}
      {modal === 'view' && activeVendor && (
        <VendorDetailModal
          vendor={activeVendor}
          onClose={() => setModal(null)}
          onEdit={() => { setModal('edit'); }}
        />
      )}
    </div>
  );
}


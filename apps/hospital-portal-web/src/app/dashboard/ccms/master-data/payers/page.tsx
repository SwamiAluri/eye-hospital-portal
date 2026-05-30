'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  listInsurancePayers,
  createInsurancePayer,
  updateInsurancePayer,
  deleteInsurancePayer,
  type InsurancePayer,
  type CreatePayerRequest,
  type PayerCategory,
} from '@/lib/api/ccms/ccms-master-data.api';
import {
  RefreshCw, Plus, Search, Edit2, Trash2, ChevronRight, Building2, X,
  ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ── Form helpers ──────────────────────────────────────────────────────────────

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white placeholder:text-gray-300 disabled:bg-gray-50 ${props.className ?? ''}`}
    />
  );
}

function emptyForm(): CreatePayerRequest {
  return {
    name: '',
    payerCategory: 'insurance',
    serviceTaxApplicable: false,
    tdsMandatory: false,
    defaultServiceTaxPercent: 0,
  };
}

function payerToForm(p: InsurancePayer): CreatePayerRequest {
  return {
    name:                       p.name,
    shortCode:                  p.shortCode,
    contactEmail:               p.contactEmail,
    contactPhone:               p.contactPhone,
    portalUrl:                  p.portalUrl,
    payerCategory:              p.payerCategory ?? 'insurance',
    debtorSubtype:              p.debtorSubtype,
    creditLimit:                p.creditLimit,
    exportCode:                 p.exportCode,
    hospitalIdentifier:         p.hospitalIdentifier,
    serviceTaxApplicable:       p.serviceTaxApplicable ?? false,
    defaultServiceTaxPercent:   p.defaultServiceTaxPercent ?? 0,
    tdsMandatory:               p.tdsMandatory ?? false,
    validFrom:                  p.validFrom,
    validTo:                    p.validTo,
    formatCode:                 p.formatCode,
  };
}

// ── Payer list item ───────────────────────────────────────────────────────────

function PayerListItem({
  payer,
  isSelected,
  onSelect,
}: {
  payer: InsurancePayer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isInsurance = (payer.payerCategory ?? 'insurance') !== 'other_debtor';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-3 rounded-xl border flex items-center gap-3 transition-all ${
        isSelected
          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-gray-50/80'
      }`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isInsurance ? 'bg-blue-50' : 'bg-violet-50'
      }`}>
        {isInsurance
          ? <ShieldCheck className="w-4 h-4 text-blue-500" />
          : <Building2 className="w-4 h-4 text-violet-500" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{payer.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {payer.shortCode ? `${payer.shortCode} · ` : ''}
          {isInsurance ? 'Insurer' : 'Other Debtor'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
          payer.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>{payer.status ?? 'active'}</span>
        <ChevronRight className={`w-3 h-3 transition-colors ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`} />
      </div>
    </button>
  );
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl px-6 py-5 max-w-sm w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Remove payer?</p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">{name}</span> will be soft-deleted and removed from payer lists.
              Existing cases referencing it are not affected.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CcmsMasterDataPayersPage() {
  const [payers,      setPayers]      = useState<InsurancePayer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState<PayerCategory | 'all'>('all');

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [isNew,       setIsNew]       = useState(false);
  const [form,        setForm]        = useState<CreatePayerRequest>(emptyForm());
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listInsurancePayers()
      .then(ps => setPayers(ps))
      .catch(e => setError(e?.message ?? 'Failed to load payers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = payers.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.shortCode?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchCat = catFilter === 'all' || (p.payerCategory ?? 'insurance') === catFilter;
    return matchSearch && matchCat;
  });

  const handleNew = () => {
    setIsNew(true);
    setSelectedId(null);
    setForm(emptyForm());
  };

  const handleSelect = (p: InsurancePayer) => {
    setIsNew(false);
    setSelectedId(p.id);
    setForm(payerToForm(p));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Payer name is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const p = await createInsurancePayer(form);
        setPayers(prev => [p, ...prev]);
        setIsNew(false);
        setSelectedId(p.id);
        toast.success('Payer created');
      } else if (selectedId) {
        const p = await updateInsurancePayer(selectedId, form);
        setPayers(prev => prev.map(pp => pp.id === selectedId ? p : pp));
        toast.success('Payer updated');
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to save payer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteInsurancePayer(deleteId);
      setPayers(prev => prev.filter(p => p.id !== deleteId));
      if (selectedId === deleteId) { setSelectedId(null); setIsNew(false); }
      toast.success('Payer removed');
    } catch {
      toast.error('Failed to delete payer');
    } finally {
      setDeleteId(null);
    }
  };

  const patch = (key: keyof CreatePayerRequest, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const showForm = isNew || selectedId != null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            Payer Master
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Insurance companies, TPAs &amp; other debtors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Payer
          </button>
        </div>
      </div>

      {/* Error banner */}
        {error && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-6 py-2.5 text-xs text-red-700 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          <button onClick={load} className="ml-2 underline hover:no-underline">Retry</button>
          </div>
        )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex">

        {/* ── Left column: list ──────────────────────────────────────── */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
          {/* Search + filter */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search payers…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {(['all', 'insurance', 'other_debtor'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                    catFilter === c
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c === 'all' ? 'All' : c === 'insurance' ? 'Insurers' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-xs font-semibold text-gray-400">No payers found</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Try a different search or filter.</p>
              </div>
            ) : (
              filtered.map(p => (
                <PayerListItem
                  key={p.id}
                  payer={p}
                  isSelected={!isNew && selectedId === p.id}
                  onSelect={() => handleSelect(p)}
                />
              ))
            )}
          </div>

          <div className="px-3 pb-3 pt-1 text-[10px] text-gray-400 border-t border-gray-100">
            {filtered.length} of {payers.length} payers
          </div>
        </div>

        {/* ── Right column: detail / form ────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!showForm ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">Select a payer to view or edit</p>
              <p className="text-xs text-gray-400 mt-1">Or click <strong>Add Payer</strong> to create a new entry.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-6 space-y-6">

              {/* Header row */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {isNew ? 'New Payer' : form.name}
                </h2>
                {!isNew && selectedId && (
                  <button
                    onClick={() => setDeleteId(selectedId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>

              {/* ── Section: Core ─────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" />Identity
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>Payer Name</Label>
                    <Input value={form.name} onChange={e => patch('name', e.target.value)} placeholder="e.g. Star Health Insurance" />
                  </div>
                  <div>
                    <Label>Short Code</Label>
                    <Input value={form.shortCode ?? ''} onChange={e => patch('shortCode', e.target.value)} placeholder="e.g. STAR" />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select
                      value={form.payerCategory ?? 'insurance'}
                      onChange={e => patch('payerCategory', e.target.value as PayerCategory)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 bg-white"
                    >
                      <option value="insurance">Insurance</option>
                      <option value="other_debtor">Other Debtor</option>
                    </select>
                  </div>
                  {form.payerCategory === 'other_debtor' && (
                    <div>
                      <Label>Debtor Sub-type</Label>
                      <select
                        value={form.debtorSubtype ?? ''}
                        onChange={e => patch('debtorSubtype', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 bg-white"
                      >
                        <option value="">— select —</option>
                        <option value="corporate">Corporate / Employer</option>
                        <option value="government">Government</option>
                        <option value="individual">Individual</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Export Code</Label>
                    <Input value={form.exportCode ?? ''} onChange={e => patch('exportCode', e.target.value)} placeholder="For billing export" />
                  </div>
                  <div>
                    <Label>Hospital Identifier</Label>
                    <Input value={form.hospitalIdentifier ?? ''} onChange={e => patch('hospitalIdentifier', e.target.value)} placeholder="Our empanelment ID" />
                  </div>
                  <div>
                    <Label>Format Code</Label>
                    <Input value={form.formatCode ?? ''} onChange={e => patch('formatCode', e.target.value)} placeholder="Correspondence format" />
                  </div>
                  <div>
                    <Label>Credit Limit (₹)</Label>
                    <Input type="number" value={form.creditLimit ?? ''} onChange={e => patch('creditLimit', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" />
                  </div>
                </div>
              </section>

              {/* ── Section: Contact ──────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.contactEmail ?? ''} onChange={e => patch('contactEmail', e.target.value)} placeholder="claims@insurer.com" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.contactPhone ?? ''} onChange={e => patch('contactPhone', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Portal URL</Label>
                    <Input value={form.portalUrl ?? ''} onChange={e => patch('portalUrl', e.target.value)} placeholder="https://tpa-portal.example.com" />
                  </div>
                </div>
              </section>

              {/* ── Section: Finance ──────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Finance & Tax</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.serviceTaxApplicable ?? false}
                        onChange={e => patch('serviceTaxApplicable', e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-400"
                      />
                      Service tax applicable
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.tdsMandatory ?? false}
                        onChange={e => patch('tdsMandatory', e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-400"
                      />
                      TDS mandatory
                    </label>
                  </div>
                  {form.serviceTaxApplicable && (
                    <div>
                      <Label>Default Service Tax %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={form.defaultServiceTaxPercent ?? 0}
                        onChange={e => patch('defaultServiceTaxPercent', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* ── Section: Validity ─────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Validity Period</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valid From</Label>
                    <Input type="date" value={form.validFrom ?? ''} onChange={e => patch('validFrom', e.target.value)} />
                  </div>
                  <div>
                    <Label>Valid To</Label>
                    <Input type="date" value={form.validTo ?? ''} onChange={e => patch('validTo', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Save button */}
              <div className="flex justify-end gap-3 pb-6">
                {isNew && (
                  <button
                    onClick={() => { setIsNew(false); setSelectedId(null); }}
                    className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !form.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : isNew ? 'Create Payer' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmDeleteModal
          name={payers.find(p => p.id === deleteId)?.name ?? ''}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  flattenCatalog,
  priceSuffix,
  serviceCatalogApi,
  type FlatVariantDto,
  type IolMasterDto,
} from '@/lib/api/service-catalog.api';
import { buildInvestigationCatalogFromServiceCatalog } from '@/lib/counsellors-desk/investigation-catalog';
import { computePackagePreview, formatInr } from '@/lib/counsellors-desk/package-preview';
import {
  useCreateCounsellingPackage,
  useUpdateCounsellingPackage,
} from '@/hooks/use-counselling-packages';
import type {
  CounsellingPackageTemplate,
  CreateCounsellingPackageTemplateRequest,
} from '@/types/counselling-estimate';
import type { MasterCatalogItem } from '@/types/counsellors-desk';
import { Search } from 'lucide-react';

const PACKAGE_CATEGORIES = [
  'Cataract',
  'Retina',
  'Glaucoma',
  'Cornea',
  'Refractive',
  'LASIK',
  'Other',
] as const;

const EXCLUDED_PROCEDURE_CATEGORIES = new Set(['DIAGNOSTICS', 'INVESTIGATIONS']);

type FormState = {
  code: string;
  name: string;
  description: string;
  category: string;
  packageAmount: string;
  defaultEye: 'RE' | 'LE' | 'BE';
  variantSubOption: string;
  procedureVariantId: string;
  iolId: string;
  investigationIds: string[];
  maxDiscountPercent: string;
  legacyMasterCode: string;
  isDefault: boolean;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  category: 'Cataract',
  packageAmount: '',
  defaultEye: 'RE',
  variantSubOption: '',
  procedureVariantId: '',
  iolId: '',
  investigationIds: [],
  maxDiscountPercent: '50',
  legacyMasterCode: '',
  isDefault: false,
  sortOrder: '0',
  isActive: true,
};

function templateToForm(t: CounsellingPackageTemplate): FormState {
  return {
    code: t.code,
    name: t.name,
    description: t.description ?? '',
    category: t.category ?? 'Other',
    packageAmount: String(t.packageAmount),
    defaultEye: t.defaultEye,
    variantSubOption: t.variantSubOption ?? '',
    procedureVariantId: t.procedureVariantId ?? '',
    iolId: t.iolId ?? '',
    investigationIds: [...(t.investigationIds ?? [])],
    maxDiscountPercent: String(t.maxDiscountPercent ?? 50),
    legacyMasterCode: t.legacyMasterCode ?? '',
    isDefault: t.isDefault,
    sortOrder: String(t.sortOrder ?? 0),
    isActive: t.isActive,
  };
}

interface CounsellingPackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CounsellingPackageTemplate | null;
  onSaved: () => void;
}

export function CounsellingPackageFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: CounsellingPackageFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [procSearch, setProcSearch] = useState('');
  const [invSearch, setInvSearch] = useState('');

  const createMutation = useCreateCounsellingPackage();
  const updateMutation = useUpdateCounsellingPackage();

  const catalogQuery = useQuery({
    queryKey: ['service-catalog', 'package-builder'],
    queryFn: () => serviceCatalogApi.getFullCatalog(),
    staleTime: 120_000,
    enabled: open,
  });

  const procedures = useMemo(() => {
    if (!catalogQuery.data) return [] as FlatVariantDto[];
    return flattenCatalog(catalogQuery.data).filter(
      (v) => v.isActive !== false && !EXCLUDED_PROCEDURE_CATEGORIES.has(v.categoryCode),
    );
  }, [catalogQuery.data]);

  const investigations = useMemo(() => {
    if (!catalogQuery.data) return [] as MasterCatalogItem[];
    const { imaging, scan, lab } = buildInvestigationCatalogFromServiceCatalog(catalogQuery.data);
    return [...imaging, ...scan, ...lab];
  }, [catalogQuery.data]);

  const selectedProcedure = useMemo(
    () => procedures.find((p) => p.id === form.procedureVariantId) ?? null,
    [procedures, form.procedureVariantId],
  );

  const iolQuery = useQuery({
    queryKey: ['variant-iol', form.procedureVariantId],
    queryFn: () => serviceCatalogApi.getVariantIolOptions(form.procedureVariantId),
    enabled: open && !!form.procedureVariantId && !!selectedProcedure?.hasIolOptions,
    staleTime: 60_000,
  });

  const iolOptions = iolQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    setForm(editing ? templateToForm(editing) : EMPTY_FORM);
    setProcSearch('');
    setInvSearch('');
  }, [open, editing]);

  useEffect(() => {
    if (!form.iolId) return;
    if (!iolOptions.some((i) => i.id === form.iolId)) {
      setForm((f) => ({ ...f, iolId: '' }));
    }
  }, [form.iolId, iolOptions]);

  const filteredProcedures = useMemo(() => {
    const q = procSearch.trim().toLowerCase();
    if (!q) return procedures.slice(0, 80);
    return procedures
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [procedures, procSearch]);

  const filteredInvestigations = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    if (!q) return investigations;
    return investigations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q),
    );
  }, [investigations, invSearch]);

  const invByCategory = useMemo(() => {
    const grouped: Record<string, MasterCatalogItem[]> = {};
    filteredInvestigations.forEach((item) => {
      const cat = item.category ?? 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [filteredInvestigations]);

  const selectedIol = iolOptions.find((i) => i.id === form.iolId) ?? null;
  const selectedInvestigations = investigations.filter((i) =>
    form.investigationIds.includes(i.id),
  );

  const preview = computePackagePreview({
    packageAmount: Number(form.packageAmount) || 0,
    procedure: selectedProcedure,
    iol: selectedIol,
    investigations: selectedInvestigations,
    defaultEye: form.defaultEye,
  });

  const toggleInvestigation = (id: string) => {
    setForm((f) => ({
      ...f,
      investigationIds: f.investigationIds.includes(id)
        ? f.investigationIds.filter((x) => x !== id)
        : [...f.investigationIds, id],
    }));
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name are required.');
      return;
    }
    const amount = Number(form.packageAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid package amount.');
      return;
    }

    const body: CreateCounsellingPackageTemplateRequest = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      packageAmount: amount,
      defaultEye: form.defaultEye,
      variantSubOption: form.variantSubOption.trim() || undefined,
      procedureVariantId: form.procedureVariantId || undefined,
      iolId: form.iolId || undefined,
      investigationIds: form.investigationIds,
      maxDiscountPercent: Number(form.maxDiscountPercent) || 50,
      legacyMasterCode: form.legacyMasterCode.trim() || undefined,
      isDefault: form.isDefault,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, body });
        toast.success('Package updated.');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Package created.');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save package.';
      toast.error(msg);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit counselling package' : 'New counselling package'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
          {/* Left: form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="CAT-ECON"
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Package name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cataract Economy"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Package amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.packageAmount}
                  onChange={(e) => setForm((f) => ({ ...f, packageAmount: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.maxDiscountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscountPercent: e.target.value }))}
                />
              </div>
              <div>
                <Label>Legacy master code</Label>
                <Input
                  value={form.legacyMasterCode}
                  onChange={(e) => setForm((f) => ({ ...f, legacyMasterCode: e.target.value }))}
                  placeholder="PHACO_STD"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default eye</Label>
                <Select
                  value={form.defaultEye}
                  onValueChange={(v) => setForm((f) => ({ ...f, defaultEye: v as 'RE' | 'LE' | 'BE' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RE">RE</SelectItem>
                    <SelectItem value="LE">LE</SelectItem>
                    <SelectItem value="BE">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sub-type (optional)</Label>
                <Input
                  value={form.variantSubOption}
                  onChange={(e) => setForm((f) => ({ ...f, variantSubOption: e.target.value }))}
                />
              </div>
            </div>

            {/* Procedure picker */}
            <div>
              <Label>Procedure (service catalog)</Label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Search procedures…"
                  value={procSearch}
                  onChange={(e) => setProcSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-36 overflow-y-auto border rounded-lg divide-y">
                {filteredProcedures.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      procedureVariantId: p.id,
                      iolId: '',
                      variantSubOption: '',
                    }))}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      form.procedureVariantId === p.id ? 'bg-teal-50 border-l-2 border-teal-500' : ''
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {p.categoryName} · {formatInr(p.price)}{priceSuffix(p.priceType)}
                    </span>
                  </button>
                ))}
                {filteredProcedures.length === 0 && (
                  <p className="text-xs text-gray-400 p-3">No procedures match.</p>
                )}
              </div>
            </div>

            {/* IOL */}
            {selectedProcedure?.hasIolOptions && (
              <div>
                <Label>IOL / lens</Label>
                <Select
                  value={form.iolId || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, iolId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select IOL" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {iolOptions.map((iol: IolMasterDto) => (
                      <SelectItem key={iol.id} value={iol.id}>
                        {iol.modelName} · {formatInr(iol.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Investigations */}
            <div>
              <Label>Investigations ({form.investigationIds.length} selected)</Label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Search investigations…"
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                {Object.entries(invByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">{cat}</p>
                    {items.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-gray-50 rounded">
                        <Checkbox
                          checked={form.investigationIds.includes(item.id)}
                          onCheckedChange={() => toggleInvestigation(item.id)}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="text-xs text-gray-500">{formatInr(item.price ?? 0)}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.isDefault}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, isDefault: !!c }))}
                />
                Default for category
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: !!c }))}
                />
                Active
              </label>
            </div>
          </div>

          {/* Right: preview */}
          <div className="bg-slate-50 border rounded-xl p-4 space-y-3 h-fit">
            <h4 className="text-sm font-semibold text-slate-800">Package preview</h4>
            {preview.lines.length === 0 ? (
              <p className="text-xs text-slate-500">Link a procedure or investigations to see itemized totals.</p>
            ) : (
              <div className="space-y-1.5">
                {preview.lines.map((line) => (
                  <div key={line.key} className="flex justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 truncate block">{line.label}</span>
                      {line.detail && <span className="text-xs text-slate-500">{line.detail}</span>}
                    </div>
                    <span className="font-semibold tabular-nums text-slate-700">{formatInr(line.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Itemized subtotal</span>
                <span className="font-semibold tabular-nums">{formatInr(preview.itemizedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Package amount</span>
                <span className="font-bold tabular-nums text-teal-700">{formatInr(preview.packageAmount)}</span>
              </div>
              {preview.bundleSavings > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Bundle savings</span>
                  <span className="font-semibold tabular-nums">−{formatInr(preview.bundleSavings)}</span>
                </div>
              )}
            </div>
            {preview.packageAmount > 0 && preview.itemizedTotal > preview.packageAmount && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                Patient saves {Math.round((preview.bundleSavings / preview.itemizedTotal) * 100)}%
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Update package' : 'Create package'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

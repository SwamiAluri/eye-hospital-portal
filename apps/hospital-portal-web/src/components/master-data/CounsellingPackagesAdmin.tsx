'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Settings2, Package } from 'lucide-react';
import {
  useCounsellingPackageTemplates,
  useCounsellingSettings,
  useDeleteCounsellingPackage,
  useUpdateCounsellingSettings,
} from '@/hooks/use-counselling-packages';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import { CounsellingPackageFormDialog } from './CounsellingPackageFormDialog';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function CounsellingPackagesAdmin() {
  const { data: packages = [], isLoading, refetch } = useCounsellingPackageTemplates();
  const { data: settings } = useCounsellingSettings();
  const deleteMutation = useDeleteCounsellingPackage();
  const settingsMutation = useUpdateCounsellingSettings();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CounsellingPackageTemplate | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [maxDiscount, setMaxDiscount] = useState('50');
  const [maxDiscountFlat, setMaxDiscountFlat] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(packages.map((p) => p.category ?? 'Other'));
    return ['all', ...Array.from(cats).sort()];
  }, [packages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((p) => {
      if (categoryFilter !== 'all' && (p.category ?? 'Other') !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [packages, search, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (pkg: CounsellingPackageTemplate) => {
    setEditing(pkg);
    setFormOpen(true);
  };

  const handleDelete = async (pkg: CounsellingPackageTemplate) => {
    if (!window.confirm(`Delete package "${pkg.name}" (${pkg.code})?`)) return;
    try {
      await deleteMutation.mutateAsync(pkg.id);
      toast.success('Package deleted.');
    } catch {
      toast.error('Failed to delete package.');
    }
  };

  const openSettings = () => {
    setMaxDiscount(String(settings?.maxDiscountPercent ?? 50));
    setMaxDiscountFlat(
      settings?.maxDiscountFlat != null && settings.maxDiscountFlat > 0
        ? String(settings.maxDiscountFlat)
        : '',
    );
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const pct = Number(maxDiscount);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a valid discount percentage (0–100).');
      return;
    }
    const flatRaw = maxDiscountFlat.trim();
    let flatCap: number | null = null;
    if (flatRaw !== '') {
      flatCap = Number(flatRaw);
      if (!Number.isFinite(flatCap) || flatCap < 0) {
        toast.error('Enter a valid flat discount cap (₹) or leave blank.');
        return;
      }
    }
    try {
      await settingsMutation.mutateAsync({
        maxDiscountPercent: pct,
        maxDiscountFlat: flatCap,
      });
      toast.success('Counsellor settings updated.');
      setSettingsOpen(false);
    } catch {
      toast.error('Failed to update settings.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-teal-600" />
            Counselling packages
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Configure bundled procedure + IOL + investigation packages for the counsellor desk.
            Package amount is the quoted price; itemized catalog prices show bundle savings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Settings2 size={16} />
            Settings
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus size={16} />
            New package
          </button>
        </div>
      </div>

      {settings && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <Badge variant="outline">Tenant max discount: {settings.maxDiscountPercent}%</Badge>
          {settings.maxDiscountFlat != null && settings.maxDiscountFlat > 0 && (
            <Badge variant="outline">Flat cap: {formatInr(settings.maxDiscountFlat)}</Badge>
          )}
          <Badge variant="outline">{packages.length} packages</Badge>
          <Badge variant="outline">{packages.filter((p) => p.isActive).length} active</Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading packages…</p>
      ) : filtered.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-gray-500">
          <Package size={32} className="mx-auto mb-2 text-gray-300" />
          <p>No packages found. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Linked</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{pkg.code}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{pkg.name}</span>
                    {pkg.isDefault && (
                      <Badge className="ml-2 text-[10px] bg-teal-100 text-teal-800">Default</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{pkg.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatInr(pkg.packageAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {pkg.procedureVariantId && (
                        <Badge variant="outline" className="text-[10px]">Procedure</Badge>
                      )}
                      {pkg.iolId && (
                        <Badge variant="outline" className="text-[10px]">IOL</Badge>
                      )}
                      {(pkg.investigationIds?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {pkg.investigationIds!.length} inv.
                        </Badge>
                      )}
                      {!pkg.procedureVariantId && !pkg.iolId && !(pkg.investigationIds?.length) && (
                        <span className="text-xs text-amber-600">Not linked</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={pkg.isActive ? 'default' : 'secondary'}>
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(pkg)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(pkg)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CounsellingPackageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => void refetch()}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Counsellor desk settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Max discount without manager approval (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Applied to the entire estimate. Counsellors cannot exceed this unless a manager overrides.
              </p>
            </div>
            <div>
              <Label>Max flat discount cap (₹, optional)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="No flat cap"
                value={maxDiscountFlat}
                onChange={(e) => setMaxDiscountFlat(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                When set, the effective cap is the lower of the percent limit and this flat amount.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={settingsMutation.isPending}
              onClick={() => void saveSettings()}
              className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg disabled:opacity-60"
            >
              {settingsMutation.isPending ? 'Saving…' : 'Save settings'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

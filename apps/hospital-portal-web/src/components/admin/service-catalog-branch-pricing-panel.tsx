'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApi } from '@/lib/api';
import {
  serviceCatalogAdminApi,
  type BranchPricingRowDto,
} from '@/lib/api/service-catalog.api';
import {
  INVESTIGATION_CATALOG_FILTER,
  isInvestigationCategoryCode,
  matchesServiceCatalogCategoryFilter,
} from '@/lib/counsellors-desk/investigation-catalog';
import { matchesSurgeryCatalogFilter } from '@/lib/master-data/service-catalog-url';

type BranchOption = { id: string; name: string };

const branchPricingKey = (branchId: string) =>
  ['service-catalog', 'admin', 'branch-pricing', branchId] as const;

type Props = {
  categoryFilter: string;
};

function resolveBranchScope(categoryFilter: string): 'investigations' | 'surgery' | 'all' {
  if (
    categoryFilter === INVESTIGATION_CATALOG_FILTER ||
    categoryFilter === 'DIAGNOSTICS' ||
    categoryFilter === 'INVESTIGATIONS'
  ) {
    return 'investigations';
  }
  if (categoryFilter === 'ALL') return 'all';
  if (isInvestigationCategoryCode(categoryFilter)) return 'investigations';
  return 'surgery';
}

export function ServiceCatalogBranchPricingPanel({ categoryFilter }: Props) {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const scope = resolveBranchScope(categoryFilter);

  const branchesQuery = useQuery({
    queryKey: ['branches', 'catalog-admin'],
    queryFn: async (): Promise<BranchOption[]> => {
      const res = await getApi().get('/branches');
      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      return list.map((b: { id: string; name?: string; branchName?: string }) => ({
        id: b.id,
        name: b.name ?? b.branchName ?? b.id,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!branchId && branchesQuery.data?.length) {
      setBranchId(branchesQuery.data[0].id);
    }
  }, [branchId, branchesQuery.data]);

  const pricingQuery = useQuery({
    queryKey: branchPricingKey(branchId),
    queryFn: () => serviceCatalogAdminApi.getBranchPricingRows(branchId),
    enabled: !!branchId,
    staleTime: 60 * 1000,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = pricingQuery.data ?? [];

    if (scope === 'investigations') {
      data = data.filter((r) =>
        matchesServiceCatalogCategoryFilter(r.categoryCode, categoryFilter),
      );
    } else if (scope === 'surgery') {
      data = data.filter((r) => matchesSurgeryCatalogFilter(r.categoryCode, categoryFilter));
    }

    if (!q) return data;
    return data.filter(
      (r) =>
        r.variantName.toLowerCase().includes(q) ||
        r.variantCode.toLowerCase().includes(q) ||
        r.categoryCode.toLowerCase().includes(q),
    );
  }, [pricingQuery.data, search, scope, categoryFilter]);

  const refresh = () => {
    if (branchId) void queryClient.invalidateQueries({ queryKey: branchPricingKey(branchId) });
  };

  const getEditValue = (row: BranchPricingRowDto) => {
    if (edits[row.variantId] !== undefined) return edits[row.variantId];
    if (row.branchAmount != null) return String(row.branchAmount);
    return '';
  };

  const saveRow = async (row: BranchPricingRowDto) => {
    const raw = getEditValue(row).trim();
    setSavingId(row.variantId);
    try {
      if (raw === '') {
        if (row.branchAmount != null) {
          await serviceCatalogAdminApi.removeBranchVariantPrice(branchId, row.variantId);
          toast.success('Branch override removed — using global price');
        }
      } else {
        const amount = Number(raw);
        if (Number.isNaN(amount) || amount < 0) {
          toast.error('Enter a valid price');
          return;
        }
        await serviceCatalogAdminApi.upsertBranchVariantPrice(branchId, {
          variantId: row.variantId,
          amount,
        });
        toast.success('Branch override saved');
      }
      setEdits((e) => {
        const { [row.variantId]: _, ...rest } = e;
        return rest;
      });
      refresh();
    } catch {
      toast.error('Failed to save branch price');
    } finally {
      setSavingId(null);
    }
  };

  const totalCatalogRows = pricingQuery.data?.length ?? 0;
  const scopeLabel =
    scope === 'investigations'
      ? categoryFilter === INVESTIGATION_CATALOG_FILTER
        ? 'investigations (imaging + lab)'
        : categoryFilter === 'DIAGNOSTICS'
          ? 'imaging only'
          : 'lab only'
      : scope === 'surgery'
        ? categoryFilter === 'ALL'
          ? 'all procedures'
          : categoryFilter
        : 'all catalog variants';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3 text-sm text-teal-900">
        <p className="font-medium">Global prices apply by default</p>
        <p className="text-teal-800/90 mt-0.5">
          Enter a branch override only when this location charges differently. Leave blank and save to revert to
          global.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-gray-700 flex flex-col gap-1.5 min-w-[14rem]">
          <span className="font-medium">Pricing for branch</span>
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setEdits({});
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            disabled={branchesQuery.isLoading}
          >
            {(branchesQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variants…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>
      </div>

      {scope !== 'all' && (
        <p className="text-xs text-gray-500">Showing {scopeLabel} — matches your catalog filter.</p>
      )}

      {!branchId && !branchesQuery.isLoading && (
        <EmptyPanel title="Choose a branch" message="Select a branch to view or set price overrides." />
      )}

      {branchId && pricingQuery.isLoading && (
        <p className="text-sm text-gray-500 animate-pulse">Loading branch pricing…</p>
      )}

      {branchId && pricingQuery.isSuccess && totalCatalogRows === 0 && (
        <EmptyPanel
          title="Catalog is empty"
          message="Add variants in Investigations or Surgery tabs before setting branch overrides."
        />
      )}

      {branchId && pricingQuery.isSuccess && totalCatalogRows > 0 && rows.length === 0 && (
        <EmptyPanel
          title="No variants in this view"
          message={`No ${scopeLabel} match your filter. Try another tab or clear search.`}
        />
      )}

      {branchId && pricingQuery.isSuccess && rows.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/90 text-left text-xs uppercase tracking-wide text-gray-500 sticky top-0">
              <tr>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3 text-right">Global</th>
                <th className="px-4 py-3 text-right">Branch override</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const hasOverride = row.branchAmount != null;
                return (
                  <tr key={row.variantId} className="hover:bg-gray-50/80">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{row.variantName}</span>
                      <span className="block text-xs text-gray-400 font-mono">{row.variantCode}</span>
                      <span className="text-xs text-gray-400">{row.categoryCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      ₹{row.globalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        placeholder="Global"
                        value={getEditValue(row)}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [row.variantId]: e.target.value }))
                        }
                        className={`w-28 text-right text-sm border rounded-lg px-2 py-1 tabular-nums ${
                          hasOverride ? 'border-teal-300 bg-teal-50/50' : 'border-gray-200'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                          hasOverride
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {hasOverride ? 'Override' : 'Global'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={savingId === row.variantId}
                        onClick={() => void saveRow(row)}
                        className="text-xs px-2.5 py-1.5 font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50"
                      >
                        {savingId === row.variantId ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{message}</p>
    </div>
  );
}

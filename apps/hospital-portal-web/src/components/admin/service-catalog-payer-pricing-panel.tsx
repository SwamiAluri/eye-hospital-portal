'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { listInsurancePayers } from '@/lib/api/ccms/ccms-master-data.api';
import {
  serviceCatalogAdminApi,
  type PayerPricingRowDto,
} from '@/lib/api/service-catalog.api';
import {
  INVESTIGATION_CATALOG_FILTER,
  isInvestigationCategoryCode,
  matchesServiceCatalogCategoryFilter,
} from '@/lib/counsellors-desk/investigation-catalog';
import { matchesSurgeryCatalogFilter } from '@/lib/master-data/service-catalog-url';

const payerPricingKey = (payerId: string) =>
  ['service-catalog', 'admin', 'payer-pricing', payerId] as const;

type Props = {
  categoryFilter: string;
};

function resolveScope(categoryFilter: string): 'investigations' | 'surgery' | 'all' {
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

export function ServiceCatalogPayerPricingPanel({ categoryFilter }: Props) {
  const queryClient = useQueryClient();
  const [payerId, setPayerId] = useState('');
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const scope = resolveScope(categoryFilter);

  const payersQuery = useQuery({
    queryKey: ['ccms', 'insurance-payers', 'catalog-admin'],
    queryFn: listInsurancePayers,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!payerId && payersQuery.data?.length) {
      setPayerId(payersQuery.data[0].id);
    }
  }, [payerId, payersQuery.data]);

  const pricingQuery = useQuery({
    queryKey: payerPricingKey(payerId),
    queryFn: () => serviceCatalogAdminApi.getPayerPricingRows(payerId),
    enabled: !!payerId,
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
    if (payerId) void queryClient.invalidateQueries({ queryKey: payerPricingKey(payerId) });
  };

  const getEditValue = (row: PayerPricingRowDto) => {
    if (edits[row.variantId] !== undefined) return edits[row.variantId];
    if (row.payerAmount != null) return String(row.payerAmount);
    return '';
  };

  const saveRow = async (row: PayerPricingRowDto) => {
    const raw = getEditValue(row).trim();
    setSavingId(row.variantId);
    try {
      if (raw === '') {
        if (row.payerAmount != null) {
          await serviceCatalogAdminApi.removePayerVariantPrice(payerId, row.variantId);
          toast.success('Payer tariff removed — using catalog price');
        }
      } else {
        const amount = Number(raw);
        if (Number.isNaN(amount) || amount < 0) {
          toast.error('Enter a valid price');
          return;
        }
        await serviceCatalogAdminApi.upsertPayerVariantPrice(payerId, {
          variantId: row.variantId,
          amount,
        });
        toast.success('Payer tariff saved');
      }
      setEdits((e) => {
        const { [row.variantId]: _, ...rest } = e;
        return rest;
      });
      refresh();
    } catch {
      toast.error('Failed to save payer tariff');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3 text-sm text-teal-900">
        <p className="font-medium">Insurer / corporate tariffs overlay the catalog</p>
        <p className="text-teal-800/90 mt-0.5">
          CCMS still owns copay, deductible, and approved cap. Leave blank and save to charge the
          catalog (global) price for this payer.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-gray-700 flex flex-col gap-1.5 min-w-[14rem]">
          <span className="font-medium">Tariff for payer</span>
          <select
            value={payerId}
            onChange={(e) => {
              setPayerId(e.target.value);
              setEdits({});
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            disabled={payersQuery.isLoading}
          >
            {(payersQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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

      {payersQuery.isError && (
        <p className="text-sm text-red-700">Could not load insurance payers from CCMS.</p>
      )}

      {!payerId && !payersQuery.isLoading && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-gray-700">No payers</p>
          <p className="text-sm text-gray-500 mt-1">Add an insurer in CCMS master data first.</p>
        </div>
      )}

      {payerId && pricingQuery.isLoading && (
        <p className="text-sm text-gray-500 animate-pulse">Loading payer tariffs…</p>
      )}

      {payerId && pricingQuery.isSuccess && rows.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/90 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3 text-right">Catalog</th>
                <th className="px-4 py-3 text-right">Payer tariff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const hasOverride = row.payerAmount != null;
                return (
                  <tr key={row.variantId} className="hover:bg-gray-50/80">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{row.variantName}</span>
                      <span className="block text-xs text-gray-400 font-mono">{row.variantCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      ₹{row.globalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        placeholder="Catalog"
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
                          hasOverride ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {hasOverride ? 'Tariff' : 'Catalog'}
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

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Layers,
  Link2,
  CloudUpload,
  Settings2,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  flattenCatalog,
  priceSuffix,
  serviceCatalogAdminApi,
  serviceCatalogApi,
  type FlatVariantDto,
} from '@/lib/api/service-catalog.api';
import { invalidateMasterCache } from '@/hooks/use-master-values';
import { useCachedAuthStore } from '@/lib/permission-cache';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import {
  ServiceCatalogAdminDialog,
  type CatalogDialogState,
} from '@/components/admin/service-catalog-admin-dialogs';
import { ServiceCatalogIolPanel } from '@/components/admin/service-catalog-iol-panel';
import { ServiceCatalogBranchPricingPanel } from '@/components/admin/service-catalog-branch-pricing-panel';
import { ServiceCatalogStructureDrawer } from '@/components/admin/service-catalog-structure-drawer';
import { VariantIolMappingDialog } from '@/components/admin/service-catalog-variant-iol-dialog';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  INVESTIGATION_CATALOG_FILTER,
  isInvestigationCategoryCode,
  matchesServiceCatalogCategoryFilter,
} from '@/lib/counsellors-desk/investigation-catalog';
import {
  buildServiceCatalogSearchParams,
  investigationTypeLabel,
  matchesSurgeryCatalogFilter,
  parseServiceCatalogFilterParam,
  parseServiceCatalogMode,
  type ServiceCatalogMode,
} from '@/lib/master-data/service-catalog-url';

const CATALOG_QUERY_KEY = ['service-catalog', 'admin', 'full'] as const;

type DeleteTarget =
  | { type: 'category'; id: string; label: string }
  | { type: 'service'; id: string; label: string }
  | { type: 'variant'; id: string; label: string };

const MODE_TABS: { id: ServiceCatalogMode; label: string; countKey?: 'investigations' | 'surgery' }[] = [
  { id: 'investigations', label: 'Investigations', countKey: 'investigations' },
  { id: 'surgery', label: 'Surgery & procedures', countKey: 'surgery' },
  { id: 'iol', label: 'IOL catalog' },
  { id: 'branch', label: 'Branch pricing' },
];

export function ServiceCatalogBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useCachedAuthStore();
  const canManageStructure = hasPermission('master_data.manage');

  const initialMode = parseServiceCatalogMode(searchParams);
  const initialFilter = parseServiceCatalogFilterParam(searchParams, initialMode);

  const [mode, setMode] = useState<ServiceCatalogMode>(initialMode);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialFilter);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [dialogState, setDialogState] = useState<CatalogDialogState>({ kind: 'closed' });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [iolVariant, setIolVariant] = useState<FlatVariantDto | null>(null);

  const catalogQuery = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: () => serviceCatalogAdminApi.getAdminFull(true),
    staleTime: 2 * 60 * 1000,
  });

  const refreshCatalog = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
  }, [queryClient]);

  const flatVariants = useMemo(
    () => (catalogQuery.data ? flattenCatalog(catalogQuery.data) : []),
    [catalogQuery.data],
  );

  const categories = useMemo(() => catalogQuery.data?.categories ?? [], [catalogQuery.data]);

  const stats = useMemo(() => {
    const byCat = new Map<string, number>();
    let surgeryCount = 0;
    for (const v of flatVariants) {
      byCat.set(v.categoryCode, (byCat.get(v.categoryCode) ?? 0) + 1);
      if (!isInvestigationCategoryCode(v.categoryCode)) surgeryCount += 1;
    }
    return { byCat, surgeryCount };
  }, [flatVariants]);

  const diagnosticsCount = stats.byCat.get('DIAGNOSTICS') ?? 0;
  const labCount = stats.byCat.get('INVESTIGATIONS') ?? 0;
  const allInvestigationsCount = diagnosticsCount + labCount;

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatVariants.filter((v) => {
      const modeMatch =
        mode === 'investigations'
          ? matchesServiceCatalogCategoryFilter(v.categoryCode, categoryFilter)
          : mode === 'surgery'
            ? matchesSurgeryCatalogFilter(v.categoryCode, categoryFilter)
            : true;
      if (!modeMatch) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        v.serviceName.toLowerCase().includes(q) ||
        v.categoryName.toLowerCase().includes(q)
      );
    });
  }, [flatVariants, search, categoryFilter, mode]);

  const hideCategoryColumn =
    mode === 'investigations' &&
    (categoryFilter === 'DIAGNOSTICS' || categoryFilter === 'INVESTIGATIONS');

  const showTypeBadgeColumn =
    mode === 'investigations' && categoryFilter === INVESTIGATION_CATALOG_FILTER;

  const surgeryCategoryChips = useMemo(() => {
    return categories
      .filter((c) => !isInvestigationCategoryCode(c.code) && (stats.byCat.get(c.code) ?? 0) > 0)
      .slice(0, 6);
  }, [categories, stats.byCat]);

  const syncUrl = useCallback(
    (nextMode: ServiceCatalogMode, nextFilter: string) => {
      const qs = buildServiceCatalogSearchParams(nextMode, nextFilter);
      router.replace(`${pathname}?${qs}`, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    const nextMode = parseServiceCatalogMode(searchParams);
    const nextFilter = parseServiceCatalogFilterParam(searchParams, nextMode);
    setMode(nextMode);
    setCategoryFilter(nextFilter);
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get('mode') && !searchParams.get('category')) {
      syncUrl('investigations', INVESTIGATION_CATALOG_FILTER);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setModeAndFilter = (nextMode: ServiceCatalogMode, nextFilter?: string) => {
    const filter =
      nextFilter ??
      (nextMode === 'investigations'
        ? INVESTIGATION_CATALOG_FILTER
        : nextMode === 'surgery'
          ? 'ALL'
          : categoryFilter);
    setMode(nextMode);
    setCategoryFilter(filter);
    syncUrl(nextMode, filter);
  };

  const setFilter = (filter: string) => {
    setCategoryFilter(filter);
    syncUrl(mode, filter);
  };

  const handleSyncMaster = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await serviceCatalogApi.syncMaster();
      invalidateMasterCache('clinical.surgery_type');
      invalidateMasterCache('clinical.iol_catalog');
      toast.success(
        `Synced ${result.surgeryTypesUpserted} surgery types, ${result.iolCatalogUpserted} IOL rows`,
      );
    } catch {
      toast.error('Failed to sync catalog to master data');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'category') {
        await serviceCatalogAdminApi.deleteCategory(deleteTarget.id);
      } else if (deleteTarget.type === 'service') {
        await serviceCatalogAdminApi.deleteService(deleteTarget.id);
      } else {
        await serviceCatalogAdminApi.deleteVariant(deleteTarget.id);
      }
      toast.success('Deleted');
      refreshCatalog();
      setDeleteTarget(null);
    } catch {
      toast.error('Delete failed');
      throw new Error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/40">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Link href="/dashboard/master-data" className="hover:text-teal-700">
              Master Data
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-800 font-medium">Service Catalog</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Layers className="h-6 w-6 text-teal-600" />
                Service Catalog
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Procedures, investigations, IOL models, and branch price overrides for Counsellor desk and billing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageStructure && (mode === 'investigations' || mode === 'surgery') && (
                <button
                  type="button"
                  onClick={() => setStructureOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Settings2 className="h-4 w-4" />
                  Manage structure
                </button>
              )}
              <button
                type="button"
                onClick={() => void catalogQuery.refetch()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {canManageStructure && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleSyncMaster()}
                  title="Push surgery types and IOL labels to Master Data → Clinical"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
                >
                  <CloudUpload className={`h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} />
                  Sync to Clinical
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 mt-5 border-b border-gray-200 -mb-px overflow-x-auto">
            {MODE_TABS.map(({ id, label, countKey }) => {
              const count =
                countKey === 'investigations'
                  ? allInvestigationsCount
                  : countKey === 'surgery'
                    ? stats.surgeryCount
                    : undefined;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModeAndFilter(id)}
                  className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    mode === id
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                  {count != null && count > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {mode === 'iol' && <ServiceCatalogIolPanel />}

        {mode === 'branch' && (
          <ServiceCatalogBranchPricingPanel categoryFilter={categoryFilter} />
        )}

        {(mode === 'investigations' || mode === 'surgery') && catalogQuery.isLoading && (
          <p className="text-sm text-gray-500 animate-pulse">Loading service catalog…</p>
        )}

        {(mode === 'investigations' || mode === 'surgery') && catalogQuery.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-red-700 text-sm font-medium">Failed to load service catalog.</p>
            <button
              type="button"
              className="mt-2 text-sm text-teal-700 underline"
              onClick={() => void catalogQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {(mode === 'investigations' || mode === 'surgery') && catalogQuery.isSuccess && (
          <>
            {mode === 'investigations' && allInvestigationsCount === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">No investigation variants yet</p>
                <p className="mt-1 text-amber-800">
                  Run{' '}
                  <code className="text-xs bg-amber-100 px-1 rounded">npm run import:legacy-lab-catalog</code> or
                  use Manage structure to add DIAGNOSTICS and INVESTIGATIONS items.
                </p>
              </div>
            )}

            {mode === 'investigations' && (
              <div className="grid grid-cols-3 gap-3 max-w-xl">
                <KpiCard
                  label="All investigations"
                  value={allInvestigationsCount}
                  active={categoryFilter === INVESTIGATION_CATALOG_FILTER}
                  onClick={() => setFilter(INVESTIGATION_CATALOG_FILTER)}
                />
                <KpiCard
                  label="Imaging"
                  value={diagnosticsCount}
                  active={categoryFilter === 'DIAGNOSTICS'}
                  onClick={() => setFilter('DIAGNOSTICS')}
                />
                <KpiCard
                  label="Lab"
                  value={labCount}
                  active={categoryFilter === 'INVESTIGATIONS'}
                  onClick={() => setFilter('INVESTIGATIONS')}
                />
              </div>
            )}

            <div className="sticky top-[9.5rem] z-10 -mx-1 px-1 py-3 bg-gray-50/95 backdrop-blur rounded-xl">
              <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or code…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>

                {mode === 'investigations' && (
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={categoryFilter === INVESTIGATION_CATALOG_FILTER}
                      onClick={() => setFilter(INVESTIGATION_CATALOG_FILTER)}
                    >
                      Imaging + lab ({allInvestigationsCount})
                    </FilterChip>
                    <FilterChip
                      active={categoryFilter === 'DIAGNOSTICS'}
                      onClick={() => setFilter('DIAGNOSTICS')}
                      variant="sky"
                    >
                      Imaging only ({diagnosticsCount})
                    </FilterChip>
                    <FilterChip
                      active={categoryFilter === 'INVESTIGATIONS'}
                      onClick={() => setFilter('INVESTIGATIONS')}
                      variant="violet"
                    >
                      Lab only ({labCount})
                    </FilterChip>
                  </div>
                )}

                {mode === 'surgery' && (
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={categoryFilter === 'ALL'} onClick={() => setFilter('ALL')}>
                      All procedures ({stats.surgeryCount})
                    </FilterChip>
                    {surgeryCategoryChips.map((c) => (
                      <FilterChip
                        key={c.id}
                        active={categoryFilter === c.code}
                        onClick={() => setFilter(c.code)}
                      >
                        {c.name} ({stats.byCat.get(c.code) ?? 0})
                      </FilterChip>
                    ))}
                  </div>
                )}

                {canManageStructure && (
                  <button
                    type="button"
                    onClick={() => setStructureOpen(true)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    Add item
                  </button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50/90 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {showTypeBadgeColumn && <th className="px-4 py-3 w-24">Type</th>}
                      {mode === 'surgery' && !hideCategoryColumn && (
                        <th className="px-4 py-3">Category</th>
                      )}
                      {mode === 'surgery' && <th className="px-4 py-3">Service</th>}
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <p className="text-gray-500 font-medium">No variants match your filters</p>
                          <p className="text-xs text-gray-400 mt-1">Try clearing search or changing filter chips</p>
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((v) => (
                        <VariantRow
                          key={v.id}
                          variant={v}
                          mode={mode}
                          showTypeBadge={showTypeBadgeColumn}
                          onIol={() => setIolVariant(v)}
                          onEdit={() =>
                            setDialogState({
                              kind: 'variant',
                              mode: 'edit',
                              serviceId: v.serviceId,
                              serviceName: v.serviceName,
                              variant: v,
                            })
                          }
                          onDelete={() =>
                            setDeleteTarget({ type: 'variant', id: v.id, label: v.name })
                          }
                          canDelete={canManageStructure}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {canManageStructure && (
        <ServiceCatalogStructureDrawer
          open={structureOpen}
          onClose={() => setStructureOpen(false)}
          mode={mode === 'branch' || mode === 'iol' ? 'investigations' : mode}
          categories={categories}
          onAddCategory={() => {
            setStructureOpen(false);
            setDialogState({ kind: 'category', mode: 'create' });
          }}
          onEditCategory={(cat) => {
            setStructureOpen(false);
            setDialogState({ kind: 'category', mode: 'edit', category: cat });
          }}
          onAddService={(cat) => {
            setStructureOpen(false);
            setDialogState({
              kind: 'service',
              mode: 'create',
              categoryId: cat.id,
              categoryName: cat.name,
            });
          }}
          onEditService={(cat, svc) => {
            setStructureOpen(false);
            setDialogState({
              kind: 'service',
              mode: 'edit',
              categoryId: cat.id,
              categoryName: cat.name,
              service: svc,
            });
          }}
          onAddVariant={(svc) => {
            setStructureOpen(false);
            setDialogState({
              kind: 'variant',
              mode: 'create',
              serviceId: svc.id,
              serviceName: svc.name,
            });
          }}
          onDeleteCategory={(cat) => {
            setDeleteTarget({ type: 'category', id: cat.id, label: cat.name });
          }}
          onDeleteService={(svc) => {
            setDeleteTarget({ type: 'service', id: svc.id, label: svc.name });
          }}
        />
      )}

      <VariantIolMappingDialog
        variant={iolVariant}
        open={iolVariant != null}
        onClose={() => setIolVariant(null)}
        onSaved={refreshCatalog}
      />

      <ServiceCatalogAdminDialog
        state={dialogState}
        onClose={() => setDialogState({ kind: 'closed' })}
        onSaved={() => {
          refreshCatalog();
          toast.success('Saved');
        }}
      />

      <ConfirmationDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type ?? 'item'}?`}
        message={
          <>
            <span className="font-medium">{deleteTarget?.label}</span> will be deactivated (soft delete).
            {deleteTarget?.type === 'category' && ' All services and variants under this category are included.'}
            {deleteTarget?.type === 'service' && ' All variants under this service are included.'}
          </>
        }
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </button>
  );
}

function FilterChip({
  children,
  active,
  onClick,
  variant = 'default',
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  variant?: 'default' | 'sky' | 'violet';
}) {
  const activeCls =
    variant === 'sky'
      ? 'bg-sky-600 text-white border-sky-600'
      : variant === 'violet'
        ? 'bg-violet-600 text-white border-violet-600'
        : 'bg-teal-600 text-white border-teal-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
        active ? activeCls : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function VariantRow({
  variant: v,
  mode,
  showTypeBadge,
  onIol,
  onEdit,
  onDelete,
  canDelete,
}: {
  variant: FlatVariantDto;
  mode: ServiceCatalogMode;
  showTypeBadge: boolean;
  onIol: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const typeLabel = investigationTypeLabel(v.categoryCode);
  const showIol =
    v.hasIolOptions || v.categoryCode === 'CATARACT' || v.categoryCode === 'PREMIUM_LENSES';

  return (
    <tr className={`hover:bg-gray-50/80 ${!v.isActive ? 'opacity-50' : ''}`}>
      {showTypeBadge && (
        <td className="px-4 py-2.5">
          {typeLabel && (
            <Badge
              variant="outline"
              className={
                typeLabel === 'Imaging'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-violet-200 bg-violet-50 text-violet-800'
              }
            >
              {typeLabel}
            </Badge>
          )}
        </td>
      )}
      {mode === 'surgery' && (
        <td className="px-4 py-2.5 text-gray-600 text-xs">{v.categoryName}</td>
      )}
      {mode === 'surgery' && (
        <td className="px-4 py-2.5 text-gray-600">{v.serviceName}</td>
      )}
      <td className="px-4 py-2.5 font-medium text-gray-900">{v.name}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{v.code}</td>
      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
        ₹{v.price.toLocaleString()}
        <span className="text-gray-400 text-xs">{priceSuffix(v.priceType)}</span>
      </td>
      <td className="px-4 py-2.5">
        {!v.isActive ? (
          <Badge variant="destructive">Inactive</Badge>
        ) : v.hasIolOptions ? (
          <Badge variant="outline" className="border-teal-200 text-teal-700">
            IOL
          </Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="inline-flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showIol && (
                <DropdownMenuItem onClick={onIol}>
                  <Link2 className="h-4 w-4 mr-2" />
                  IOL mappings
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  {showIol && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

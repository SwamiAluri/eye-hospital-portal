'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { masterValuesApi } from '@/lib/api';
import { invalidateMasterCache } from '@/hooks/use-master-values';
import { useCachedAuthStore } from '@/lib/permission-cache';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Lock,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Activity,
  ShieldCheck,
  List,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { serviceCatalogApi } from '@/lib/api/service-catalog.api';
import { ServiceCatalogInvestigationsCallout } from '@/components/master-data/ServiceCatalogInvestigationsCallout';
import { MasterDataErrorState } from '@/components/master-data/MasterDataErrorState';
import { parseMasterApiError } from '@/lib/master-data/master-api-errors';
import {
  getMasterEntityIntegration,
  MASTER_INTEGRATION_STATUS_STYLES,
} from '@/lib/master-data/integration-manifest';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

// ─── Type Definitions ────────────────────────────────────────────────────────

interface MasterValue {
  id: string;
  entityType: string;
  code: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  isSystemLocked: boolean;
  disabledAt?: string;
  disabledReason?: string;
}

interface EntityTypeInfo {
  entityType: string;
  displayName: string;
  tabLabel: string;
  sortOrder: number;
}

interface MasterGroup {
  groupKey: string;
  displayName: string;
  entityTypes: EntityTypeInfo[];
}

interface EntityTypeValues {
  entityType: string;
  displayName: string;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: MasterValue[];
}

interface GroupStats {
  entityType: string;
  displayName: string;
  total: number;
  active: number;
  disabled: number;
  systemLocked: number;
}

// ─── Group slug → groupKey (URL uses snake_case group_key from API) ───────────

function resolveGroupKeyFromSlug(slug: string): string {
  return slug;
}

// ─── Empty Form State ─────────────────────────────────────────────────────────

const EMPTY_FORM = { code: '', label: '', description: '', metadata: '', sortOrder: 0 };

// Auto-derive a SCREAMING_SNAKE_CASE code from a display label
function deriveCode(label: string): string {
  return label
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isCatalogSyncedMaster(item: MasterValue): boolean {
  return item.metadata?.syncedFromCatalog === true;
}

function MasterUsedByBadge({ entityType }: { entityType: string }) {
  const integration = getMasterEntityIntegration(entityType);
  if (!integration) return null;
  const style = MASTER_INTEGRATION_STATUS_STYLES[integration.status];
  const usedByText = integration.usedBy.join(', ');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${style}`}
      title={integration.notes ? `${usedByText} — ${integration.notes}` : usedByText}
    >
      <Link2 className="h-2.5 w-2.5 shrink-0" />
      <span className="uppercase tracking-wide">{integration.status}</span>
      <span className="normal-case font-normal opacity-80">· Used by {usedByText}</span>
    </span>
  );
}

function canEditMasterItem(item: MasterValue): boolean {
  return !item.isSystemLocked || isCatalogSyncedMaster(item);
}

// ─── Smart Metadata Schemas (for structured entity types) ─────────────────────

type MetaFieldType = 'text' | 'number' | 'select' | 'boolean';
interface MetaField { key: string; label: string; type: MetaFieldType; options?: string[] }

const ENTITY_META_SCHEMAS: Record<string, MetaField[]> = {
  'inventory.gst_rate': [
    { key: 'rate', label: 'GST Rate (%)', type: 'number' },
  ],
  'inventory.payment_term': [
    { key: 'days', label: 'Payment Days', type: 'number' },
  ],
  'clinical.surgery_type': [
    { key: 'categoryCode', label: 'Catalog Category Code', type: 'text' },
    { key: 'priceType', label: 'Price Type', type: 'text' },
    { key: 'hasIolOptions', label: 'Has IOL Options', type: 'boolean' },
    { key: 'catalogVariantId', label: 'Catalog Variant ID', type: 'text' },
  ],
  'clinical.anesthesia_type': [
    { key: 'category', label: 'Category', type: 'select', options: ['Topical','Local','Regional','General','Combined'] },
  ],
  'clinical.iol_catalog': [
    { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
    { key: 'model', label: 'Model', type: 'text' },
    { key: 'lens_type', label: 'Lens Type', type: 'select', options: ['spheric','aspheric','toric','multifocal','extended'] },
    { key: 'sphere_power_min', label: 'Min Power (D)', type: 'number' },
    { key: 'sphere_power_max', label: 'Max Power (D)', type: 'number' },
    { key: 'catalogIolId', label: 'Catalog IOL ID', type: 'text' },
  ],
  'insurance.type': [
    { key: 'isCashless', label: 'Is Cashless', type: 'boolean' },
  ],
  'pharmacy.dosage_frequency': [
    { key: 'timesPerDay', label: 'Times Per Day', type: 'number' },
  ],
  'system.timezone': [
    { key: 'offset', label: 'UTC Offset (e.g. +05:30)', type: 'text' },
    { key: 'tz', label: 'IANA Timezone (e.g. Asia/Kolkata)', type: 'text' },
  ],
  'system.currency': [
    { key: 'symbol', label: 'Symbol (e.g. ₹)', type: 'text' },
    { key: 'iso', label: 'ISO Code (e.g. INR)', type: 'text' },
  ],
  'system.language': [
    { key: 'locale', label: 'Locale (e.g. en)', type: 'text' },
  ],
  'patient.patient_type': [
    { key: 'legacyPatientType', label: 'Legacy session key (e.g. Cash)', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'requiresAdvancePayment', label: 'Requires Advance Payment', type: 'boolean' },
    { key: 'advancePercentage', label: 'Advance Percentage (%)', type: 'number' },
    { key: 'requiresPreApproval', label: 'Requires Pre-Approval', type: 'boolean' },
    { key: 'zeroAdvancePayment', label: 'Zero Advance Payment', type: 'boolean' },
    { key: 'category', label: 'Category', type: 'select', options: ['direct', 'government', 'special'] },
    { key: 'icon', label: 'Icon name', type: 'text' },
  ],
  'operations.service_room': [
    { key: 'branchId', label: 'Branch ID', type: 'text' },
    { key: 'station', label: 'Station', type: 'text' },
    { key: 'roomCode', label: 'Room Code', type: 'text' },
    { key: 'tvDisplayLabel', label: 'TV Display Label', type: 'text' },
    { key: 'maxConcurrent', label: 'Max Concurrent', type: 'number' },
    { key: 'isActive', label: 'Is Active', type: 'boolean' },
  ],
  'operations.station': [
    { key: 'routableFromFrontdesk', label: 'Routable from front desk', type: 'boolean' },
  ],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function MasterDataManagement() {
  const params = useParams();
  const groupSlug = (params?.group as string) ?? '';
  const groupKey = resolveGroupKeyFromSlug(groupSlug);

  const { hasPermission } = useCachedAuthStore();
  const canCreate = hasPermission('master_data.create');
  const canUpdate = hasPermission('master_data.update');
  const canDelete = hasPermission('master_data.delete');
  const canManage = hasPermission('master_data.manage');

  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [valuesMap, setValuesMap] = useState<Record<string, EntityTypeValues>>({});
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadError, setLoadError] = useState<ReturnType<typeof parseMasterApiError> | null>(null);
  const [groupDisplayName, setGroupDisplayName] = useState('');

  // Stats cards
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterValue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [metaForm, setMetaForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MasterValue | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string; usageCount?: number } | null>(null);

  // Disable-with-reason state
  const [disableTarget, setDisableTarget] = useState<MasterValue | null>(null);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [disabling, setDisabling] = useState(false);

  // Pagination state per tab
  const [pageMap, setPageMap] = useState<Record<string, number>>({});

  // Service catalog sync (clinical group)
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Load entity types for this group
  useEffect(() => {
    if (!groupKey) return;
    setLoadingGroups(true);
    setLoadError(null);
    masterValuesApi
      .getGroups()
      .then((res) => {
        const groups: MasterGroup[] = res.data?.data ?? res.data ?? [];
        const found = groups.find((g) => g.groupKey === groupKey);
        if (found) {
          setGroupDisplayName(found.displayName);
          const sorted = [...found.entityTypes].sort((a, b) => a.sortOrder - b.sortOrder);
          setEntityTypes(sorted);
          if (sorted.length > 0) setActiveTab(sorted[0].entityType);
        } else {
          setEntityTypes([]);
          setGroupDisplayName('');
        }
      })
      .catch((err) => {
        setEntityTypes([]);
        setLoadError(parseMasterApiError(err));
      })
      .finally(() => setLoadingGroups(false));

    // Load group stats for summary cards
    masterValuesApi
      .getGroupStats(groupKey)
      .then((res) => {
        const stats: GroupStats[] = res.data?.data ?? res.data ?? [];
        setGroupStats(stats);
      })
      .catch(() => setGroupStats([]));
  }, [groupKey]);

  // Aggregate stats across all entity types in this group
  const totalSummary = groupStats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      active: acc.active + s.active,
      disabled: acc.disabled + s.disabled,
      systemLocked: acc.systemLocked + s.systemLocked,
    }),
    { total: 0, active: 0, disabled: 0, systemLocked: 0 },
  );

  // Load values for a tab
  const loadTab = useCallback(
    (entityType: string, page = 1) => {
      setLoadingTab(true);
      masterValuesApi
        .getByEntityType(entityType, true, page, 50)
        .then((res) => {
          const data: EntityTypeValues = res.data?.data ?? res.data;
          setValuesMap((prev) => ({ ...prev, [entityType]: data }));
          setPageMap((prev) => ({ ...prev, [entityType]: page }));
        })
        .catch(console.error)
        .finally(() => setLoadingTab(false));
    },
    [],
  );

  useEffect(() => {
    if (activeTab) loadTab(activeTab, pageMap[activeTab] ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshTab = useCallback(
    (entityType: string) => {
      loadTab(entityType, pageMap[entityType] ?? 1);

      // Refresh stats too
      masterValuesApi
        .getGroupStats(groupKey)
        .then((res) => setGroupStats(res.data?.data ?? res.data ?? []))
        .catch(() => {});
    },
    [groupKey, loadTab, pageMap],
  );

  // ─── Dialog Helpers ──────────────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setMetaForm({});
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (item: MasterValue) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      label: item.label,
      description: item.description ?? '',
      metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
      sortOrder: item.sortOrder,
    });
    // Parse existing metadata into smart form fields if schema exists
    const schema = ENTITY_META_SCHEMAS[activeTab];
    if (schema && item.metadata) {
      try {
        const raw = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        const mf: Record<string, string> = {};
        schema.forEach((f) => { mf[f.key] = raw[f.key] !== undefined ? String(raw[f.key]) : ''; });
        setMetaForm(mf);
      } catch {
        setMetaForm({});
      }
    } else {
      setMetaForm({});
    }
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.label.trim()) {
      setFormError('Label is required.');
      return;
    }
    if (!editingItem && !form.code.trim()) {
      setFormError('Code is required.');
      return;
    }

    let metaPayload: string | undefined;
    const schema = ENTITY_META_SCHEMAS[activeTab];
    const catalogSyncedEdit = editingItem && isCatalogSyncedMaster(editingItem);
    if (schema && schema.length > 0 && !catalogSyncedEdit) {
      // Build metadata JSON from smart form fields
      const meta: Record<string, unknown> = {};
      schema.forEach((f) => {
        const val = metaForm[f.key] ?? '';
        if (f.type === 'number') meta[f.key] = val !== '' ? Number(val) : 0;
        else if (f.type === 'boolean') meta[f.key] = val === 'true';
        else meta[f.key] = val;
      });
      metaPayload = JSON.stringify(meta);
    } else if (form.metadata.trim()) {
      try {
        JSON.parse(form.metadata);
        metaPayload = form.metadata;
      } catch {
        setFormError('Metadata must be valid JSON.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingItem) {
        await masterValuesApi.update(activeTab, editingItem.id, {
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          metadata: catalogSyncedEdit ? undefined : metaPayload,
          sortOrder: catalogSyncedEdit ? editingItem.sortOrder : Number(form.sortOrder),
        });
      } else {
        await masterValuesApi.create(activeTab, {
          code: form.code.trim(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          metadata: metaPayload,
          sortOrder: Number(form.sortOrder),
        });
      }
      setDialogOpen(false);
      invalidateMasterCache(activeTab);
      refreshTab(activeTab);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setFormError(axiosErr?.response?.data?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleCatalogSync = async () => {
    setSyncingCatalog(true);
    setSyncMessage('');
    try {
      const result = await serviceCatalogApi.syncMaster();
      invalidateMasterCache('clinical.surgery_type');
      invalidateMasterCache('clinical.iol_catalog');
      if (entityTypes.some((e) => e.entityType === 'clinical.surgery_type')) {
        refreshTab('clinical.surgery_type');
      }
      if (entityTypes.some((e) => e.entityType === 'clinical.iol_catalog')) {
        refreshTab('clinical.iol_catalog');
      }
      if (activeTab) refreshTab(activeTab);
      setSyncMessage(
        `Synced ${result.surgeryTypesUpserted} surgery types, ${result.iolCatalogUpserted} IOL rows` +
          (result.deactivated > 0 ? `, ${result.deactivated} deactivated` : ''),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setSyncMessage(axiosErr?.response?.data?.error ?? 'Catalog sync failed.');
    } finally {
      setSyncingCatalog(false);
    }
  };

  // ─── Enable / Disable ────────────────────────────────────────────────────

  const handleEnable = async (item: MasterValue) => {
    try {
      await masterValuesApi.enable(activeTab, item.id);
      invalidateMasterCache(activeTab);
      refreshTab(activeTab);
    } catch (err) {
      console.error(err);
    }
  };

  const openDisableDialog = (item: MasterValue) => {
    setDisableTarget(item);
    setDisableReason('');
    setDisableDialogOpen(true);
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await masterValuesApi.disable(activeTab, disableTarget.id, disableReason.trim() || undefined);
      setDisableDialogOpen(false);
      setDisableTarget(null);
      invalidateMasterCache(activeTab);
      refreshTab(activeTab);
    } catch (err) {
      console.error(err);
    } finally {
      setDisabling(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const confirmDelete = (item: MasterValue) => {
    setDeleteTarget(item);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await masterValuesApi.delete(activeTab, deleteTarget.id);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      invalidateMasterCache(activeTab);
      refreshTab(activeTab);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; usageCount?: number } } };
      const data = axiosErr?.response?.data;
      setDeleteError({
        message: data?.message ?? 'Delete failed.',
        usageCount: data?.usageCount,
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loadingGroups) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm font-medium">Loading {groupDisplayName || 'master data'}…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <MasterDataErrorState
          title="Master Data unavailable"
          message={loadError.message}
          permissionDenied={loadError.permissionDenied}
        />
      </div>
    );
  }

  if (entityTypes.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-2 max-w-md px-6">
          <List className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">No entity types found for this group.</p>
          <p className="text-xs text-gray-400">
            Unknown group <code className="font-mono">{groupSlug}</code> or registry migrations not applied.
            Open <Link href="/dashboard/master-data" className="text-teal-600 hover:underline">Master Data overview</Link>.
          </p>
        </div>
      </div>
    );
  }

  const currentValues = valuesMap[activeTab];
  const currentPage = pageMap[activeTab] ?? 1;
  const totalPages = currentValues?.totalPages ?? 1;
  const activeEntityInfo = entityTypes.find((et) => et.entityType === activeTab);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-100 flex-shrink-0">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{groupDisplayName}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {entityTypes.length} categor{entityTypes.length === 1 ? 'y' : 'ies'} · Reference lookup values
              </p>
            </div>
          </div>
          {groupKey === 'clinical' && canManage && (
            <button
              type="button"
              onClick={() => void handleCatalogSync()}
              disabled={syncingCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncingCatalog ? 'animate-spin' : ''}`} />
              Sync from Service Catalog
            </button>
          )}
        </div>
        {syncMessage && (
          <p className="text-sm text-teal-700 mt-3">{syncMessage}</p>
        )}

        {(groupKey === 'clinical' || groupKey === 'lab_diagnostics') && (
          <div className="mt-4">
            <ServiceCatalogInvestigationsCallout compact />
          </div>
        )}

        {groupKey === 'insurance' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/ccms/master-data/payers"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline"
            >
              CCMS Payers / TPA
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard/ccms/master-data/plans"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline"
            >
              Coverage Plans
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <span className="text-xs text-gray-400 self-center">
              Case-specific payer rules and packages — separate from insurance provider master values.
            </span>
          </div>
        )}

        {groupKey === 'counsellor' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/master-data/counsellor/packages"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline"
            >
              Counselling packages
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <span className="text-xs text-gray-400 self-center">
              Bundled procedure + IOL + investigation templates for counsellor desk quotes.
              Legacy surgery package dropdown values remain in the tabs below.
            </span>
          </div>
        )}

        {/* Stats row */}
        {groupStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="flex items-center gap-3 bg-blue-50/60 rounded-xl px-4 py-3 border border-blue-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <List className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest">Total</p>
                <p className="text-2xl font-bold text-blue-900 leading-none mt-0.5">{totalSummary.total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-widest">Active</p>
                <p className="text-2xl font-bold text-emerald-700 leading-none mt-0.5">{totalSummary.active}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Activity className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-widest">Disabled</p>
                <p className="text-2xl font-bold text-amber-700 leading-none mt-0.5">{totalSummary.disabled}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Locked</p>
                <p className="text-2xl font-bold text-slate-600 leading-none mt-0.5">{totalSummary.systemLocked}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab navigation */}
          <TabsList className="flex-wrap h-auto gap-1.5 p-1.5 bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
            {entityTypes.map((et) => {
              const stats = groupStats.find((s) => s.entityType === et.entityType);
              return (
                <TabsTrigger
                  key={et.entityType}
                  value={et.entityType}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-gray-500 transition-all
                    data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm
                    hover:bg-gray-50 hover:text-gray-700"
                >
                  {et.tabLabel}
                  {stats && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">
                      {stats.total}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {entityTypes.map((et) => (
            <TabsContent key={et.entityType} value={et.entityType} className="mt-0">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900">{et.displayName}</h2>
                      <MasterUsedByBadge entityType={et.entityType} />
                    </div>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{et.entityType}</p>
                    {currentValues && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {currentValues.total} value{currentValues.total !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  {canCreate && (
                    <button
                      onClick={openAddDialog}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-teal-100 transition-all hover:shadow-md active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  )}
                </div>

                {/* Body */}
                {loadingTab && !currentValues ? (
                  <div className="py-16 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <svg className="animate-spin h-6 w-6 text-teal-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <p className="text-sm">Loading values…</p>
                    </div>
                  </div>
                ) : !currentValues?.items?.length ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <List className="h-7 w-7 text-gray-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-gray-600">No values yet</p>
                      <p className="text-xs text-gray-400">Add the first reference value for {et.displayName}</p>
                    </div>
                    {canCreate && (
                      <button
                        onClick={openAddDialog}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        Add first value
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 py-3 w-36">Code</th>
                          <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Label &amp; Description</th>
                          <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-16">Order</th>
                          <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-28">Status</th>
                          <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 py-3 w-52">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {currentValues.items
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((item) => (
                            <tr
                              key={item.id}
                              className={`group transition-colors hover:bg-teal-50/20 ${
                                !item.isActive ? 'opacity-50 bg-gray-50/40' : ''
                              }`}
                            >
                              {/* Code */}
                              <td className="px-6 py-4 align-top">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono text-[11px] font-semibold border border-gray-200 tracking-wide">
                                  {item.code}
                                </span>
                              </td>

                              {/* Label + Description */}
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                                  {isCatalogSyncedMaster(item) && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 text-[10px] font-medium border border-sky-100">
                                      <Link2 className="h-2.5 w-2.5" />
                                      Service Catalog
                                    </span>
                                  )}
                                  {item.isSystemLocked && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                                      <Lock className="h-2.5 w-2.5" />
                                      Locked
                                    </span>
                                  )}
                                </div>
                                {item.description ? (
                                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
                                ) : (
                                  <p className="text-xs text-gray-200 mt-0.5 italic select-none">— no description</p>
                                )}
                                {!item.isActive && item.disabledReason && (
                                  <p className="inline-flex items-center text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-1 font-medium">
                                    Reason: {item.disabledReason}
                                  </p>
                                )}
                              </td>

                              {/* Order */}
                              <td className="px-4 py-4 text-center align-top">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                                  {item.sortOrder}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-4 text-center align-top">
                                {item.isActive ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold border border-gray-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                    Disabled
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-6 py-4 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Labeled buttons — visible on hover */}
                                  {canUpdate && canEditMasterItem(item) && (
                                    <button
                                      onClick={() => openEditDialog(item)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Edit
                                    </button>
                                  )}
                                  {canUpdate && item.isActive && !isCatalogSyncedMaster(item) && (
                                    <button
                                      onClick={() => openDisableDialog(item)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                    >
                                      <ToggleLeft className="h-3 w-3" />
                                      Disable
                                    </button>
                                  )}
                                  {canUpdate && !item.isActive && !isCatalogSyncedMaster(item) && (
                                    <button
                                      onClick={() => handleEnable(item)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                    >
                                      <ToggleRight className="h-3 w-3" />
                                      Enable
                                    </button>
                                  )}
                                  {canDelete && !item.isSystemLocked && (
                                    <button
                                      onClick={() => confirmDelete(item)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Delete
                                    </button>
                                  )}
                                  {/* Icon-only fallback — visible when not hovering */}
                                  {canUpdate && canEditMasterItem(item) && (
                                    <button
                                      onClick={() => openEditDialog(item)}
                                      className="p-1.5 rounded-lg text-gray-300 hover:text-teal-600 hover:bg-teal-50 transition-colors group-hover:hidden"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {canDelete && !item.isSystemLocked && (
                                    <button
                                      onClick={() => confirmDelete(item)}
                                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors group-hover:hidden"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                        <span className="text-xs text-gray-400">
                          Page {currentPage} of {totalPages} · {currentValues.total} total
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => loadTab(activeTab, currentPage - 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-teal-300 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Prev
                          </button>
                          <span className="text-xs text-gray-500 font-semibold px-1">{currentPage}</span>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => loadTab(activeTab, currentPage + 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-teal-300 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ── Add / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                {editingItem ? <Pencil className="h-4 w-4 text-teal-600" /> : <Plus className="h-4 w-4 text-teal-600" />}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900">
                  {editingItem ? `Edit "${editingItem.label}"` : `Add to ${activeEntityInfo?.displayName ?? 'list'}`}
                </DialogTitle>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{activeTab}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {editingItem && isCatalogSyncedMaster(editingItem) && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-800">
                <Link2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Linked to Service Catalog. You can edit the display label locally; code, metadata, and active status are managed by catalog sync.
                </span>
              </div>
            )}
            {editingItem && isCatalogSyncedMaster(editingItem) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Code (read-only)</Label>
                <Input value={editingItem.code} readOnly className="h-10 border-gray-200 bg-gray-50 font-mono text-sm" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="label" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Label *</Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label,
                    ...(!editingItem ? { code: deriveCode(label) } : {}),
                  }));
                }}
                placeholder="Display name shown in dropdowns"
                className="h-10 border-gray-200 focus:border-teal-400"
              />
              {!editingItem && form.code && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  System code:
                  <span className="font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                    {form.code}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional — helps users understand this value"
                className="h-10 border-gray-200 focus:border-teal-400"
              />
            </div>
            {!(editingItem && isCatalogSyncedMaster(editingItem)) && (
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="h-10 w-28 border-gray-200 focus:border-teal-400"
                />
              </div>
            )}

            {/* Smart metadata fields */}
            {(() => {
              const schema = ENTITY_META_SCHEMAS[activeTab];
              if (!schema || schema.length === 0) return null;
              const readOnlyMeta = !!(editingItem && isCatalogSyncedMaster(editingItem));
              return (
                <div className="space-y-4 border-t border-gray-100 pt-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {readOnlyMeta ? 'Catalog Metadata (read-only)' : 'Additional Metadata'}
                  </p>
                  {schema.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`meta_${field.key}`} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{field.label}</Label>
                      {readOnlyMeta ? (
                        <Input
                          id={`meta_${field.key}`}
                          value={metaForm[field.key] ?? ''}
                          readOnly
                          className="h-10 border-gray-200 bg-gray-50"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          id={`meta_${field.key}`}
                          value={metaForm[field.key] ?? ''}
                          onChange={(e) => setMetaForm((f) => ({ ...f, [field.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white"
                        >
                          <option value="">Select…</option>
                          {field.options?.map((o) => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => setMetaForm((f) => ({ ...f, [field.key]: f[field.key] === 'true' ? 'false' : 'true' }))}
                        >
                          <div className={`relative w-10 h-6 rounded-full transition-colors ${metaForm[field.key] === 'true' ? 'bg-teal-500' : 'bg-gray-200'}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${metaForm[field.key] === 'true' ? 'translate-x-5' : 'translate-x-1'}`} />
                          </div>
                          <span className="text-sm text-gray-700">{field.label}</span>
                        </div>
                      ) : (
                        <Input
                          id={`meta_${field.key}`}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={metaForm[field.key] ?? ''}
                          onChange={(e) => setMetaForm((f) => ({ ...f, [field.key]: e.target.value }))}
                          className="h-10 border-gray-200 focus:border-teal-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
                </svg>
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all disabled:opacity-60 active:scale-95"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Saving…
                </>
              ) : editingItem ? 'Save Changes' : 'Add Value'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable Dialog ───────────────────────────────────────────── */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <ToggleLeft className="h-4 w-4 text-amber-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-gray-900">Disable Value</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              Disable <strong className="text-gray-900">{disableTarget?.label}</strong>? It will be hidden from dropdowns but kept for historical records.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="disableReason" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason (optional)</Label>
              <Textarea
                id="disableReason"
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="Why is this value being disabled?"
                rows={2}
                maxLength={500}
                className="text-sm border-gray-200 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setDisableDialogOpen(false)}
              disabled={disabling}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDisable}
              disabled={disabling}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm transition-all disabled:opacity-60"
            >
              {disabling ? 'Disabling…' : 'Disable Value'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ────────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-red-100 bg-red-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-gray-900">Delete Value</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              Permanently delete{' '}
              <strong className="text-gray-900">{deleteTarget?.label}</strong>{' '}
              <span className="font-mono text-xs text-gray-400">({deleteTarget?.code})</span>?
              This cannot be undone.
            </p>
            {deleteError && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl">
                <svg className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-700">{deleteError.message}</p>
                  {deleteError.usageCount !== undefined && deleteError.usageCount > 0 && (
                    <p className="mt-0.5 text-xs text-red-500">
                      Referenced by {deleteError.usageCount} record(s). Disable it instead.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {!deleteError && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


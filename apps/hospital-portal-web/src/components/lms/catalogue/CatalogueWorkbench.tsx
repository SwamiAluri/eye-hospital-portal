'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { CatalogueStatusBadge } from '@/components/lms/catalogue/CatalogueStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHasPermission } from '@/hooks/use-permissions';
import {
  createLmsCatalogueDraft,
  listLmsCatalogue,
  type LmsCatalogueListItemDto,
  type LmsCreateCatalogueDraftRequest,
} from '@/lib/api/laboratory-service.api';
import {
  LMS_CATALOGUE_DISCIPLINES,
  LMS_CATALOGUE_TYPES,
  disciplineLabel,
} from '@/lib/lms/catalogue-disciplines';
import { LMS_CATALOGUE_PERMISSIONS, LMS_VIEW } from '@/lib/lms/lms-permissions';

type Props = {
  defaultTypeFilter?: string;
  title?: string;
};

export function CatalogueWorkbench({
  defaultTypeFilter,
  title = 'Test Catalogue',
}: Props) {
  const router = useRouter();
  const canView = useHasPermission(LMS_CATALOGUE_PERMISSIONS.view);
  const canManage = useHasPermission(LMS_CATALOGUE_PERMISSIONS.manage);
  const canApprove = useHasPermission(LMS_CATALOGUE_PERMISSIONS.approve);

  const [items, setItems] = useState<LmsCatalogueListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>(defaultTypeFilter ?? 'all');
  const [discipline, setDiscipline] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsCatalogue({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        catalogueType: type === 'all' ? undefined : type,
        discipline: discipline === 'all' ? undefined : discipline,
        page,
        pageSize: 25,
      });
      setItems(result.items);
      setTotal(result.totalCount);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to load catalogue.';
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, search, status, type, discipline, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const emptyHint = useMemo(() => {
    if (!canView) return 'You do not have lms.catalogue.view.';
    if (search || status !== 'all' || type !== 'all' || discipline !== 'all') {
      return 'No catalogue items match the current filters.';
    }
    return 'No catalogue items yet. Create a controlled draft to begin UAT.';
  }, [canView, search, status, type, discipline]);

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title={title}
        subtitle="Enterprise LMS · governed catalogue (versioned · effective-dated)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || !canView}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                data-testid="catalogue-create-open"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create
              </Button>
            ) : null}
          </div>
        }
      >
        {!canView ? (
          <div
            data-testid="catalogue-unauthorized"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Catalogue view requires <code className="text-xs">lms.catalogue.view</code>. Workspace
            access (<code className="text-xs">lms.view</code>) alone is not sufficient. Role grants
            are deferred (PD-CAT-02); Admin wildcard may be used for UAT.
          </div>
        ) : (
          <div className="space-y-4" data-testid="catalogue-workbench">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="min-w-[200px] flex-1">
                <Label htmlFor="cat-search" className="text-xs text-gray-500">
                  Search
                </Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    id="cat-search"
                    data-testid="catalogue-search"
                    className="pl-8"
                    placeholder="Code, name, synonym…"
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                  />
                </div>
              </div>
              <FilterSelect
                label="Type"
                value={type}
                onChange={(v) => {
                  setPage(1);
                  setType(v);
                }}
                options={[
                  { value: 'all', label: 'All types' },
                  ...LMS_CATALOGUE_TYPES.map((t) => ({ value: t.code, label: t.label })),
                ]}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Review', label: 'Review' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Retired', label: 'Retired' },
                  { value: 'Superseded', label: 'Superseded' },
                ]}
              />
              <FilterSelect
                label="Discipline"
                value={discipline}
                onChange={(v) => {
                  setPage(1);
                  setDiscipline(v);
                }}
                options={[
                  { value: 'all', label: 'All disciplines' },
                  ...LMS_CATALOGUE_DISCIPLINES.map((d) => ({
                    value: d.code,
                    label: d.label,
                  })),
                ]}
              />
            </div>

            <p className="text-xs text-gray-500" data-testid="catalogue-capability-hint">
              Capabilities: view
              {canManage ? ' · manage' : ''}
              {canApprove ? ' · approve' : ''}
              . Clinical reference intervals, critical values, TAT and prices are not configured in
              this slice.
            </p>

            {error ? (
              <div
                data-testid="catalogue-error"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            {loading ? (
              <div data-testid="catalogue-loading" className="text-sm text-gray-500">
                Loading catalogue…
              </div>
            ) : items.length === 0 ? (
              <div
                data-testid="catalogue-empty"
                className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
              >
                {emptyHint}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full min-w-[880px] text-left text-sm" data-testid="catalogue-table">
                  <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Discipline</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Ver</th>
                      <th className="px-3 py-2 font-medium">Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b last:border-0 hover:bg-gray-50/80"
                        data-testid={`catalogue-row-${row.id}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/dashboard/lms/configuration/test-catalogue/${row.id}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {row.internalOrderCode}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.displayName}</td>
                        <td className="px-3 py-2 text-xs">{row.catalogueType}</td>
                        <td className="px-3 py-2 text-xs">{disciplineLabel(row.discipline)}</td>
                        <td className="px-3 py-2">
                          <CatalogueStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs">v{row.versionNumber}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {row.isTenantWide ? 'Tenant-wide' : `${row.branchIds.length} branch(es)`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {total > 25 ? (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {page} · {total} total
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page * 25 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <CreateDraftDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultType={defaultTypeFilter === 'PANEL' ? 'PANEL' : 'TEST'}
          onCreated={(id) => {
            setCreateOpen(false);
            router.push(`/dashboard/lms/configuration/test-catalogue/${id}`);
          }}
        />
      </LmsPageShell>
    </ProtectedRoute>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="w-[180px]">
      <Label className="text-xs text-gray-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateDraftDialog({
  open,
  onOpenChange,
  defaultType,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: 'TEST' | 'PANEL' | 'REFERRAL_TEST';
  onCreated: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [catalogueType, setCatalogueType] = useState(defaultType);
  const [internalOrderCode, setInternalOrderCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [discipline, setDiscipline] = useState(LMS_CATALOGUE_DISCIPLINES[0].code);
  const [changeReason, setChangeReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCatalogueType(defaultType);
      setInternalOrderCode('');
      setDisplayName('');
      setDiscipline(LMS_CATALOGUE_DISCIPLINES[0].code);
      setChangeReason('');
      setFormError(null);
    }
  }, [open, defaultType]);

  async function submit() {
    setFormError(null);
    if (!internalOrderCode.trim() || !displayName.trim()) {
      setFormError('Internal code and display name are required.');
      return;
    }
    setSaving(true);
    try {
      const body: LmsCreateCatalogueDraftRequest = {
        catalogueType,
        internalOrderCode: internalOrderCode.trim(),
        displayName: displayName.trim(),
        discipline,
        changeReason: changeReason.trim() || undefined,
      };
      const created = await createLmsCatalogueDraft(body);
      toast.success('Draft created');
      onCreated(created.id);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create draft.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="catalogue-create-dialog">
        <DialogHeader>
          <DialogTitle>Create catalogue draft</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Type</Label>
            <Select
              value={catalogueType}
              onValueChange={(v) => setCatalogueType(v as typeof catalogueType)}
            >
              <SelectTrigger className="mt-1" data-testid="catalogue-create-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LMS_CATALOGUE_TYPES.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cat-code">Internal order code</Label>
            <Input
              id="cat-code"
              data-testid="catalogue-create-code"
              className="mt-1 font-mono"
              value={internalOrderCode}
              onChange={(e) => setInternalOrderCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cat-name">Display name</Label>
            <Input
              id="cat-name"
              data-testid="catalogue-create-name"
              className="mt-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <Label>Discipline</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LMS_CATALOGUE_DISCIPLINES.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cat-reason">Change reason</Label>
            <Input
              id="cat-reason"
              className="mt-1"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {formError ? (
            <p className="text-sm text-red-600" data-testid="catalogue-create-error">
              {formError}
            </p>
          ) : null}
          <p className="text-xs text-gray-500">
            Saves as <strong>Draft</strong>. Submit for review is explicit — drafts are never
            auto-activated.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="catalogue-create-submit"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { CatalogueStatusBadge } from '@/components/lms/catalogue/CatalogueStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHasPermission } from '@/hooks/use-permissions';
import {
  activateLmsCatalogue,
  approveLmsCatalogue,
  getLmsCatalogueItem,
  retireLmsCatalogue,
  returnLmsCatalogueDraft,
  submitLmsCatalogueReview,
  supersedeLmsCatalogue,
  updateLmsCatalogueDraft,
  type LmsCatalogueItemDetailDto,
} from '@/lib/api/laboratory-service.api';
import { disciplineLabel } from '@/lib/lms/catalogue-disciplines';
import { LMS_CATALOGUE_PERMISSIONS, LMS_VIEW } from '@/lib/lms/lms-permissions';

export function CatalogueDetailView({ itemId }: { itemId: string }) {
  const canView = useHasPermission(LMS_CATALOGUE_PERMISSIONS.view);
  const canManage = useHasPermission(LMS_CATALOGUE_PERMISSIONS.manage);
  const canApprove = useHasPermission(LMS_CATALOGUE_PERMISSIONS.approve);

  const [detail, setDetail] = useState<LmsCatalogueItemDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editReason, setEditReason] = useState('');
  const [branchIdInput, setBranchIdInput] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getLmsCatalogueItem(itemId);
      setDetail(data);
      setEditName(data.currentVersion?.displayName ?? '');
      setEditReason(data.currentVersion?.changeReason ?? '');
      setBranchIdInput((data.currentVersion?.branchIds ?? []).join(', '));
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to load catalogue item.',
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [canView, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const v = detail?.currentVersion;
  const status = v?.status;

  async function runLifecycle(
    label: string,
    action: () => Promise<LmsCatalogueItemDetailDto>,
  ) {
    setBusy(true);
    try {
      const next = await action();
      setDetail(next);
      setEditName(next.currentVersion?.displayName ?? '');
      toast.success(label);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          `${label} failed`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!detail || !v) return;
    setBusy(true);
    try {
      const branchIds = branchIdInput
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const next = await updateLmsCatalogueDraft(detail.id, {
        displayName: editName.trim(),
        changeReason: editReason.trim() || undefined,
        branchIds,
        expectedRowVersion: v.rowVersion,
      });
      setDetail(next);
      toast.success('Draft updated');
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Update failed',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title={v?.displayName ?? 'Catalogue item'}
        subtitle="Enterprise LMS · catalogue detail"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/lms/configuration/test-catalogue">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to list
            </Link>
          </Button>
        }
      >
        {!canView ? (
          <div data-testid="catalogue-detail-unauthorized" className="text-sm text-amber-800">
            Requires <code>lms.catalogue.view</code>.
          </div>
        ) : loading ? (
          <div data-testid="catalogue-detail-loading" className="text-sm text-gray-500">
            Loading…
          </div>
        ) : error ? (
          <div data-testid="catalogue-detail-error" className="text-sm text-red-700">
            {error}
          </div>
        ) : detail && v ? (
          <div className="space-y-6" data-testid="catalogue-detail">
            <header className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{v.displayName}</h2>
                  <p className="mt-1 font-mono text-xs text-gray-500">{v.internalOrderCode}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span>{detail.catalogueType}</span>
                    <span>·</span>
                    <span>{disciplineLabel(v.discipline)}</span>
                    <span>·</span>
                    <span>v{v.versionNumber}</span>
                    <span>·</span>
                    <span>{v.classification}</span>
                  </div>
                </div>
                <CatalogueStatusBadge status={v.status} />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Effective:{' '}
                {v.effectiveFrom
                  ? new Date(v.effectiveFrom).toLocaleString()
                  : 'not set'}{' '}
                →{' '}
                {v.effectiveTo ? new Date(v.effectiveTo).toLocaleString() : 'open'}
              </p>
            </header>

            <section className="flex flex-wrap gap-2" data-testid="catalogue-lifecycle-actions">
              {canManage && status === 'Draft' ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    data-testid="catalogue-action-save-draft"
                    onClick={() => void saveDraft()}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    data-testid="catalogue-action-submit"
                    onClick={() =>
                      void runLifecycle('Submitted for review', () =>
                        submitLmsCatalogueReview(detail.id, {
                          expectedRowVersion: v.rowVersion,
                        }),
                      )
                    }
                  >
                    Submit for review
                  </Button>
                </>
              ) : null}
              {(canManage || canApprove) && status === 'Review' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  data-testid="catalogue-action-return"
                  onClick={() =>
                    void runLifecycle('Returned to draft', () =>
                      returnLmsCatalogueDraft(detail.id, {
                        reason: 'Returned for revision',
                        expectedRowVersion: v.rowVersion,
                      }),
                    )
                  }
                >
                  Return to draft
                </Button>
              ) : null}
              {canApprove && status === 'Review' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  data-testid="catalogue-action-approve"
                  onClick={() =>
                    void runLifecycle('Approved', () =>
                      approveLmsCatalogue(detail.id, {
                        expectedRowVersion: v.rowVersion,
                      }),
                    )
                  }
                >
                  Approve
                </Button>
              ) : null}
              {canApprove && status === 'Approved' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  data-testid="catalogue-action-activate"
                  onClick={() =>
                    void runLifecycle('Activated', () =>
                      activateLmsCatalogue(detail.id, {
                        expectedRowVersion: v.rowVersion,
                      }),
                    )
                  }
                >
                  Activate
                </Button>
              ) : null}
              {canManage && status === 'Active' ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    data-testid="catalogue-action-supersede"
                    onClick={() =>
                      void runLifecycle('Superseded — new draft created', () =>
                        supersedeLmsCatalogue(detail.id, {
                          reason: 'New version required',
                          expectedRowVersion: v.rowVersion,
                        }),
                      )
                    }
                  >
                    Supersede (new version)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    data-testid="catalogue-action-retire"
                    onClick={() =>
                      void runLifecycle('Retired', () =>
                        retireLmsCatalogue(detail.id, {
                          reason: 'Retired',
                          expectedRowVersion: v.rowVersion,
                        }),
                      )
                    }
                  >
                    Retire
                  </Button>
                </>
              ) : null}
            </section>

            {status === 'Draft' && canManage ? (
              <section className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-name">Display name</Label>
                  <Input
                    id="edit-name"
                    className="mt-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-reason">Change reason</Label>
                  <Input
                    id="edit-reason"
                    className="mt-1"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="edit-branches">
                    Branch applicability (platform Branch IDs, comma-separated). Empty = tenant-wide.
                  </Label>
                  <Input
                    id="edit-branches"
                    className="mt-1 font-mono text-xs"
                    value={branchIdInput}
                    onChange={(e) => setBranchIdInput(e.target.value)}
                    placeholder="Leave empty for tenant-wide"
                  />
                </div>
              </section>
            ) : null}

            <Section title="Identity">
              <Field label="Internal code" value={v.internalOrderCode} />
              <Field label="Synonyms" value={v.synonyms} />
              <Field label="Method" value={v.method} />
              <Field label="Orderable" value={String(v.orderable)} />
            </Section>

            <Section title="Order rules">
              <Field
                label="Preparation instruction"
                value={v.preparationInstruction}
                emptyHint="Not configured"
              />
            </Section>

            <Section title="Specimen & logistics">
              <Field label="Specimen type ref" value={v.specimenTypeRef} emptyHint="Not configured" />
              <Field label="Container ref" value={v.containerRef} emptyHint="Not configured" />
              <Field label="Required volume" value={v.requiredVolume} emptyHint="Not configured" />
              <Field
                label="Patient preparation"
                value={v.patientPreparation}
                emptyHint="Not configured"
              />
            </Section>

            <Section title="Performance & routing">
              <Field
                label="Referral partner ref"
                value={v.referralPartnerRef}
                emptyHint="Not configured"
              />
              <Field label="Classification" value={v.classification} />
            </Section>

            <Section title="Result definition">
              <p className="text-xs text-gray-500">
                Reference intervals, critical thresholds, TAT, delta-check and autoverification are
                not configured in L-CAT-01B. Fields remain nullable until governed masters exist.
              </p>
            </Section>

            <Section title="Commercial & governance">
              <Field
                label="Service catalog ref"
                value={v.serviceCatalogRef}
                emptyHint="Not configured — Billing remains financial SoT"
              />
              <Field label="Change reason" value={v.changeReason} />
            </Section>

            <Section title="Branch applicability">
              {v.isTenantWide ? (
                <p className="text-sm text-gray-600">Tenant-wide (no branch rows).</p>
              ) : (
                <ul className="list-disc pl-5 text-sm font-mono text-gray-700">
                  {v.branchIds.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </Section>

            {detail.catalogueType === 'PANEL' ? (
              <Section title="Panel components">
                {v.panelComponents.length === 0 ? (
                  <p className="text-sm text-gray-500">No components on this version.</p>
                ) : (
                  <ol className="space-y-1 text-sm">
                    {v.panelComponents.map((c) => (
                      <li key={c.id} className="font-mono text-xs">
                        {c.sortOrder}. {c.componentInternalCode} — {c.componentDisplayName} (
                        {c.componentVersionId.slice(0, 8)}…)
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            ) : null}

            <Section title="Version history">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="catalogue-version-history">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-1 pr-3">Ver</th>
                      <th className="py-1 pr-3">Status</th>
                      <th className="py-1 pr-3">Effective</th>
                      <th className="py-1">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.versionHistory.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="py-1.5 pr-3">v{h.versionNumber}</td>
                        <td className="py-1.5 pr-3">
                          <CatalogueStatusBadge status={h.status} />
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-gray-500">
                          {h.effectiveFrom
                            ? new Date(h.effectiveFrom).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-1.5 text-xs text-gray-500">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Audit">
              <p className="text-xs text-gray-500">
                Lifecycle mutations write to the platform <code>audit_log</code> via AuthService
                internal API (CREATE_DRAFT, UPDATE_DRAFT, SUBMIT_REVIEW, APPROVE, ACTIVATE, RETIRE,
                SUPERSEDE, CREATE_VERSION). Review audit in the platform audit UI.
              </p>
            </Section>
          </div>
        ) : null}
      </LmsPageShell>
    </ProtectedRoute>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  emptyHint = '—',
}: {
  label: string;
  value?: string | null;
  emptyHint?: string;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value?.trim() ? value : emptyHint}</dd>
    </div>
  );
}

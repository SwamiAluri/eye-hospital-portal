'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_RESULTS_PERMISSIONS, LMS_TESTING_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  authorizeLmsResult,
  createLmsResultDraft,
  getLmsTestingWorkItem,
  parseLmsTestingApiError,
  updateLmsResultDraft,
  verifyLmsResult,
  type LmsTestingWorkItemDetailDto,
} from '@/lib/lms/lms-testing.api';
import { CriticalResultPanel } from '@/components/lms/testing/CriticalResultPanel';

function normalizeDatatype(raw?: string | null): 'Numeric' | 'Qualitative' | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'numeric' || v === 'number' || v === 'quantitative') return 'Numeric';
  if (v === 'qualitative' || v === 'text') return 'Qualitative';
  return null;
}

function statusLabel(status?: string | null): string {
  if (!status) return 'None';
  if (status === 'TechnicalVerified') return 'Technical Verified';
  if (status === 'ClinicallyAuthorized') return 'Clinically Authorized';
  return status;
}

export function ResultDraftEntry(props: {
  orderTestId: string;
  specimenId: string;
  operatingBranchId: string;
}) {
  const router = useRouter();
  const canResult = useHasPermission(LMS_TESTING_PERMISSIONS.result);
  const canVerify = useHasPermission(LMS_TESTING_PERMISSIONS.verify);
  const canAuthorize = useHasPermission(LMS_RESULTS_PERMISSIONS.authorize);
  const canView =
    useHasPermission(LMS_TESTING_PERMISSIONS.view) ||
    useHasPermission(LMS_TESTING_PERMISSIONS.manage) ||
    canResult ||
    canVerify ||
    canAuthorize;

  const [detail, setDetail] = useState<LmsTestingWorkItemDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [numericValue, setNumericValue] = useState('');
  const [qualitativeValue, setQualitativeValue] = useState('');
  const [unit, setUnit] = useState('');
  const [comment, setComment] = useState('');
  const [rowVersion, setRowVersion] = useState<number | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<string | null>(null);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);
  const [verifiedByUserId, setVerifiedByUserId] = useState<string | null>(null);
  const [verifiedAtUtc, setVerifiedAtUtc] = useState<string | null>(null);
  const [verifiedVersionNumber, setVerifiedVersionNumber] = useState<number | null>(null);
  const [authorizedByUserId, setAuthorizedByUserId] = useState<string | null>(null);
  const [authorizedAtUtc, setAuthorizedAtUtc] = useState<string | null>(null);
  const [authorizedVersionNumber, setAuthorizedVersionNumber] = useState<number | null>(null);

  const datatype = useMemo(
    () => normalizeDatatype(detail?.resultDatatype ?? detail?.draft?.resultDatatype),
    [detail],
  );

  const isTechnicalVerified = resultStatus === 'TechnicalVerified';
  const isClinicallyAuthorized = resultStatus === 'ClinicallyAuthorized';
  const isDraft = resultStatus === 'Draft';
  const isReadOnlyResult = isTechnicalVerified || isClinicallyAuthorized;
  const fieldsDisabled =
    !canResult || saving || verifying || authorizing || isReadOnlyResult || !datatype;

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await getLmsTestingWorkItem({
        orderTestId: props.orderTestId,
        specimenId: props.specimenId,
        operatingBranchId: props.operatingBranchId,
      });
      setDetail(d);
      setNumericValue(d.draft?.numericValue ?? '');
      setQualitativeValue(d.draft?.qualitativeValue ?? '');
      setUnit(d.draft?.unit ?? '');
      setComment(d.draft?.comment ?? '');
      setRowVersion(d.draft?.rowVersion ?? null);
      setResultId(d.draft?.id ?? null);
      setResultStatus(d.draft?.status ?? null);
      setCurrentVersionNumber(d.draft?.currentVersionNumber ?? null);
      setVerifiedByUserId(d.draft?.verifiedByUserId ?? null);
      setVerifiedAtUtc(d.draft?.verifiedAtUtc ?? null);
      setVerifiedVersionNumber(d.draft?.verifiedVersionNumber ?? null);
      setAuthorizedByUserId(d.draft?.authorizedByUserId ?? null);
      setAuthorizedAtUtc(d.draft?.authorizedAtUtc ?? null);
      setAuthorizedVersionNumber(d.draft?.authorizedVersionNumber ?? null);
    } catch (e) {
      setError(parseLmsTestingApiError(e, 'Failed to load Testing work item.').message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [canView, props.orderTestId, props.specimenId, props.operatingBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!canResult || !detail || isReadOnlyResult) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!resultId) {
        const created = await createLmsResultDraft({
          orderTestId: props.orderTestId,
          specimenId: props.specimenId,
          operatingBranchId: props.operatingBranchId,
          numericValue: datatype === 'Numeric' ? numericValue || null : null,
          qualitativeValue: datatype === 'Qualitative' ? qualitativeValue || null : null,
          unit: unit || null,
          comment: comment || null,
        });
        setResultId(created.id);
        setRowVersion(created.rowVersion);
        setResultStatus(created.status);
        setCurrentVersionNumber(created.currentVersionNumber);
        setSuccess('Result Draft created. This is not a released clinical result.');
      } else {
        if (rowVersion == null) throw new Error('Missing row version.');
        const updated = await updateLmsResultDraft(resultId, {
          operatingBranchId: props.operatingBranchId,
          expectedRowVersion: rowVersion,
          numericValue: datatype === 'Numeric' ? numericValue || null : null,
          qualitativeValue: datatype === 'Qualitative' ? qualitativeValue || null : null,
          unit: unit || null,
          comment: comment || null,
        });
        setRowVersion(updated.rowVersion);
        setResultStatus(updated.status);
        setCurrentVersionNumber(updated.currentVersionNumber);
        setSuccess('Result Draft updated. This is not a released clinical result.');
      }
      await load();
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Failed to save Result Draft.');
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  }

  async function onVerify() {
    if (!canVerify || !resultId || !isDraft || rowVersion == null) return;
    setVerifying(true);
    setError(null);
    setSuccess(null);
    try {
      const verified = await verifyLmsResult(resultId, {
        operatingBranchId: props.operatingBranchId,
        expectedRowVersion: rowVersion,
        expectedCurrentVersionNumber: currentVersionNumber ?? undefined,
      });
      setRowVersion(verified.rowVersion);
      setResultStatus(verified.status);
      setCurrentVersionNumber(verified.currentVersionNumber);
      setVerifiedByUserId(verified.verifiedByUserId ?? null);
      setVerifiedAtUtc(verified.verifiedAtUtc ?? null);
      setVerifiedVersionNumber(verified.verifiedVersionNumber ?? null);
      setSuccess(
        'Technical Verification completed. This is not Clinical Authorization, Final, or a released report.',
      );
      await load();
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Technical Verification failed.');
      setError(parsed.message);
    } finally {
      setVerifying(false);
    }
  }

  async function onAuthorize() {
    if (!canAuthorize || !resultId || !isTechnicalVerified || rowVersion == null) return;
    setAuthorizing(true);
    setError(null);
    setSuccess(null);
    try {
      const authorized = await authorizeLmsResult(resultId, {
        operatingBranchId: props.operatingBranchId,
        expectedRowVersion: rowVersion,
        expectedCurrentVersionNumber: currentVersionNumber ?? undefined,
      });
      setRowVersion(authorized.rowVersion);
      setResultStatus(authorized.status);
      setCurrentVersionNumber(authorized.currentVersionNumber);
      setAuthorizedByUserId(authorized.authorizedByUserId ?? null);
      setAuthorizedAtUtc(authorized.authorizedAtUtc ?? null);
      setAuthorizedVersionNumber(authorized.authorizedVersionNumber ?? null);
      setSuccess(
        'Clinically authorized. This is not Final, Released, or patient-visible.',
      );
      await load();
    } catch (e) {
      const parsed = parseLmsTestingApiError(e, 'Clinical Authorization failed.');
      setError(parsed.message);
    } finally {
      setAuthorizing(false);
    }
  }

  if (!canView) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        data-testid="result-draft-unauthorized"
      >
        You do not have permission to view LMS Testing.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground" data-testid="result-draft-loading">
        Loading work item…
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div
        className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        data-testid="result-draft-error"
        role="alert"
      >
        <p>{error}</p>
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/lms/testing')}>
          Back to Testing queue
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-6" data-testid="result-draft-entry">
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Context</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Patient</dt>
            <dd>
              {detail.patientName || '—'} · {detail.patientMrn || detail.patientId}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Order</dt>
            <dd>{detail.orderNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Test</dt>
            <dd>
              {detail.testDisplayName} ({detail.internalOrderCode})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Specimen</dt>
            <dd>
              {detail.accession || 'No accession'} · {detail.specimenStatus}
              {detail.barcodeValue ? ` · ${detail.barcodeValue}` : ' · barcode optional'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Catalogue datatype</dt>
            <dd>{detail.resultDatatype || 'Not configured'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Result status</dt>
            <dd data-testid="result-draft-status">{statusLabel(resultStatus)}</dd>
          </div>
          {currentVersionNumber != null && (
            <div>
              <dt className="text-xs text-muted-foreground">Current version</dt>
              <dd data-testid="result-current-version">{currentVersionNumber}</dd>
            </div>
          )}
        </dl>
      </div>

      {(isTechnicalVerified || isClinicallyAuthorized) && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          data-testid="result-technical-verified-banner"
        >
          <p className="font-medium">Technical Verified</p>
          <p className="mt-1 text-xs text-emerald-900">
            Analytical/technical verification completed. Not Final, released, or patient-visible.
          </p>
          <dl className="mt-3 grid gap-1 text-xs md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Verified by (user id)</dt>
              <dd data-testid="result-verified-by">{verifiedByUserId || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Verified at (UTC)</dt>
              <dd data-testid="result-verified-at">{verifiedAtUtc || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Verified version</dt>
              <dd data-testid="result-verified-version">{verifiedVersionNumber ?? '—'}</dd>
            </div>
          </dl>
        </div>
      )}

      {isClinicallyAuthorized && (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"
          data-testid="result-clinically-authorized-banner"
        >
          <p className="font-medium">Clinically Authorized</p>
          <p className="mt-1 text-xs text-sky-900" data-testid="result-authorized-honesty">
            Clinically authorized. This is not Final, Released, or patient-visible.
          </p>
          <dl className="mt-3 grid gap-1 text-xs md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Authorized by (user id)</dt>
              <dd data-testid="result-authorized-by">{authorizedByUserId || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Authorized at (UTC)</dt>
              <dd data-testid="result-authorized-at">{authorizedAtUtc || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Authorized version</dt>
              <dd data-testid="result-authorized-version">{authorizedVersionNumber ?? '—'}</dd>
            </div>
          </dl>
        </div>
      )}

      {(isTechnicalVerified || isClinicallyAuthorized) && (
        <CriticalResultPanel
          resultId={resultId}
          resultStatus={resultStatus}
          currentVersionNumber={currentVersionNumber}
          operatingBranchId={props.operatingBranchId}
        />
      )}

      {!datatype && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="result-draft-unsupported-datatype"
          role="alert"
        >
          Active catalogue definition does not provide a usable result datatype for draft entry.
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="result-draft-save-error"
          role="alert"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-testid="result-draft-success"
        >
          {success}
        </div>
      )}

      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">
          {isReadOnlyResult ? 'Result (read-only)' : 'Manual Result Draft'}
        </h2>
        <p className="text-xs text-muted-foreground">
          No Final/release, abnormal flags, critical thresholds, amendments, or patient publication in
          this surface.
        </p>

        {datatype === 'Numeric' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="numeric-value">Numeric value</Label>
              <Input
                id="numeric-value"
                value={numericValue}
                onChange={(e) => setNumericValue(e.target.value)}
                disabled={fieldsDisabled}
                data-testid="result-numeric-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-value">Unit</Label>
              <Input
                id="unit-value"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={fieldsDisabled}
                placeholder={detail.permittedUnits || undefined}
                data-testid="result-unit-input"
              />
            </div>
          </div>
        )}

        {datatype === 'Qualitative' && (
          <div className="space-y-1.5">
            <Label htmlFor="qual-value">Qualitative value</Label>
            <Input
              id="qual-value"
              value={qualitativeValue}
              onChange={(e) => setQualitativeValue(e.target.value)}
              disabled={fieldsDisabled}
              data-testid="result-qualitative-input"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="comment-value">Comment</Label>
          <Textarea
            id="comment-value"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={fieldsDisabled}
            rows={3}
            data-testid="result-comment-input"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {!isReadOnlyResult && (
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={!canResult || saving || verifying || authorizing || !datatype}
              data-testid="result-draft-save"
            >
              {saving ? 'Saving…' : resultId ? 'Update draft' : 'Create draft'}
            </Button>
          )}
          {isDraft && resultId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onVerify()}
              disabled={!canVerify || verifying || saving || authorizing}
              data-testid="result-verify-action"
            >
              {verifying ? 'Verifying…' : 'Technical Verification'}
            </Button>
          )}
          {isTechnicalVerified && resultId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAuthorize()}
              disabled={!canAuthorize || authorizing || verifying || saving}
              data-testid="result-authorize-action"
            >
              {authorizing ? 'Authorizing…' : 'Clinical Authorization'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/lms/testing')}
            data-testid="result-draft-back"
          >
            Back to queue
          </Button>
        </div>

        {!canResult && !isReadOnlyResult && (
          <p className="text-xs text-amber-800" data-testid="result-draft-readonly">
            View only — `lms.testing.result` is required to create or update drafts.
          </p>
        )}
        {isDraft && !canVerify && (
          <p className="text-xs text-amber-800" data-testid="result-verify-readonly">
            Technical Verification requires `lms.testing.verify`. This is not Clinical Authorization.
          </p>
        )}
        {isTechnicalVerified && !canAuthorize && (
          <p className="text-xs text-amber-800" data-testid="result-authorize-readonly">
            Clinical Authorization requires `lms.results.authorize`. This is not Final or Released.
          </p>
        )}
        {isReadOnlyResult && (
          <p className="text-xs text-muted-foreground" data-testid="result-draft-locked">
            Draft editing is disabled after Technical Verification or Clinical Authorization.
          </p>
        )}
      </div>
    </div>
  );
}

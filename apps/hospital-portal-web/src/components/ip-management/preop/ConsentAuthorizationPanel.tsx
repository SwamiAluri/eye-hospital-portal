'use client';

import { useCallback, useMemo, useState } from 'react';
import { FileText, Loader2, Pencil, RotateCcw, ShieldX } from 'lucide-react';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import {
  ipManagementApi,
  type PreOpClearanceDetailDto,
  type PreOpCompletionDto,
  type PreOpConsentDetailDto,
  type PreOpDocumentDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { StatusChip } from './primitives/StatusChip';
import { ActionMenu, type ActionMenuItem } from './primitives/ActionMenu';
import { InvestigationDocumentModal } from '@/components/ip-management/investigations/InvestigationDocumentModal';
import { ConsentCaptureModal, type ConsentCaptureItemMeta } from './ConsentCaptureModal';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';

export interface ConsentAuthorizationPanelProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  /** Operative eye, shown read-only against the site-marking writer. */
  eyeOperated?: string;
  readOnly?: boolean;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

interface ConsentItemMeta extends ConsentCaptureItemMeta {
  /** Primary medico-legal fact — emphasised in the capture action. */
  primary?: boolean;
}

/**
 * Canonical consent/authorization writers (blueprint §4 merge). Clean labels only —
 * no descriptions, no decorative icons. Each row declares only the fields it legally
 * needs, so the capture modal never over-asks.
 */
const CONSENT_ITEMS: ConsentItemMeta[] = [
  { key: 'identity_verified', label: 'Patient identity verified', signLabel: 'Identity verified against photo ID', docType: 'IdentityProof', docLabel: 'Identity proof' },
  { key: 'surgery_site_marked', label: 'Surgery site marked', site: true },
  { key: 'surgery_consent_signed', label: 'Surgical consent signed', signLabel: 'Signed by patient / legal guardian', docType: 'ConsentForm', docLabel: 'Signed consent PDF', requireUpload: true, showWitness: true, showMethod: true, showVersion: true, primary: true },
  { key: 'anaesthesia_consent_signed', label: 'Anaesthesia consent signed', signLabel: 'Signed by patient / legal guardian', showMethod: true },
  { key: 'hospital_policy_consent', label: 'Hospital policies acknowledged', signLabel: 'Acknowledged by patient / guardian' },
  { key: 'blood_transfusion_consent', label: 'Blood transfusion consent', signLabel: 'Signed by patient / legal guardian', showWitness: true },
];

function formatSignedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ConsentAuthorizationPanel({
  journeyId,
  paymentMode,
  eyeOperated,
  readOnly = false,
  onChanged,
}: ConsentAuthorizationPanelProps) {
  const { detail, loading, error, patchDetail, afterMutation } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [capture, setCapture] = useState<{ key: string; reconsent: boolean } | null>(null);
  const [revokeKey, setRevokeKey] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreOpDocumentDto | null>(null);

  const applyDetail = useCallback(
    (updated: Parameters<typeof patchDetail>[0]) => {
      patchDetail(updated);
      afterMutation();
    },
    [patchDetail, afterMutation],
  );

  const byKey = useMemo(() => {
    const m = new Map<string, PreOpCompletionDto>();
    for (const c of detail?.completions ?? []) m.set(c.itemKey, c);
    return m;
  }, [detail]);

  const detailByCompletion = useMemo(() => {
    const m = new Map<string, PreOpConsentDetailDto>();
    for (const d of detail?.consentDetails ?? []) m.set(d.completionId, d);
    return m;
  }, [detail]);

  const docById = useCallback(
    (id: string | null): PreOpDocumentDto | null =>
      id ? (detail?.documents ?? []).find(d => d.id === id) ?? null : null,
    [detail],
  );

  const items = CONSENT_ITEMS.filter(meta => byKey.has(meta.key));

  function itemStatus(meta: ConsentItemMeta, completion: PreOpCompletionDto, cdetail: PreOpConsentDetailDto | null): PreOpStatus {
    if (!completion.isCompleted) return cdetail?.revokedAt ? 'revoked' : 'not-started';
    if (meta.requireUpload && !docById(completion.documentId)) return 'pending-verification';
    return 'completed';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading consent & authorization…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        No consent items are configured for this journey.
      </div>
    );
  }

  const activeMeta = capture ? items.find(m => m.key === capture.key) ?? null : null;
  const activeCompletion = activeMeta ? byKey.get(activeMeta.key) ?? null : null;
  const revokeMeta = revokeKey ? items.find(m => m.key === revokeKey) ?? null : null;
  const revokeCompletion = revokeMeta ? byKey.get(revokeMeta.key) ?? null : null;

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.consentPanel} className="space-y-3">
      {/* Count lives on the step rail (single source) — header carries only the title. */}
      <h3 className="text-sm font-semibold text-gray-900">Consent &amp; Authorization</h3>

      {/* Flat consent table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2" style={{ width: '32%' }}>Consent</th>
              <th className="px-3 py-2" style={{ width: '16%' }}>Status</th>
              <th className="px-3 py-2" style={{ width: '26%' }}>Signed by · when</th>
              <th className="px-3 py-2" style={{ width: '14%' }}>Document</th>
              <th className="px-3 py-2 text-right" style={{ width: '12%' }} />
            </tr>
          </thead>
          <tbody>
            {items.map(meta => {
              const completion = byKey.get(meta.key)!;
              const cdetail = detailByCompletion.get(completion.id) ?? null;
              const status = itemStatus(meta, completion, cdetail);
              const doc = docById(completion.documentId);
              const signer = cdetail?.capturedByName ?? null;
              const when = formatSignedAt(cdetail?.signedAt ?? completion.completedAt ?? null);
              const done = completion.isCompleted;

              const menuItems: ActionMenuItem[] = [
                {
                  id: 'edit',
                  label: 'Edit details',
                  icon: Pencil,
                  onSelect: () => setCapture({ key: meta.key, reconsent: false }),
                },
                {
                  id: 'reconsent',
                  label: 'Re-consent',
                  icon: RotateCcw,
                  onSelect: () => setCapture({ key: meta.key, reconsent: true }),
                },
                {
                  id: 'revoke',
                  label: 'Revoke consent',
                  icon: ShieldX,
                  destructive: true,
                  onSelect: () => setRevokeKey(meta.key),
                },
              ];

              return (
                <tr
                  key={meta.key}
                  data-testid={WARD_PREOP_TEST_IDS.consentItem(meta.key)}
                  className="border-b border-gray-100 last:border-0 align-middle"
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-gray-900">{meta.label}</span>
                    {completion.isBlocking && !done && (
                      <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        Required
                      </span>
                    )}
                    {meta.site && (
                      <span className="ml-2 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                        {eyeOperated || '—'}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    <StatusChip status={status} size="sm" />
                    {status === 'revoked' && cdetail?.revokedReason && (
                      <span className="ml-2 text-xs text-gray-500">{cdetail.revokedReason}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-gray-600">
                    {signer || when ? (
                      <span className="text-xs">
                        {signer && <span className="font-medium text-gray-800">{signer}</span>}
                        {signer && when && <span className="text-gray-400"> · </span>}
                        {when}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {doc ? (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        View
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right">
                    {!readOnly && (
                      done ? (
                        <ActionMenu items={menuItems} label={`${meta.label} actions`} className="align-middle" />
                      ) : (
                        <button
                          type="button"
                          data-testid={WARD_PREOP_TEST_IDS.consentCapture(meta.key)}
                          onClick={() => setCapture({ key: meta.key, reconsent: false })}
                          className={[
                            'rounded-md px-2.5 py-1 text-xs font-medium',
                            meta.primary
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {status === 'revoked' ? 'Re-capture' : 'Capture'}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Capture / edit / re-consent modal */}
      {activeMeta && activeCompletion && capture && (
        <ConsentCaptureModal
          open
          journeyId={journeyId}
          meta={activeMeta}
          completion={activeCompletion}
          detail={detailByCompletion.get(activeCompletion.id) ?? null}
          existingDoc={docById(activeCompletion.documentId)}
          eyeOperated={eyeOperated}
          reconsent={capture.reconsent}
          onClose={() => setCapture(null)}
          onSaved={updated => { applyDetail(updated); }}
        />
      )}

      {/* Revoke reason modal */}
      {revokeMeta && revokeCompletion && (
        <RevokeConsentModal
          journeyId={journeyId}
          itemLabel={revokeMeta.label}
          itemId={revokeCompletion.itemId}
          onClose={() => setRevokeKey(null)}
          onRevoked={updated => { applyDetail(updated); setRevokeKey(null); }}
        />
      )}

      {/* In-page document preview */}
      <InvestigationDocumentModal
        open={!!previewDoc}
        fileName={previewDoc?.fileName ?? null}
        fileUrl={previewDoc?.fileUrl ?? null}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}

function RevokeConsentModal({
  journeyId,
  itemId,
  itemLabel,
  onClose,
  onRevoked,
}: {
  journeyId: string;
  itemId: string;
  itemLabel: string;
  onClose: () => void;
  onRevoked: (detail: PreOpClearanceDetailDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const updated = await ipManagementApi.revokeConsent(journeyId, itemId, { reason: reason.trim() });
      onRevoked(updated);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e as Error)?.message ??
        'Could not revoke consent. Please try again.';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IpOverlayDialog
      onClose={onClose}
      size="md"
      title={`Revoke — ${itemLabel}`}
      testId={WARD_PREOP_TEST_IDS.consentRevokeModal}
      dismissOnOverlay
    >
      <div>
        <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <ShieldX className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Revoke — {itemLabel}</h3>
        </header>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-gray-600">
            Withdrawing this consent clears the completion and is recorded for audit. A reason is required.
          </p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for revocation (e.g. patient withdrew consent)"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim() || submitting}
            data-testid={WARD_PREOP_TEST_IDS.consentRevokeSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Revoke consent
          </button>
        </footer>
      </div>
    </IpOverlayDialog>
  );
}

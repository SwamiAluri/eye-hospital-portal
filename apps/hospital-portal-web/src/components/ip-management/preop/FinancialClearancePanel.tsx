'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckSquare, Square, Upload, Loader2, Circle, CheckCircle2 } from 'lucide-react';
import {
  ipManagementApi,
  type PreOpCompletionDto,
  type PreOpDocumentDto,
  type PreauthStatusDto,
} from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { StatusChip } from './primitives/StatusChip';
import { InvestigationDocumentPreview } from '@/components/ip-management/investigations/InvestigationDocumentPreview';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';

export interface FinancialClearancePanelProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  /** Canonical financial truth — read-only here, mirrored everywhere else. */
  financialState?: string;
  balanceDue?: number;
  packageAmount?: number;
  totalPaid?: number;
  isEmergencyFc?: boolean;
  readOnly?: boolean;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

interface FinancialItemMeta {
  key: string;
  label: string;
  docType?: string;
  docLabel?: string;
  /** Insurance pre-auth — the CCMS hard block (G11). Status carries the admit-gate meaning. */
  preauth?: boolean;
}

/**
 * Manually-actionable rows only. `payment_mode_confirmed` and `advance_paid` are
 * intentionally NOT here — they are department-fed (counselling payer / billing
 * advance) and rendered read-only via DerivedTick below; the ward never edits them.
 */
const FINANCIAL_ITEMS: FinancialItemMeta[] = [
  { key: 'insurance_preauth_approved', label: 'Insurance pre-authorization approved', preauth: true },
  { key: 'emergency_fc_confirmed', label: 'Emergency FC status noted' },
  { key: 'cghs_approval_uploaded', label: 'CGHS approval uploaded', docType: 'InsuranceDoc', docLabel: 'CGHS approval' },
  { key: 'esi_referral_uploaded', label: 'ESI referral uploaded', docType: 'InsuranceDoc', docLabel: 'ESI referral' },
  { key: 'camp_sponsorship_uploaded', label: 'Camp sponsorship uploaded', docType: 'InsuranceDoc', docLabel: 'Sponsorship proof' },
];

const PAID_STATES = ['Paid', 'Settled', 'Confirmed'];

function formatInr(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

export function FinancialClearancePanel({
  journeyId,
  paymentMode,
  financialState,
  balanceDue,
  packageAmount,
  totalPaid,
  isEmergencyFc = false,
  readOnly = false,
  onChanged,
}: FinancialClearancePanelProps) {
  const {
    detail,
    loading,
    error,
    patchDetail,
    reloadClearance,
    afterMutation,
  } = usePreOpClearanceData({ journeyId, paymentMode, onChanged });
  const [preauth, setPreauth] = useState<PreauthStatusDto | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    const hasPreauthRow = (detail?.completions ?? []).some(
      c => c.itemKey === 'insurance_preauth_approved',
    );
    if (!hasPreauthRow) {
      setPreauth(null);
      return;
    }
    void ipManagementApi.getPreauthStatus(journeyId).then(status => {
      if (active) setPreauth(status);
    });
    return () => {
      active = false;
    };
  }, [detail?.completions, journeyId]);

  const byKey = new Map<string, PreOpCompletionDto>();
  for (const c of detail?.completions ?? []) byKey.set(c.itemKey, c);

  const docById = (id: string | null): PreOpDocumentDto | null =>
    id ? (detail?.documents ?? []).find(d => d.id === id) ?? null : null;

  const items = FINANCIAL_ITEMS.filter(meta => byKey.has(meta.key));

  const preauthItem = byKey.get('insurance_preauth_approved');
  const preauthApproved = !!preauthItem?.isCompleted;

  const billSatisfied =
    !!byKey.get('bill_payment_confirmed')?.isCompleted
    || isEmergencyFc
    || (balanceDue != null && balanceDue <= 0)
    || (!!financialState && PAID_STATES.includes(financialState));

  // Department-fed (read-only) signals — never ticked by the ward.
  const paymentModeKnown = !!paymentMode;
  const advanceReceived = (totalPaid ?? 0) > 0;

  /** Patch a single completion locally so the row reflects the save without a full reload (D5). */
  const patchCompletion = useCallback(
    (updated: PreOpCompletionDto | null) => {
      if (!updated) return;
      patchDetail(prev =>
        prev
          ? { ...prev, completions: prev.completions.map(c => (c.id === updated.id ? updated : c)) }
          : prev,
      );
    },
    [patchDetail],
  );

  async function persist(completion: PreOpCompletionDto, isCompleted: boolean, notesOverride?: string) {
    if (readOnly) return;
    const notes = notesOverride ?? completion.notes ?? undefined;
    setSaving(completion.itemKey);
    // Optimistic flip (D5) — reconciled by the server response below.
    patchCompletion({ ...completion, isCompleted, notes: notes ?? null });
    try {
      const saved = await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted,
        isBypassed: false,
        notes,
        documentId: completion.documentId ?? undefined,
      });
      if (saved) patchCompletion(saved);
      else await reloadClearance();
    } catch {
      await reloadClearance();
    } finally {
      setSaving(null);
      afterMutation();
    }
  }

  /** Toggle handler — captures an override reason when manually approving pre-auth that CCMS has not cleared. */
  async function handleToggle(meta: FinancialItemMeta, completion: PreOpCompletionDto, next: boolean) {
    if (readOnly) return;
    if (meta.preauth && next && preauth && !preauth.allowed) {
      const reason = window.prompt(
        'CCMS has not approved this pre-authorization yet. Enter a reason to override and mark it approved:',
        '',
      );
      if (reason == null || reason.trim() === '') return; // cancelled or empty → abort
      await persist(completion, true, `Override: ${reason.trim()}`);
      return;
    }
    await persist(completion, next);
  }

  async function handleUpload(meta: FinancialItemMeta, completion: PreOpCompletionDto, file: File) {
    if (readOnly || !meta.docType) return;
    setSaving(completion.itemKey);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const doc = await ipManagementApi.uploadPreOpDocument(journeyId, {
        documentType: meta.docType,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileData: base64,
      });
      await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted: true,
        isBypassed: false,
        notes: completion.notes ?? undefined,
        documentId: doc?.id ?? completion.documentId ?? undefined,
      });
      // Document + completion changed together — reload to pick up the new document row.
      await reloadClearance();
    } finally {
      setSaving(null);
      afterMutation();
    }
  }

  function itemStatus(meta: FinancialItemMeta, completion: PreOpCompletionDto): PreOpStatus {
    if (meta.preauth) return completion.isCompleted ? 'verified' : 'blocked';
    if (!completion.isCompleted) return 'not-started';
    if (meta.docType && !docById(completion.documentId)) return 'pending-verification';
    return 'completed';
  }

  function statusLabel(meta: FinancialItemMeta, completion: PreOpCompletionDto): string | undefined {
    if (meta.preauth) return completion.isCompleted ? 'Approved' : 'Blocks admit';
    return undefined;
  }

  /** Minimal read-only row for department-fed items — no controls, no source chrome. */
  function renderDerivedRow(key: string, label: string, satisfied: boolean, pendingLabel: string) {
    const Icon = satisfied ? CheckCircle2 : Circle;
    return (
      <div
        key={key}
        data-testid={WARD_PREOP_TEST_IDS.financialItem(key)}
        className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 ${
          satisfied ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Icon
            className={`h-5 w-5 shrink-0 ${satisfied ? 'text-emerald-600' : 'text-gray-300'}`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-900">{label}</span>
        </div>
        <StatusChip
          status={satisfied ? 'completed' : 'not-started'}
          label={satisfied ? 'Confirmed' : pendingLabel}
          size="sm"
          className="shrink-0"
        />
      </div>
    );
  }

  /** One-line live CCMS guidance for the pre-auth row (read-only; manual tick remains the gate). */
  function preauthLiveText(p: PreauthStatusDto): string {
    const parts: string[] = [];
    if (p.allowed) parts.push('CCMS: Approved');
    else if (p.warningLevel === 'block') parts.push('CCMS: Pre-auth required');
    else parts.push(p.warningMessage ? `CCMS: ${p.warningMessage}` : 'CCMS: Pending');
    if (p.preAuthNumber) parts.push(`Auth #${p.preAuthNumber}`);
    if (p.approvedAmount != null) parts.push(formatInr(p.approvedAmount));
    return parts.join(' · ');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading financial clearance…
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

  const outstanding = balanceDue ?? 0;
  const balanceTone = isEmergencyFc
    ? 'text-orange-700'
    : outstanding > 0
      ? 'text-red-700'
      : 'text-emerald-700';

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.financialPanel} className="space-y-4">
      {/* Count lives on the step rail (single source) — header carries only the title. */}
      <h3 className="text-sm font-semibold text-gray-900">Financial Clearance</h3>

      {/* Single-source financial summary */}
      <div
        data-testid={WARD_PREOP_TEST_IDS.financialSummary}
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 sm:grid-cols-4"
      >
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Payment mode</p>
          {paymentMode ? (
            <p className="mt-0.5 text-sm font-medium text-gray-800">{paymentMode}</p>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-amber-700">Not set</p>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Package</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">{formatInr(packageAmount)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Paid</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">{formatInr(totalPaid)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Outstanding</p>
          <p
            data-testid={WARD_PREOP_TEST_IDS.financialBalance}
            className={`mt-0.5 text-sm font-semibold ${balanceTone}`}
          >
            {isEmergencyFc ? 'Emergency FC' : formatInr(outstanding)}
          </p>
        </div>
      </div>

      {/* Writer rows */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No financial clearance items are configured for this payment mode.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(meta => {
            const completion = byKey.get(meta.key)!;
            const done = completion.isCompleted;
            const doc = docById(completion.documentId);
            const isSaving = saving === meta.key;
            const emphasise = meta.preauth && !done;

            return (
              <div
                key={meta.key}
                data-testid={WARD_PREOP_TEST_IDS.financialItem(meta.key)}
                className={[
                  'rounded-xl border px-3 py-2.5',
                  emphasise ? 'border-red-200 bg-red-50/30' : done ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-200 bg-white',
                ].join(' ')}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    disabled={readOnly || isSaving}
                    data-testid={WARD_PREOP_TEST_IDS.financialToggle(meta.key)}
                    onClick={() => handleToggle(meta, completion, !done)}
                    className="mt-0.5 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    ) : done ? (
                      <CheckSquare className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-gray-900">{meta.label}</span>
                      {completion.isBlocking && !done && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                          Required
                        </span>
                      )}
                    </div>

                    {meta.preauth && preauth && (
                      <p
                        data-testid={WARD_PREOP_TEST_IDS.financialPreauthLive}
                        className={`mt-1 text-xs ${
                          preauth.allowed
                            ? 'text-emerald-600'
                            : preauth.warningLevel === 'block'
                              ? 'text-red-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {preauthLiveText(preauth)}
                      </p>
                    )}

                    {meta.docType && (
                      <div className="mt-2 space-y-1.5">
                        {doc ? (
                          <InvestigationDocumentPreview
                            fileName={doc.fileName}
                            fileUrl={doc.fileUrl}
                            contentType={doc.contentType}
                            compact
                          />
                        ) : (
                          !readOnly && (
                            <>
                              <input
                                ref={el => { fileInputs.current[meta.key] = el; }}
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleUpload(meta, completion, f);
                                  e.target.value = '';
                                }}
                              />
                              <button
                                type="button"
                                disabled={isSaving}
                                data-testid={WARD_PREOP_TEST_IDS.financialUpload(meta.key)}
                                onClick={() => fileInputs.current[meta.key]?.click()}
                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              >
                                <Upload className="h-3.5 w-3.5" /> Upload {meta.docLabel}
                              </button>
                            </>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <StatusChip
                    status={itemStatus(meta, completion)}
                    label={statusLabel(meta, completion)}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Department-fed rows — read-only (counselling payer / billing advance) */}
      {(byKey.has('payment_mode_confirmed')
        || byKey.has('advance_paid')
        || byKey.has('bill_payment_confirmed')) && (
        <div data-testid={WARD_PREOP_TEST_IDS.financialDerivedGroup} className="space-y-2">
          {byKey.has('payment_mode_confirmed')
            && renderDerivedRow('payment_mode_confirmed', 'Payment mode confirmed', paymentModeKnown, 'Not set')}
          {byKey.has('advance_paid')
            && renderDerivedRow('advance_paid', 'Advance payment received', advanceReceived, 'Pending')}
          {byKey.has('bill_payment_confirmed')
            && renderDerivedRow('bill_payment_confirmed', 'Bill payment confirmation', billSatisfied, 'Pending')}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Lock,
  PenLine,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronRight,
  Circle,
} from 'lucide-react';
import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import {
  CLINICAL_EVAL_STRUCTURED_KEYS,
  completionByKey,
  getPreOpDiagnosisFromClearance,
} from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { StatusChip } from './primitives/StatusChip';
import { ClinicalEvaluationForm } from './ClinicalEvaluationForm';
import { DepartmentClearancePanel } from '@/components/ip-management/department-clearance/DepartmentClearancePanel';

export interface ClinicalEvaluationPanelProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  procedureName?: string;
  eyeOperated?: string;
  currentUserDeptCode?: string;
  forceReadOnly?: boolean;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

/** §2 "Evaluation" departmental clearance category — the canonical doctor sign-off list. */
const EVAL_CATEGORY = 'Evaluation';

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Step ② Clinical Evaluation. State-aware:
 *  • Expected  → locked preview until admission (R4/G2).
 *  • Admitted+ → structured clinical form (Phase 5 single writer for pre-op diagnosis)
 *                plus the §2 departmental coordination engine (Request / Respond / Confirm).
 */
export function ClinicalEvaluationPanel({
  journeyId,
  clinicalState,
  paymentMode,
  procedureName,
  eyeOperated,
  currentUserDeptCode,
  forceReadOnly,
  onChanged,
}: ClinicalEvaluationPanelProps) {
  const { detail, loading, error } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const locked = clinicalState === 'Expected';
  const evalItems = (detail?.completions ?? []).filter(c => c.category === EVAL_CATEGORY);

  const signoff = completionByKey(evalItems, 'doctor_evaluation_signed') ?? null;
  const signed = !!signoff?.isCompleted;
  const signedAt = formatTimestamp(signoff?.completedAt ?? null);

  const risk = completionByKey(evalItems, 'risk_classification') ?? null;
  const riskValue = risk?.isCompleted ? (risk.resultValue?.trim() || risk.notes?.trim() || 'Classified') : null;
  const diagnosisPreview = getPreOpDiagnosisFromClearance(evalItems);

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.clinicalEvalPanel} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Clinical Evaluation</h3>
        {locked && <StatusChip status="not-started" size="sm" label="Locked until admission" />}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading clinical evaluation…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!loading && !error && locked && (
        <LockedView
          items={evalItems}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen(o => !o)}
        />
      )}

      {!loading && !error && !locked && (
        <>
          <div
            data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoff}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
          >
            {signed ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                Signed off{signedAt ? ` · ${signedAt}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Awaiting doctor sign-off
              </span>
            )}
            {riskValue ? (
              <StatusChip status="completed" size="sm" label={`Risk: ${riskValue}`} />
            ) : (
              <StatusChip status="not-started" size="sm" label="Risk class pending" />
            )}
            {diagnosisPreview && (
              <span className="text-xs text-gray-600">
                Dx: <span className="font-medium text-gray-800">{diagnosisPreview}</span>
              </span>
            )}
          </div>

          <ClinicalEvaluationForm
            journeyId={journeyId}
            paymentMode={paymentMode}
            procedureName={procedureName}
            eyeOperated={eyeOperated}
            readOnly={forceReadOnly}
            onChanged={onChanged}
          />

          <DepartmentClearancePanel
            journeyId={journeyId}
            clinicalState={clinicalState}
            paymentMode={paymentMode}
            currentUserDeptCode={currentUserDeptCode}
            forceReadOnly={forceReadOnly}
            categoryFilter={[EVAL_CATEGORY]}
            itemKeyExclude={[...CLINICAL_EVAL_STRUCTURED_KEYS]}
            hideSummary
            flat
            onChanged={onChanged}
          />
        </>
      )}
    </div>
  );
}

/** Calm locked state for the Expected journey — one card + an optional muted preview. */
function LockedView({
  items,
  previewOpen,
  onTogglePreview,
}: {
  items: PreOpCompletionDto[];
  previewOpen: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-gray-700">
          Clinical evaluation unlocks once the patient is admitted
        </p>
        <p className="max-w-md text-xs text-gray-500">
          After admission, the doctor records pre-op diagnosis, comorbidities, risk class,
          confirms the surgical plan, and signs off.
        </p>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={onTogglePreview}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-expanded={previewOpen}
          >
            <span className="text-xs font-medium text-gray-600">
              What&apos;s required after admission ({items.length})
            </span>
            {previewOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
            )}
          </button>
          {previewOpen && (
            <ul className="divide-y divide-gray-50 border-t border-gray-100">
              {items.map(it => (
                <li
                  key={it.itemId}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-400"
                >
                  <Circle className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden="true" />
                  <span>{it.itemLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

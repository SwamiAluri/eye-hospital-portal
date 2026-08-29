'use client';

import { useState } from 'react';
import {
  Lock,
  PenLine,
  Loader2,
  ChevronDown,
  ChevronRight,
  Circle,
} from 'lucide-react';
import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import { usePreOpClearanceData } from '@/hooks/use-preop-clearance-data';
import {
  completionByKey,
  isEvaluationSignedOff,
} from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { StatusChip } from './primitives/StatusChip';
import { ClinicalEvaluationForm } from './ClinicalEvaluationForm';

export interface ClinicalEvaluationPanelProps {
  journeyId: string;
  counselingSessionId?: string | null;
  journeyDiagnosis?: string | null;
  journeyDiagnosisJson?: string | null;
  clinicalState: string;
  paymentMode?: string;
  procedureName?: string;
  eyeOperated?: string;
  forceReadOnly?: boolean;
  canEditClinicalEvaluation?: boolean;
  canSignClinicalEvaluation?: boolean;
  canAmendClinicalEvaluationInOt?: boolean;
  onChanged?: () => void;
}

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

export function ClinicalEvaluationPanel({
  journeyId,
  counselingSessionId,
  journeyDiagnosis,
  journeyDiagnosisJson,
  clinicalState,
  paymentMode,
  procedureName,
  eyeOperated,
  forceReadOnly,
  canEditClinicalEvaluation = true,
  canSignClinicalEvaluation = false,
  canAmendClinicalEvaluationInOt = false,
  onChanged,
}: ClinicalEvaluationPanelProps) {
  const { detail, loading, error } = usePreOpClearanceData({
    journeyId,
    paymentMode,
    onChanged,
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  const locked = clinicalState === 'Expected';
  const evalItems = (detail?.completions ?? []).filter(c => c.category === 'Evaluation');
  const signoff = completionByKey(evalItems, 'doctor_evaluation_signed') ?? null;
  const signed = isEvaluationSignedOff(evalItems);
  const signedAt = formatTimestamp(signoff?.completedAt ?? null);

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.clinicalEvalPanel} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Clinical Evaluation</h3>
        {locked ? (
          <StatusChip status="not-started" size="sm" label="Locked until admission" />
        ) : signed ? (
          <span
            data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoff}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Signed off{signedAt ? ` · ${signedAt}` : ''}
          </span>
        ) : (
          <span
            data-testid={WARD_PREOP_TEST_IDS.clinicalEvalSignoff}
            className="text-xs font-medium text-amber-700"
          >
            Pending sign-off
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
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
        <ClinicalEvaluationForm
          journeyId={journeyId}
          counselingSessionId={counselingSessionId}
          journeyDiagnosis={journeyDiagnosis}
          journeyDiagnosisJson={journeyDiagnosisJson}
          clinicalState={clinicalState}
          paymentMode={paymentMode}
          procedureName={procedureName}
          eyeOperated={eyeOperated}
          readOnly={forceReadOnly}
          canEdit={canEditClinicalEvaluation}
          canSignOff={canSignClinicalEvaluation}
          canAmendInOt={canAmendClinicalEvaluationInOt}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

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
              Required after admission ({items.length})
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

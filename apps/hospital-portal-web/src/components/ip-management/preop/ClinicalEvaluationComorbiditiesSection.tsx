'use client';

import {
  COMORBIDITY_CHECKLIST_ITEMS,
  formatComorbiditySummary,
  type ComorbidityReviewState,
} from '@/lib/ip-management/clinical-evaluation';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ClinicalEvaluationComorbiditiesSectionProps {
  comorbidities: ComorbidityReviewState;
  disabled: boolean;
  onChange: (state: ComorbidityReviewState) => void;
}

export function ClinicalEvaluationComorbiditiesSection({
  comorbidities,
  disabled,
  onChange,
}: ClinicalEvaluationComorbiditiesSectionProps) {
  function patch(partial: Partial<ComorbidityReviewState>) {
    onChange({ ...comorbidities, ...partial, nad: partial.nad ?? false });
  }

  function documentNad() {
    onChange({ nad: true, items: {}, other: '' });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-700">
          Comorbidities reviewed <span className="text-red-600">*</span>
        </label>
        {!disabled && (
          <button
            type="button"
            onClick={documentNad}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Document NAD
          </button>
        )}
      </div>
      <p className="mb-2 text-[11px] text-gray-500">
        Confirm systemic conditions reviewed with the patient that may affect surgery or anaesthesia.
      </p>

      {comorbidities.nad ? (
        <p
          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalComorbidities}
          className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
        >
          NAD — no significant comorbidities documented
        </p>
      ) : (
        <div
          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalComorbidities}
          className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
        >
          {COMORBIDITY_CHECKLIST_ITEMS.map(item => (
            <label key={item.key} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!comorbidities.items[item.key]}
                onChange={e =>
                  patch({
                    items: { ...comorbidities.items, [item.key]: e.target.checked },
                    nad: false,
                  })
                }
                className="rounded border-gray-300"
              />
              {item.label}
            </label>
          ))}
          <div className="pt-1">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="eval-comorb-other">
              Other / details
            </label>
            <textarea
              id="eval-comorb-other"
              rows={2}
              disabled={disabled}
              value={comorbidities.other}
              onChange={e => patch({ other: e.target.value, nad: false })}
              placeholder="e.g. DM2 on metformin; well controlled"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
            />
          </div>
        </div>
      )}

      {!comorbidities.nad && formatComorbiditySummary(comorbidities) && (
        <p className="mt-1 text-[11px] text-gray-500">
          Summary: {formatComorbiditySummary(comorbidities)}
        </p>
      )}
    </div>
  );
}

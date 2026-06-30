'use client';

import type { CounsellorPreOpInvestigationItemDto } from '@/lib/api/ip-management.api';
import { COUNSELLING_PREOP_TEST_IDS } from '@/lib/counsellors-desk/counselling-preop-test-ids';
import {
  CounsellingInput,
  CounsellingLabel,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';

export interface InvestigationDraftState {
  resultValue: string;
  resultUnit: string;
  notes: string;
}

export interface CounsellingInvestigationValueRowProps {
  item: CounsellorPreOpInvestigationItemDto;
  draft: InvestigationDraftState;
  readOnly?: boolean;
  onDraftChange: (itemId: string, patch: Partial<InvestigationDraftState>) => void;
}

export function CounsellingInvestigationValueRow({
  item,
  draft,
  readOnly = false,
  onDraftChange,
}: CounsellingInvestigationValueRowProps) {
  const inputMode = item.valueType === 'numeric' ? 'decimal' : 'text';
  const hasSavedDraft = Boolean(item.resultValue?.trim());

  return (
    <div className="space-y-2 rounded-xl border border-counselling-border bg-counselling-card px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-counselling-foreground">{item.itemLabel}</p>
          {item.description ? (
            <p className="mt-0.5 text-xs text-counselling-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        {hasSavedDraft ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
            Draft saved
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <CounsellingLabel
            htmlFor={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-value`}
            className="mb-1 block text-xs text-counselling-muted-foreground"
          >
            Result value
          </CounsellingLabel>
          <CounsellingInput
            id={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-value`}
            data-testid={COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}
            value={draft.resultValue}
            readOnly={readOnly}
            disabled={readOnly}
            inputMode={inputMode}
            placeholder={item.valueType === 'numeric' ? 'e.g. 98' : 'Enter result or notes'}
            onChange={(e) => onDraftChange(item.itemId, { resultValue: e.target.value })}
          />
        </div>
        {item.defaultUnit !== null && item.defaultUnit !== '' ? (
          <div className="sm:w-28">
            <CounsellingLabel
              htmlFor={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-unit`}
              className="mb-1 block text-xs text-counselling-muted-foreground"
            >
              Unit
            </CounsellingLabel>
            <CounsellingInput
              id={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-unit`}
              value={draft.resultUnit}
              readOnly={readOnly}
              disabled={readOnly}
              placeholder={item.defaultUnit ?? ''}
              onChange={(e) => onDraftChange(item.itemId, { resultUnit: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div>
        <CounsellingLabel
          htmlFor={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-note`}
          className="mb-1 block text-xs text-counselling-muted-foreground"
        >
          External report note (optional)
        </CounsellingLabel>
        <CounsellingTextarea
          id={`${COUNSELLING_PREOP_TEST_IDS.investigation(item.itemKey)}-note`}
          rows={2}
          value={draft.notes}
          readOnly={readOnly}
          disabled={readOnly}
          placeholder="Hospital name, report date, or context"
          onChange={(e) => onDraftChange(item.itemId, { notes: e.target.value })}
        />
      </div>
    </div>
  );
}

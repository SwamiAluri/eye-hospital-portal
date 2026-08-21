'use client';

import { useState } from 'react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

const AMEND_CATEGORIES = [
  { value: 'diagnosis', label: 'Diagnosis correction' },
  { value: 'iol', label: 'IOL / implant change' },
  { value: 'comorbidity', label: 'Comorbidity update' },
  { value: 'other', label: 'Other' },
] as const;

export interface ClinicalEvaluationAmendDialogProps {
  open: boolean;
  kind: 'ward' | 'in_ot';
  loading?: boolean;
  onClose: () => void;
  onConfirm: (input: { reason: string; category: string }) => void | Promise<void>;
}

export function ClinicalEvaluationAmendDialog({
  open,
  kind,
  loading = false,
  onClose,
  onConfirm,
}: ClinicalEvaluationAmendDialogProps) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<string>('other');

  const isInOt = kind === 'in_ot';
  const title = isInOt ? 'Emergency amend (In OT)' : 'Amend clinical evaluation';
  const minLen = isInOt ? 15 : 8;

  return (
    <ConfirmationDialog
      isOpen={open}
      onClose={onClose}
      variant={isInOt ? 'danger' : 'warning'}
      title={title}
      confirmText={isInOt ? 'Unlock for emergency amend' : 'Amend evaluation'}
      cancelText="Cancel"
      isLoading={loading}
      dataTestId={WARD_PREOP_TEST_IDS.clinicalEvalAmendDialog}
      confirmTestId={WARD_PREOP_TEST_IDS.clinicalEvalAmendConfirm}
      onConfirm={async () => {
        if (reason.trim().length < minLen) return;
        await onConfirm({ reason: reason.trim(), category });
        setReason('');
        setCategory('other');
      }}
      message={
        <div className="space-y-3 text-left text-sm text-gray-700">
          {isInOt ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
              Use only for rare in-theatre corrections. Counselling, billing, OT, and inventory will be notified.
            </p>
          ) : (
            <p>
              This will clear the doctor sign-off. The evaluation must be re-signed after edits.
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="eval-amend-category">
              Category
            </label>
            <select
              id="eval-amend-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {AMEND_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="eval-amend-reason">
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              id="eval-amend-reason"
              data-testid={WARD_PREOP_TEST_IDS.clinicalEvalAmendReason}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isInOt ? 'Describe the in-OT clinical reason (min 15 characters)' : 'Why is this evaluation being amended?'}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {reason.trim().length > 0 && reason.trim().length < minLen && (
              <p className="mt-1 text-xs text-amber-700">At least {minLen} characters required.</p>
            )}
          </div>
        </div>
      }
    />
  );
}

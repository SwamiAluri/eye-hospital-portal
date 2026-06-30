'use client';

import {
  CounsellingDatePicker,
  type CounsellingDatePickerProps,
  type CounsellingDatePickerVariant,
} from './CounsellingDatePicker';

export type SessionDatePickerVariant = CounsellingDatePickerVariant;

export interface SessionDatePickerProps extends CounsellingDatePickerProps {
  /** compact = follow-up (quick picks); scheduling = surgery (month/year dropdowns) */
  variant?: SessionDatePickerVariant;
}

/**
 * Shared date picker for counselling session, coverage, and schedule modals.
 * Wraps CounsellingDatePicker — use this for new integrations.
 */
export function SessionDatePicker({ variant = 'compact', ...props }: SessionDatePickerProps) {
  return <CounsellingDatePicker variant={variant} {...props} />;
}

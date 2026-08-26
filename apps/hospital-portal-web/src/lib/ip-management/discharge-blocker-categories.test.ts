import { describe, expect, it } from 'vitest';
import { classifyDischargeBlocker, splitDischargeBlockers } from './discharge-blocker-categories';
import type { ChecklistGateWarningDto } from '@/lib/api/ip-management.api';

const w = (partial: Partial<ChecklistGateWarningDto> & Pick<ChecklistGateWarningDto, 'code' | 'message'>): ChecklistGateWarningDto => ({
  severity: 'block',
  canOverride: true,
  ...partial,
});

describe('classifyDischargeBlocker', () => {
  it('uses server category when present', () => {
    expect(classifyDischargeBlocker(w({ code: 'x', message: 'm', category: 'Financial' }))).toBe('Financial');
  });

  it('falls back to code for financial vs clinical', () => {
    expect(classifyDischargeBlocker(w({ code: 'patient_obligation_outstanding', message: 'due' }))).toBe('Financial');
    expect(classifyDischargeBlocker(w({ code: 'anaesthesia_clearance_missing', message: 'form 5' }))).toBe('Clinical');
  });

  it('allows clinically ready with financial block', () => {
    const groups = splitDischargeBlockers([
      w({ code: 'anaesthesia_ok', message: 'ready', severity: 'warn', category: 'Clinical' }),
      w({ code: 'patient_obligation_outstanding', message: 'due', category: 'Financial' }),
    ]);
    expect(groups.Clinical).toHaveLength(1);
    expect(groups.Financial).toHaveLength(1);
  });
});

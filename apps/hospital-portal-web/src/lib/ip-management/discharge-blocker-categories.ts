import type { ChecklistGateWarningDto } from '@/lib/api/ip-management.api';

export type DischargeBlockerCategory = 'Clinical' | 'Financial' | 'Coverage' | 'Operational';

export function classifyDischargeBlocker(warning: ChecklistGateWarningDto): DischargeBlockerCategory {
  if (warning.category === 'Clinical' || warning.category === 'Financial'
    || warning.category === 'Coverage' || warning.category === 'Operational') {
    return warning.category;
  }
  const code = warning.code.toLowerCase();
  if (code.includes('obligation') || code.includes('financial') || code.includes('balance') || code.includes('paid')) {
    return 'Financial';
  }
  if (code.includes('coverage') || code.includes('ccms') || code.includes('preauth') || code.includes('payer')) {
    return 'Coverage';
  }
  if (code.includes('bed') || code.includes('ot') || code.includes('staff') || code.includes('operational')) {
    return 'Operational';
  }
  return 'Clinical';
}

/** Clinical readiness can coexist with financial/coverage blocks. */
export function splitDischargeBlockers(warnings: ChecklistGateWarningDto[]) {
  const groups: Record<DischargeBlockerCategory, ChecklistGateWarningDto[]> = {
    Clinical: [],
    Financial: [],
    Coverage: [],
    Operational: [],
  };
  for (const w of warnings) groups[classifyDischargeBlocker(w)].push(w);
  return groups;
}

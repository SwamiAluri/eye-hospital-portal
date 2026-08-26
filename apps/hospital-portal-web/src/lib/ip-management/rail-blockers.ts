import type { DischargeBlockerCategory } from './discharge-blocker-categories';
import { LATERALITY_MISSING_BLOCKER, operativeEyeDisplay } from './operative-eye-display';
import type { IpRowSituation } from './ip-row-situation';
import type { IpPersona } from './ip-persona';

export interface RailBlocker {
  category: DischargeBlockerCategory;
  text: string;
}

/**
 * Group census-rail blockers with the same category names as discharge gates.
 * IP-010 will replace the situation strings with ChecklistGateService wording.
 */
export function buildRailBlockers(
  situation: IpRowSituation,
  eyeOperated: string | null | undefined,
): RailBlocker[] {
  const items: RailBlocker[] = [];
  const eye = operativeEyeDisplay(eyeOperated);
  if (eye.kind === 'missing') {
    items.push({ category: 'Clinical', text: LATERALITY_MISSING_BLOCKER });
  }
  if (situation.operationalBlocker) {
    items.push({ category: 'Operational', text: situation.operationalBlocker });
  }
  if (situation.financialBlocker) {
    items.push({ category: 'Financial', text: situation.financialBlocker });
  }
  if (situation.coverageBlocker) {
    items.push({ category: 'Coverage', text: situation.coverageBlocker });
  }
  return items;
}

export function blockersForPersona(persona: IpPersona, items: RailBlocker[]): RailBlocker[] {
  if (persona === 'cashier') return items.filter(i => i.category === 'Financial');
  if (persona === 'clinical') {
    return items.filter(i => i.category === 'Clinical' || i.category === 'Operational');
  }
  return items;
}

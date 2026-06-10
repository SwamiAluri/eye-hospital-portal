import type { RetinoscopySectionId } from './retinoscopy-section-constants';
import {
  hasDrySectionContent,
  hasSubjectiveSectionContent,
  hasWetSectionContent,
} from './retinoscopy-section-history';
import type {
  DryRetinoscopyData,
  SubjectiveRefractionData,
  WetRetinoscopyData,
} from './retinoscopy-types';

export type RetinoscopyEditTarget =
  | { sectionId: 'wet'; kind: 'drug' }
  | { sectionId: 'wet' | 'dry'; kind: 'reading'; eye: 'od' | 'os'; readingId: string }
  | { sectionId: 'subjective'; kind: 'subjective'; readingId: string };

export function hasTodaySectionContent(
  sectionId: RetinoscopySectionId,
  wet: WetRetinoscopyData,
  dry: DryRetinoscopyData,
  subjective: SubjectiveRefractionData,
): boolean {
  if (sectionId === 'wet') return hasWetSectionContent(wet);
  if (sectionId === 'dry') return hasDrySectionContent(dry);
  return hasSubjectiveSectionContent(subjective);
}

/** New-entry forms allowed only when this visit section has no saved readings yet. */
export function canAddNewRecordToday(
  sectionId: RetinoscopySectionId,
  wet: WetRetinoscopyData,
  dry: DryRetinoscopyData,
  subjective: SubjectiveRefractionData,
): boolean {
  return !hasTodaySectionContent(sectionId, wet, dry, subjective);
}

export function isEditTargetForSection(
  target: RetinoscopyEditTarget | null,
  sectionId: RetinoscopySectionId,
): boolean {
  return target?.sectionId === sectionId;
}

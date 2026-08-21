/**
 * Ward Pre-Op Workspace — persistent safety strip signals (Phase 2).
 *
 * Pure computation from the same canonical sources as the readiness rollup:
 * §1 Investigations (serology + critical labs), PAC allergies, §2 Consent site marking.
 */
import type {
  PacAssessmentDto,
  PreOpClearanceDetailDto,
  WardInvestigationChecklistDto,
  WardInvestigationItemDto,
} from '@/lib/api/ip-management.api';
import type { PreOpStepKey } from './preop-steps';
import { isLateralityAttested, normalizeOperativeEye } from './preop-laterality';

export type AllergySafetyStatus = 'known' | 'nkda' | 'not-documented';

export interface InfectionPrecautionItem {
  itemKey: string;
  label: string;
  result: string;
  verified: boolean;
  reactive: boolean;
}

export interface SafetyStripSegment {
  id: 'allergies' | 'infection' | 'critical-labs' | 'laterality';
  tone: 'neutral' | 'caution' | 'alert';
  label: string;
  detail?: string;
  navigateStep: PreOpStepKey;
}

export interface PreOpSafetySignals {
  allergies: {
    status: AllergySafetyStatus;
    text: string | null;
  };
  infection: {
    reactiveItems: InfectionPrecautionItem[];
    hasPrecautions: boolean;
  };
  criticalLabs: {
    count: number;
    labels: string[];
  };
  laterality: {
    scheduledEye: string | null;
    siteMarked: boolean;
  };
  /** Segments to render left-to-right in the strip. */
  segments: SafetyStripSegment[];
  /** True when no caution/alert segments are present. */
  allClear: boolean;
}

const SEROLOGY_ITEM_KEYS = new Set(['hiv_done', 'hbsag_done', 'hcv_done']);

export function parseAllergyStatus(allergies: string | null | undefined): AllergySafetyStatus {
  const text = (allergies ?? '').trim();
  if (!text) return 'not-documented';
  if (/^(nkda|nka|no known|nil|none|no allergy|no allergies)/i.test(text)) return 'nkda';
  return 'known';
}

/** Reactive serology — excludes "Non-reactive". */
export function isReactiveSerologyResult(value: string | null | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return false;
  if (v.includes('non-reactive') || v === 'negative') return false;
  return v.includes('reactive') || v === 'positive';
}

function serologyItems(items: WardInvestigationItemDto[]): InfectionPrecautionItem[] {
  return items
    .filter(i => SEROLOGY_ITEM_KEYS.has(i.itemKey) && i.appliesToJourney !== false)
    .map(i => {
      const result = (i.resultValue ?? '').trim();
      return {
        itemKey: i.itemKey,
        label: i.itemLabel,
        result: result || '—',
        verified: i.entryStatus === 'verified',
        reactive: isReactiveSerologyResult(i.resultValue),
      };
    })
    .filter(i => i.reactive);
}

function criticalLabLabels(
  investigation: WardInvestigationChecklistDto | null | undefined,
): string[] {
  const keys = investigation?.unverifiedCriticalKeys ?? [];
  if (keys.length === 0) return [];
  const byKey = new Map((investigation?.items ?? []).map(i => [i.itemKey, i.itemLabel]));
  return keys.map(k => byKey.get(k) ?? k);
}

export interface SafetySignalsInput {
  investigation?: WardInvestigationChecklistDto | null;
  pac?: PacAssessmentDto | null;
  detail?: PreOpClearanceDetailDto | null;
  scheduledEye?: string | null;
}

export function computePreOpSafetySignals(input: SafetySignalsInput): PreOpSafetySignals {
  const { investigation, pac, detail, scheduledEye } = input;

  const allergies = {
    status: parseAllergyStatus(pac?.allergies),
    text: pac?.allergies?.trim() || null,
  };

  const reactiveItems = serologyItems(investigation?.items ?? []);
  const infection = {
    reactiveItems,
    hasPrecautions: reactiveItems.length > 0,
  };

  const criticalLabels = criticalLabLabels(investigation);
  const criticalLabs = {
    count: criticalLabels.length,
    labels: criticalLabels,
  };

  const scheduled = normalizeOperativeEye(scheduledEye);
  const lateralityAttested = isLateralityAttested(detail?.completions ?? [], scheduledEye);
  const laterality = {
    scheduledEye: scheduled,
    siteMarked: lateralityAttested,
  };

  const segments: SafetyStripSegment[] = [];

  // Allergies (single writer = PAC §3)
  if (allergies.status === 'known') {
    segments.push({
      id: 'allergies',
      tone: 'alert',
      label: 'Allergies',
      detail: allergies.text ?? 'Documented',
      navigateStep: 'pac',
    });
  } else if (allergies.status === 'nkda') {
    segments.push({
      id: 'allergies',
      tone: 'neutral',
      label: 'Allergies',
      detail: 'NKDA',
      navigateStep: 'pac',
    });
  } else {
    segments.push({
      id: 'allergies',
      tone: 'caution',
      label: 'Allergies',
      detail: 'Not documented',
      navigateStep: 'pac',
    });
  }

  // Infection precautions (§1 serology)
  if (infection.hasPrecautions) {
    const names = reactiveItems.map(i => i.label.replace(/\s*\/\s*.*/, '')).join(', ');
    segments.push({
      id: 'infection',
      tone: 'alert',
      label: 'Infection precautions',
      detail: `${names} reactive`,
      navigateStep: 'investigations',
    });
  } else {
    segments.push({
      id: 'infection',
      tone: 'neutral',
      label: 'Serology',
      detail: 'No reactive markers',
      navigateStep: 'investigations',
    });
  }

  // Critical unverified labs (§1)
  if (criticalLabs.count > 0) {
    segments.push({
      id: 'critical-labs',
      tone: 'alert',
      label: 'Critical labs',
      detail:
        criticalLabs.count === 1
          ? `${criticalLabs.labels[0]} unverified`
          : `${criticalLabs.count} unverified`,
      navigateStep: 'investigations',
    });
  } else {
    segments.push({
      id: 'critical-labs',
      tone: 'neutral',
      label: 'Critical labs',
      detail: 'Verified',
      navigateStep: 'investigations',
    });
  }

  // Laterality / site attestation (Consent writer; hard stop at Mark Ready)
  if (laterality.scheduledEye) {
    if (laterality.siteMarked) {
      segments.push({
        id: 'laterality',
        tone: 'neutral',
        label: 'Site',
        detail: `${laterality.scheduledEye} attested`,
        navigateStep: 'consent',
      });
    } else {
      segments.push({
        id: 'laterality',
        tone: 'alert',
        label: 'Site',
        detail: `${laterality.scheduledEye} — attest marking`,
        navigateStep: 'consent',
      });
    }
  } else {
    segments.push({
      id: 'laterality',
      tone: 'alert',
      label: 'Site',
      detail: 'Eye not scheduled',
      navigateStep: 'consent',
    });
  }

  const allClear = segments.every(s => s.tone === 'neutral');

  return {
    allergies,
    infection,
    criticalLabs,
    laterality,
    segments,
    allClear,
  };
}

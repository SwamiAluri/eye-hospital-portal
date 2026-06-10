import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import { priorSegmentsHaveClinicalData } from '@/lib/optometry/prior-segment-raw';
import type {
  ChronicCondition,
  MedicalHistorySectionId,
  Medication,
} from '@/lib/medical-history/medical-history-constants';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
function trimName(item: { name?: string; allergenName?: string; condition?: string }): string {
  return String(item.name ?? item.allergenName ?? item.condition ?? '').trim();
}

/** Labels + full snapshot for priorVisit.raw (banner, copy, section hints). */
export function buildPriorRawFromMedicalHistorySnapshot(
  snap: MedicalHistorySnapshot,
): Record<string, unknown> {
  const conditions = (snap.chronicConditions as ChronicCondition[])
    .map((c) => trimName(c))
    .filter(Boolean);
  const medications = (snap.medications as Medication[])
    .map((m) => trimName(m))
    .filter(Boolean);
  const allergies = snap.nkda
    ? ['NKDA']
    : snap.allergies.map((a) => a.allergenName).filter(Boolean);

  return {
    conditions,
    chronicConditions: conditions,
    medications,
    currentMedications: medications,
    allergies,
    medicalHistoryBundle: snap,
  };
}

export function getMedicalHistoryBundleFromVisit(
  visit: OptometryVisitExamRecord,
): MedicalHistorySnapshot | undefined {
  const bundle = visit.segments.medical_history_bundle;
  if (!bundle || typeof bundle !== 'object') return undefined;
  return bundle as MedicalHistorySnapshot;
}

export function priorSnapshotHasClinicalData(snapshot: PriorVisitSnapshot): boolean {
  if (
    snapshot.visualAcuity ||
    snapshot.refraction ||
    snapshot.iop ||
    snapshot.keratometry
  ) {
    return true;
  }
  if (priorSegmentsHaveClinicalData(snapshot.raw as Record<string, unknown> | undefined)) {
    return true;
  }
  return priorRawHasMedicalHistory(snapshot.raw as Record<string, unknown> | undefined);
}

export function priorRawHasMedicalHistory(raw?: Record<string, unknown>): boolean {
  if (!raw) return false;
  if (raw.medicalHistoryBundle && typeof raw.medicalHistoryBundle === 'object') {
    return true;
  }
  const lists = [
    raw.conditions,
    raw.chronicConditions,
    raw.medications,
    raw.currentMedications,
    raw.allergies,
  ];
  return lists.some((v) => Array.isArray(v) && v.length > 0);
}

export interface MhSectionPriorRow {
  examinationDate: string;
  visitId: string;
  summary: string;
  snapshot: MedicalHistorySnapshot;
}

function sectionSummary(
  sectionId: MedicalHistorySectionId,
  snap: MedicalHistorySnapshot,
): string {
  switch (sectionId) {
    case 'allergies':
      return snap.nkda
        ? 'NKDA'
        : snap.allergies.length
          ? snap.allergies.map((a) => a.allergenName).join(', ')
          : '—';
    case 'conditions':
      return (snap.chronicConditions as ChronicCondition[])
        .map((c) => c.name)
        .filter(Boolean)
        .join(', ') || '—';
    case 'medications':
      return (snap.medications as Medication[])
        .map((m) => m.name)
        .filter(Boolean)
        .join(', ') || '—';
    case 'surgeries':
      return (snap.surgeries as { name?: string }[])
        .map((s) => s.name)
        .filter(Boolean)
        .join(', ') || '—';
    case 'family':
      return (snap.familyHistory as { condition?: string }[])
        .map((f) => f.condition)
        .filter(Boolean)
        .join(', ') || '—';
    case 'immunizations':
      return (snap.immunizations as { vaccine?: string }[])
        .map((i) => i.vaccine)
        .filter(Boolean)
        .join(', ') || '—';
    case 'lifestyle': {
      const parts = [snap.smokingStatus, snap.alcoholUse].filter(Boolean);
      return parts.join(' · ') || '—';
    }
    case 'disability':
      return snap.disabilityStatus || snap.specialNeeds || '—';
    default:
      return '—';
  }
}

function sectionHasData(sectionId: MedicalHistorySectionId, snap: MedicalHistorySnapshot): boolean {
  const summary = sectionSummary(sectionId, snap);
  return summary !== '—' && summary.length > 0;
}

/** Prior visit rows for an MH section (newest first). */
export function getMhSectionPriorHistory(
  sectionId: MedicalHistorySectionId,
  visits: OptometryVisitExamRecord[],
  excludeVisitId?: string,
  maxItems = 5,
): MhSectionPriorRow[] {
  return visits
    .filter((v) => (excludeVisitId ? v.visitId !== excludeVisitId : true))
    .map((v) => {
      const snap = getMedicalHistoryBundleFromVisit(v);
      if (!snap || !sectionHasData(sectionId, snap)) return null;
      return {
        examinationDate: v.examinationDate,
        visitId: v.visitId,
        summary: sectionSummary(sectionId, snap),
        snapshot: snap,
      };
    })
    .filter((r): r is MhSectionPriorRow => r != null)
    .slice(0, maxItems);
}

export function buildMhVisitTimeline(
  visits: OptometryVisitExamRecord[],
  maxItems = 8,
): Array<{ id: string; examinationDate: string; label: string }> {
  return visits
    .filter((v) => v.segments.medical_history_bundle != null)
    .slice(0, maxItems)
    .map((v) => {
      const snap = getMedicalHistoryBundleFromVisit(v)!;
      const cond = (snap.chronicConditions as ChronicCondition[]).length;
      const meds = (snap.medications as Medication[]).length;
      const allergy = snap.nkda ? 'NKDA' : `${snap.allergies.length} allergy`;
      return {
        id: v.visitId,
        examinationDate: v.examinationDate,
        label: `${cond} condition(s) · ${meds} med(s) · ${allergy}`,
      };
    });
}

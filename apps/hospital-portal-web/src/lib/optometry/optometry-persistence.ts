/**
 * Optometry exam persistence contract (visit-scoped).
 *
 * **Canonical stores**
 * 1. Visit draft JSON — `persistExamDraft` / `loadExamDraft` (all tab fields, vaExtended, iopExtended).
 * 2. Visit segments — `optometrySegmentApi` (multi-row / bundle keys in OPTOMETRY_SEGMENT_KEYS).
 *
 * **Not used from /dashboard/optometrist/exam (history reads patient optometry-exams API instead)**
 * - `examination.api.ts` (`/clinical/examination/*`) — legacy standalone examination pages only.
 *
 * **IOP extended fields (ATN, Schirmer, measurement times)**
 * - Stored in draft `iopExtended` only until backend tonometry model supports NCT/ATN matrix.
 * - `buildTonometryPayload` maps NCT pre-dilatation only (legacy DTO).
 */

import { optometrySegmentApi } from '@/lib/api/optometry-segment.api';
import { OPTOMETRY_SEGMENT_KEYS } from './optometry-segment-keys';
import type {
  ColorVisionData,
  ContrastSensitivityData,
  KeratometryData,
  PachymetryData,
  RefractionData,
  TonometryData,
  VisualAcuityData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';
import {
  buildColorVisionPayload,
  buildContrastPayload,
  buildKeratometryPayload,
  buildPachymetryPayload,
  buildRefractionPayload,
  buildTonometryPayload,
  buildVisualFieldPayload,
  buildVisualAcuityPayload,
  type IOPMegaSnapshot,
  type VisualAcuityMegaSnapshot,
} from './exam-mappers';

export interface VaClinicalDraftSlice {
  visualAcuity: VisualAcuityData;
  refraction: RefractionData;
  keratometry: KeratometryData;
  colorVision: ColorVisionData;
  contrastSensitivity: ContrastSensitivityData;
}

export interface IopClinicalDraftSlice {
  tonometry: TonometryData;
  pachymetry: PachymetryData;
  visualField: VisualFieldData;
}

export function buildVaClinicalSlice(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing: {
    visualAcuity?: VisualAcuityData | null;
    refraction?: RefractionData | null;
    keratometry?: KeratometryData | null;
    colorVision?: ColorVisionData | null;
    contrastSensitivity?: ContrastSensitivityData | null;
  },
): VaClinicalDraftSlice {
  return {
    visualAcuity: buildVisualAcuityPayload(
      patientId,
      examinerId,
      snap,
      existing.visualAcuity,
    ),
    refraction: buildRefractionPayload(patientId, examinerId, snap, existing.refraction),
    keratometry: buildKeratometryPayload(patientId, examinerId, snap, existing.keratometry),
    colorVision: buildColorVisionPayload(patientId, examinerId, snap, existing.colorVision),
    contrastSensitivity: buildContrastPayload(
      patientId,
      examinerId,
      snap,
      existing.contrastSensitivity,
    ),
  };
}

export function buildIopClinicalSlice(
  patientId: string,
  examinerId: string,
  snap: IOPMegaSnapshot,
  existing: {
    tonometry?: TonometryData | null;
    pachymetry?: PachymetryData | null;
    visualField?: VisualFieldData | null;
  },
): IopClinicalDraftSlice {
  return {
    tonometry: buildTonometryPayload(patientId, examinerId, snap, existing.tonometry),
    pachymetry: buildPachymetryPayload(patientId, examinerId, snap, existing.pachymetry),
    visualField: buildVisualFieldPayload(patientId, examinerId, snap, existing.visualField),
  };
}

/** Loose spectacle record stored in draft + optical_bundle (not examination.api). */
export interface SpectacleDispensingDraft {
  od?: { sphere?: string; cylinder?: string; axis?: string; add?: string };
  os?: { sphere?: string; cylinder?: string; axis?: string; add?: string };
  pupillaryDistance?: string;
  lensType?: string;
  lensMaterial?: string;
  lensCoating?: string;
  frameType?: string;
  frameSize?: string;
  wearingInstructions?: string[];
  specialInstructions?: string;
  followUpDate?: string;
}

export const EMPTY_SPECTACLE_DRAFT: SpectacleDispensingDraft = {
  od: { sphere: '', cylinder: '', axis: '', add: '' },
  os: { sphere: '', cylinder: '', axis: '', add: '' },
  pupillaryDistance: '',
  lensType: '',
  lensMaterial: '',
  lensCoating: '',
  frameType: '',
  frameSize: '',
  wearingInstructions: [],
  specialInstructions: '',
  followUpDate: '',
};

export function normalizeSpectacleDraft(raw: unknown): SpectacleDispensingDraft {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SPECTACLE_DRAFT };
  const r = raw as SpectacleDispensingDraft;
  return {
    ...EMPTY_SPECTACLE_DRAFT,
    ...r,
    od: { ...EMPTY_SPECTACLE_DRAFT.od, ...r.od },
    os: { ...EMPTY_SPECTACLE_DRAFT.os, ...r.os },
  };
}

/** Push segment bundles to visit API after Save exam. Returns failed segment keys. */
export async function flushVisitSegments(
  visitId: string,
  patientId: string,
  segments: {
    visualAcuityBundle?: unknown;
    iopBundle?: unknown;
    medicalHistoryBundle?: unknown;
    opticalBundle?: unknown;
    wetRetinoscopy?: unknown;
    dryRetinoscopy?: unknown;
    subjectiveRefraction?: unknown;
    pupilExam?: unknown;
    anteriorSegment?: unknown;
    posteriorSegment?: unknown;
    fundusExam?: unknown;
    vitreousExam?: unknown;
    peripheralRetinaExam?: unknown;
    prescriptionItems?: unknown;
    doctorReferrals?: unknown;
    imagingOrders?: unknown;
    receptionReferrals?: unknown;
    diagnoses?: unknown;
    adviceBundle?: unknown;
  },
): Promise<string[]> {
  const failures: string[] = [];

  const upsert = async (key: string, data: unknown) => {
    if (data == null) return;
    try {
      await optometrySegmentApi.upsertSegment(visitId, key, { patientId, data });
    } catch {
      failures.push(key);
    }
  };

  await Promise.all([
    upsert(OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle, segments.visualAcuityBundle),
    upsert(OPTOMETRY_SEGMENT_KEYS.iopBundle, segments.iopBundle),
    upsert(OPTOMETRY_SEGMENT_KEYS.medicalHistoryBundle, segments.medicalHistoryBundle),
    upsert(OPTOMETRY_SEGMENT_KEYS.opticalBundle, segments.opticalBundle),
    upsert(OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy, segments.wetRetinoscopy),
    upsert(OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy, segments.dryRetinoscopy),
    upsert(OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction, segments.subjectiveRefraction),
    upsert(OPTOMETRY_SEGMENT_KEYS.pupilExam, segments.pupilExam),
    upsert(OPTOMETRY_SEGMENT_KEYS.anteriorSegment, segments.anteriorSegment),
    upsert(OPTOMETRY_SEGMENT_KEYS.posteriorSegment, segments.posteriorSegment),
    upsert(OPTOMETRY_SEGMENT_KEYS.fundusExam, segments.fundusExam),
    upsert(OPTOMETRY_SEGMENT_KEYS.vitreousExam, segments.vitreousExam),
    upsert(OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam, segments.peripheralRetinaExam),
    upsert(OPTOMETRY_SEGMENT_KEYS.prescriptionItems, segments.prescriptionItems),
    upsert(OPTOMETRY_SEGMENT_KEYS.doctorReferrals, segments.doctorReferrals),
    upsert(OPTOMETRY_SEGMENT_KEYS.imagingOrders, segments.imagingOrders),
    upsert(OPTOMETRY_SEGMENT_KEYS.receptionReferrals, segments.receptionReferrals),
    upsert(OPTOMETRY_SEGMENT_KEYS.diagnoses, segments.diagnoses),
    upsert(OPTOMETRY_SEGMENT_KEYS.adviceBundle, segments.adviceBundle),
  ]);

  return failures;
}

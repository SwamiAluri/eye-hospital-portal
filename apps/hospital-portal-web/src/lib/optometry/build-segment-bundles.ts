import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';
import type { IopSectionId } from './iop-section-constants';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';
import type {
  IopBundle,
  MedicalHistoryBundle,
  VisualAcuityBundle,
} from './optometry-history.types';
import type {
  IopMegaFormState,
  IopSectionSnapshotMap,
  IopSectionViewMode,
} from './iop-section-snapshot';
import type { VaSectionId } from './visual-acuity-constants';
import {
  sanitizeIopBundle,
  sanitizeMedicalHistoryBundle,
  sanitizeVisualAcuityBundle,
} from './sanitize-segment-bundle';

/** In-memory / draft IOP extended state (includes UI-only sectionDirty / sectionViewMode). */
export interface IopExtendedDraft {
  nct: IopMegaFormState['nct'];
  atn: IopMegaFormState['atn'];
  schirmer: IopMegaFormState['schirmer'];
  pachymetry: IopMegaFormState['pachymetry'];
  visualField: IopMegaFormState['visualField'];
  sectionRecorded?: Partial<Record<IopSectionId, boolean>>;
  sectionDirty?: Partial<Record<IopSectionId, boolean>>;
  sectionViewMode?: Partial<Record<IopSectionId, IopSectionViewMode>>;
  sectionRecordedAt?: Partial<Record<IopSectionId, string>>;
  sectionSnapshots?: IopSectionSnapshotMap;
}

/** In-memory / draft VA extended state (includes UI-only sectionDirty / sectionViewMode). */
export interface VaExtendedDraft {
  projectionRays?: unknown;
  distanceVision?: VisualAcuityBundle['distanceVision'];
  nearVision?: VisualAcuityBundle['nearVision'];
  oldGlass?: VisualAcuityBundle['oldGlass'];
  newPrescription?: VisualAcuityBundle['newPrescription'];
  refraction?: VisualAcuityBundle['refraction'];
  keratometry?: VisualAcuityBundle['keratometry'];
  colorVision?: VisualAcuityBundle['colorVision'];
  contrastSensitivity?: VisualAcuityBundle['contrastSensitivity'];
  sectionRecorded?: Partial<Record<VaSectionId, boolean>>;
  sectionDirty?: Partial<Record<VaSectionId, boolean>>;
  sectionViewMode?: Partial<Record<VaSectionId, string>>;
  sectionRecordedAt?: Partial<Record<VaSectionId, string>>;
  sectionSnapshots?: Partial<Record<VaSectionId, unknown>>;
}

export function buildMedicalHistoryBundle(
  snapshot: MedicalHistorySnapshot,
): MedicalHistoryBundle {
  return sanitizeMedicalHistoryBundle({ ...snapshot, version: 1 });
}

export function buildMedicalHistoryBundleFromRaw(raw: unknown): MedicalHistoryBundle | null {
  if (raw == null) return null;
  return sanitizeMedicalHistoryBundle(raw);
}

export function buildVisualAcuityBundle(raw: unknown): VisualAcuityBundle {
  return sanitizeVisualAcuityBundle(raw);
}

export function buildIopBundle(raw: unknown): IopBundle {
  return sanitizeIopBundle(raw);
}

/** Canonical in-memory IOP extended payload (used by IOPMegaTab push/sync). */
export function buildIopExtendedDraft(input: IopExtendedDraft): IopExtendedDraft {
  return {
    nct: input.nct,
    atn: input.atn,
    schirmer: input.schirmer,
    pachymetry: input.pachymetry,
    visualField: input.visualField,
    ...(input.sectionRecorded != null ? { sectionRecorded: input.sectionRecorded } : {}),
    ...(input.sectionDirty != null ? { sectionDirty: input.sectionDirty } : {}),
    ...(input.sectionViewMode != null ? { sectionViewMode: input.sectionViewMode } : {}),
    ...(input.sectionRecordedAt != null ? { sectionRecordedAt: input.sectionRecordedAt } : {}),
    ...(input.sectionSnapshots != null ? { sectionSnapshots: input.sectionSnapshots } : {}),
  };
}

/** Visit-segment IOP bundle from extended draft or raw extended state. */
export function buildIopBundleFromExtended(ext: IopExtendedDraft | unknown): IopBundle {
  return buildIopBundle(ext);
}

/** Canonical in-memory VA extended payload (used by VisualAcuityMegaTab push/sync). */
export function buildVaExtendedDraft(input: VaExtendedDraft): VaExtendedDraft {
  return {
    ...(input.projectionRays !== undefined ? { projectionRays: input.projectionRays } : {}),
    ...(input.distanceVision !== undefined ? { distanceVision: input.distanceVision } : {}),
    ...(input.nearVision !== undefined ? { nearVision: input.nearVision } : {}),
    ...(input.oldGlass !== undefined ? { oldGlass: input.oldGlass } : {}),
    ...(input.newPrescription !== undefined ? { newPrescription: input.newPrescription } : {}),
    ...(input.refraction !== undefined ? { refraction: input.refraction } : {}),
    ...(input.keratometry !== undefined ? { keratometry: input.keratometry } : {}),
    ...(input.colorVision !== undefined ? { colorVision: input.colorVision } : {}),
    ...(input.contrastSensitivity !== undefined
      ? { contrastSensitivity: input.contrastSensitivity }
      : {}),
    ...(input.sectionRecorded != null ? { sectionRecorded: input.sectionRecorded } : {}),
    ...(input.sectionDirty != null ? { sectionDirty: input.sectionDirty } : {}),
    ...(input.sectionViewMode != null ? { sectionViewMode: input.sectionViewMode } : {}),
    ...(input.sectionRecordedAt != null ? { sectionRecordedAt: input.sectionRecordedAt } : {}),
    ...(input.sectionSnapshots != null ? { sectionSnapshots: input.sectionSnapshots } : {}),
  };
}

export function buildVisualAcuityBundleFromExtended(ext: VaExtendedDraft | unknown): VisualAcuityBundle {
  return buildVisualAcuityBundle(ext);
}

/** Payload for posterior tab single-save (four segment keys). */
export interface PosteriorTabSegmentPayload {
  overview: PosteriorSegmentExamData;
  fundus: FundusExamData;
  vitreous: VitreousExamData;
  peripheralRetina: PeripheralRetinaExamData;
}

export function buildPosteriorTabSegmentPayload(
  input: PosteriorTabSegmentPayload,
): PosteriorTabSegmentPayload {
  return {
    overview: { ...input.overview },
    fundus: { ...input.fundus },
    vitreous: { ...input.vitreous },
    peripheralRetina: { ...input.peripheralRetina },
  };
}

/** Payload for anterior tab single-save (pupil + anterior segment). */
export interface AnteriorTabSegmentPayload {
  pupil: PupilExamData;
  segment: AnteriorSegmentExamData;
}

export function buildAnteriorTabSegmentPayload(
  input: AnteriorTabSegmentPayload,
): AnteriorTabSegmentPayload {
  return {
    pupil: { ...input.pupil },
    segment: { ...input.segment },
  };
}

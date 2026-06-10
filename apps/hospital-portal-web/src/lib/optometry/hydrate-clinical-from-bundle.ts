import type { ExamDraftSetters } from './apply-exam-draft';
import type { IOPMegaSnapshot, VisualAcuityMegaSnapshot } from './exam-mappers';
import {
  buildIopClinicalSlice,
  buildVaClinicalSlice,
} from './optometry-persistence';
import type { IopBundle, VisualAcuityBundle } from './optometry-history.types';
import { EMPTY_TONOMETRY_PHASE, EMPTY_PACHYMETRY, EMPTY_VISUAL_FIELD } from './iop-section-snapshot';
import {
  EMPTY_COLOR_VISION,
  EMPTY_CONTRAST,
  EMPTY_KERATOMETRY,
  EMPTY_REFRACTION,
  EMPTY_RX_BILATERAL,
  EMPTY_VA_BILATERAL,
} from './va-section-snapshot';

const EMPTY_PROJECTION_RAYS = {
  OD: {
    unaided: { superior: false, inferior: false, nasal: false, temporal: false },
    aided: { superior: false, inferior: false, nasal: false, temporal: false },
  },
  OS: {
    unaided: { superior: false, inferior: false, nasal: false, temporal: false },
    aided: { superior: false, inferior: false, nasal: false, temporal: false },
  },
};

export function vaMegaSnapshotFromBundle(bundle: VisualAcuityBundle): VisualAcuityMegaSnapshot {
  return {
    oldGlass: bundle.oldGlass ?? EMPTY_RX_BILATERAL,
    newPrescription: bundle.newPrescription ?? EMPTY_RX_BILATERAL,
    refraction: bundle.refraction ?? EMPTY_REFRACTION,
    distanceVision: bundle.distanceVision ?? EMPTY_VA_BILATERAL,
    nearVision: bundle.nearVision ?? EMPTY_VA_BILATERAL,
    projectionRays: (bundle.projectionRays as VisualAcuityMegaSnapshot['projectionRays']) ?? EMPTY_PROJECTION_RAYS,
    keratometry: bundle.keratometry ?? EMPTY_KERATOMETRY,
    colorVision: bundle.colorVision ?? EMPTY_COLOR_VISION,
    contrastSensitivity: bundle.contrastSensitivity ?? EMPTY_CONTRAST,
  };
}

export function iopMegaSnapshotFromBundle(bundle: IopBundle): IOPMegaSnapshot {
  const nct = bundle.nct ?? EMPTY_TONOMETRY_PHASE;
  return {
    nct: {
      beforeDilatation: {
        OD: { value: nct.beforeDilatation?.OD?.value ?? '' },
        OS: { value: nct.beforeDilatation?.OS?.value ?? '' },
      },
      afterDilatation: {
        OD: { value: nct.afterDilatation?.OD?.value ?? '' },
        OS: { value: nct.afterDilatation?.OS?.value ?? '' },
      },
    },
    pachymetry: {
      OD: { cct: bundle.pachymetry?.OD?.cct ?? EMPTY_PACHYMETRY.OD.cct },
      OS: { cct: bundle.pachymetry?.OS?.cct ?? EMPTY_PACHYMETRY.OS.cct },
    },
    visualField: {
      OD: {
        testType: bundle.visualField?.OD?.testType ?? EMPTY_VISUAL_FIELD.OD.testType,
        md: bundle.visualField?.OD?.md ?? '',
        psd: bundle.visualField?.OD?.psd ?? '',
        reliability: bundle.visualField?.OD?.reliability ?? EMPTY_VISUAL_FIELD.OD.reliability,
        defects: bundle.visualField?.OD?.defects ?? '',
      },
      OS: {
        testType: bundle.visualField?.OS?.testType ?? EMPTY_VISUAL_FIELD.OS.testType,
        md: bundle.visualField?.OS?.md ?? '',
        psd: bundle.visualField?.OS?.psd ?? '',
        reliability: bundle.visualField?.OS?.reliability ?? EMPTY_VISUAL_FIELD.OS.reliability,
        defects: bundle.visualField?.OS?.defects ?? '',
      },
    },
  };
}

/** Map visit VA bundle → parent clinical DTO slice (segment-first hydration). */
export function applyVaClinicalFromBundle(
  bundle: unknown,
  patientId: string,
  examinerId: string,
  setters: ExamDraftSetters,
): void {
  if (!bundle || typeof bundle !== 'object' || !patientId) return;
  const snap = vaMegaSnapshotFromBundle(bundle as VisualAcuityBundle);
  const slice = buildVaClinicalSlice(patientId, examinerId, snap, {});
  setters.setVisualAcuity(slice.visualAcuity);
  setters.setRefraction(slice.refraction);
  setters.setKeratometry(slice.keratometry);
  setters.setColorVision(slice.colorVision);
  setters.setContrastSensitivity(slice.contrastSensitivity);
}

/** Map visit IOP bundle → parent clinical DTO slice (segment-first hydration). */
export function applyIopClinicalFromBundle(
  bundle: unknown,
  patientId: string,
  examinerId: string,
  setters: ExamDraftSetters,
): void {
  if (!bundle || typeof bundle !== 'object' || !patientId) return;
  const snap = iopMegaSnapshotFromBundle(bundle as IopBundle);
  const slice = buildIopClinicalSlice(patientId, examinerId, snap, {});
  setters.setTonometry(slice.tonometry);
  setters.setPachymetry(slice.pachymetry);
  setters.setVisualField(slice.visualField);
}

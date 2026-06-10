import type { VaSectionId } from './visual-acuity-constants';
import type { EyeRx } from '@/components/examination/exam-ui/RxBilateralPrescriptionCard';

export type VaSectionViewMode = 'view' | 'editing';

/** Migrate persisted view modes from older builds. */
export function normalizeVaSectionViewMode(
  mode?: VaSectionViewMode | 'summary' | 'edit',
): VaSectionViewMode {
  if (mode === 'editing' || mode === 'edit') return 'editing';
  return 'view';
}

export const EMPTY_EYE_RX: EyeRx = { sphere: '', cylinder: '', axis: '', va: '' };
export const EMPTY_RX_BILATERAL = { OD: { ...EMPTY_EYE_RX }, OS: { ...EMPTY_EYE_RX } };
export const EMPTY_VA_EYE = { unaided: '', aided: '' };
export const EMPTY_VA_BILATERAL = { OD: { ...EMPTY_VA_EYE }, OS: { ...EMPTY_VA_EYE } };
export const EMPTY_REFRACTION = {
  OD: { sphere: '', cylinder: '', axis: '' },
  OS: { sphere: '', cylinder: '', axis: '' },
};
export const EMPTY_KERATOMETRY = {
  OD: { k1: '', k2: '', axis: '' },
  OS: { k1: '', k2: '', axis: '' },
};
export const EMPTY_COLOR_VISION = { testType: '', result: '', platesMissed: '' };
export const EMPTY_CONTRAST = {
  testType: '',
  OD: { score: '', interpretation: '' },
  OS: { score: '', interpretation: '' },
};

export type VaSectionSnapshotMap = Partial<Record<VaSectionId, unknown>>;

export interface VaMegaFormState {
  oldGlass: { OD: EyeRx; OS: EyeRx };
  newPrescription: { OD: EyeRx; OS: EyeRx };
  refraction: { OD: { sphere: string; cylinder: string; axis: string }; OS: { sphere: string; cylinder: string; axis: string } };
  distanceVision: { OD: { unaided: string; aided: string }; OS: { unaided: string; aided: string } };
  nearVision: { OD: { unaided: string; aided: string }; OS: { unaided: string; aided: string } };
  projectionRays: {
    OD: {
      unaided: { superior: boolean; inferior: boolean; nasal: boolean; temporal: boolean };
      aided: { superior: boolean; inferior: boolean; nasal: boolean; temporal: boolean };
    };
    OS: {
      unaided: { superior: boolean; inferior: boolean; nasal: boolean; temporal: boolean };
      aided: { superior: boolean; inferior: boolean; nasal: boolean; temporal: boolean };
    };
  };
  keratometry: { OD: { k1: string; k2: string; axis: string }; OS: { k1: string; k2: string; axis: string } };
  colorVision: { testType: string; result: string; platesMissed: string };
  contrastSensitivity: {
    testType: string;
    OD: { score: string; interpretation: string };
    OS: { score: string; interpretation: string };
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function extractSectionSnapshot(
  sectionId: VaSectionId,
  state: VaMegaFormState,
): unknown {
  switch (sectionId) {
    case 'old':
      return clone(state.oldGlass);
    case 'new':
      return clone(state.newPrescription);
    case 'refraction':
      return clone(state.refraction);
    case 'distance':
      return {
        distanceVision: clone(state.distanceVision),
        nearVision: clone(state.nearVision),
        projectionRays: clone(state.projectionRays),
      };
    case 'keratometry':
      return clone(state.keratometry);
    case 'color':
      return clone(state.colorVision);
    case 'contrast':
      return clone(state.contrastSensitivity);
    default:
      return null;
  }
}

type SectionSetters = {
  setOldGlass: (v: VaMegaFormState['oldGlass']) => void;
  setNewPrescription: (v: VaMegaFormState['newPrescription']) => void;
  setRefraction: (v: VaMegaFormState['refraction']) => void;
  setDistanceVision: (v: VaMegaFormState['distanceVision']) => void;
  setNearVision: (v: VaMegaFormState['nearVision']) => void;
  setProjectionRays: (v: VaMegaFormState['projectionRays']) => void;
  setKeratometry: (v: VaMegaFormState['keratometry']) => void;
  setColorVision: (v: VaMegaFormState['colorVision']) => void;
  setContrastSensitivity: (v: VaMegaFormState['contrastSensitivity']) => void;
};

export function applySectionSnapshot(
  sectionId: VaSectionId,
  snapshot: unknown,
  setters: SectionSetters,
): void {
  if (!snapshot) return;
  switch (sectionId) {
    case 'old':
      setters.setOldGlass(snapshot as VaMegaFormState['oldGlass']);
      break;
    case 'new':
      setters.setNewPrescription(snapshot as VaMegaFormState['newPrescription']);
      break;
    case 'refraction':
      setters.setRefraction(snapshot as VaMegaFormState['refraction']);
      break;
    case 'distance': {
      const d = snapshot as {
        distanceVision: VaMegaFormState['distanceVision'];
        nearVision: VaMegaFormState['nearVision'];
        projectionRays: VaMegaFormState['projectionRays'];
      };
      setters.setDistanceVision(d.distanceVision);
      setters.setNearVision(d.nearVision);
      setters.setProjectionRays(d.projectionRays);
      break;
    }
    case 'keratometry':
      setters.setKeratometry(snapshot as VaMegaFormState['keratometry']);
      break;
    case 'color':
      setters.setColorVision(snapshot as VaMegaFormState['colorVision']);
      break;
    case 'contrast':
      setters.setContrastSensitivity(snapshot as VaMegaFormState['contrastSensitivity']);
      break;
    default:
      break;
  }
}

export function clearSectionLiveState(sectionId: VaSectionId, setters: SectionSetters): void {
  switch (sectionId) {
    case 'old':
      setters.setOldGlass(clone(EMPTY_RX_BILATERAL));
      break;
    case 'new':
      setters.setNewPrescription(clone(EMPTY_RX_BILATERAL));
      break;
    case 'refraction':
      setters.setRefraction(clone(EMPTY_REFRACTION));
      break;
    case 'distance':
      setters.setDistanceVision(clone(EMPTY_VA_BILATERAL));
      setters.setNearVision(clone(EMPTY_VA_BILATERAL));
      setters.setProjectionRays({
        OD: {
          unaided: { superior: false, inferior: false, nasal: false, temporal: false },
          aided: { superior: false, inferior: false, nasal: false, temporal: false },
        },
        OS: {
          unaided: { superior: false, inferior: false, nasal: false, temporal: false },
          aided: { superior: false, inferior: false, nasal: false, temporal: false },
        },
      });
      break;
    case 'keratometry':
      setters.setKeratometry(clone(EMPTY_KERATOMETRY));
      break;
    case 'color':
      setters.setColorVision({ ...EMPTY_COLOR_VISION });
      break;
    case 'contrast':
      setters.setContrastSensitivity(clone(EMPTY_CONTRAST));
      break;
    default:
      break;
  }
}

function hasNonEmpty(...values: unknown[]): boolean {
  return values.some((v) => v != null && String(v).trim() !== '');
}

function hasRxEyeContent(eye: { sphere?: string; cylinder?: string; axis?: string; va?: string }): boolean {
  return hasNonEmpty(eye.sphere, eye.cylinder, eye.axis, eye.va);
}

function hasVaEyeContent(eye: { unaided?: string; aided?: string }): boolean {
  return hasNonEmpty(eye.unaided, eye.aided);
}

function hasProjectionRaysContent(
  pr: VaMegaFormState['projectionRays'] | undefined,
): boolean {
  if (!pr) return false;
  return (['OD', 'OS'] as const).some((eye) => {
    const e = pr[eye];
    return (
      Object.values(e.unaided).some(Boolean) ||
      Object.values(e.aided).some(Boolean)
    );
  });
}

/** True when live form fields for a section have at least one value. */
export function hasSectionLiveContent(sectionId: VaSectionId, state: VaMegaFormState): boolean {
  return hasSectionShellContent(sectionId, extractSectionSnapshot(sectionId, state));
}

/** True when ephemeral shell has at least one user-entered value. */
export function hasSectionShellContent(sectionId: VaSectionId, shell: unknown): boolean {
  if (shell == null) return false;
  switch (sectionId) {
    case 'old':
    case 'new': {
      const rx = shell as { OD: EyeRx; OS: EyeRx };
      return hasRxEyeContent(rx.OD) || hasRxEyeContent(rx.OS);
    }
    case 'refraction': {
      const r = shell as VaMegaFormState['refraction'];
      return hasRxEyeContent({ ...r.OD, va: '' }) || hasRxEyeContent({ ...r.OS, va: '' });
    }
    case 'distance': {
      const d = shell as {
        distanceVision?: VaMegaFormState['distanceVision'];
        nearVision?: VaMegaFormState['nearVision'];
        projectionRays?: VaMegaFormState['projectionRays'];
      };
      return (
        hasVaEyeContent(d.distanceVision?.OD ?? {}) ||
        hasVaEyeContent(d.distanceVision?.OS ?? {}) ||
        hasVaEyeContent(d.nearVision?.OD ?? {}) ||
        hasVaEyeContent(d.nearVision?.OS ?? {}) ||
        hasProjectionRaysContent(d.projectionRays)
      );
    }
    case 'keratometry': {
      const k = shell as VaMegaFormState['keratometry'];
      return (
        hasNonEmpty(k.OD.k1, k.OD.k2, k.OD.axis) ||
        hasNonEmpty(k.OS.k1, k.OS.k2, k.OS.axis)
      );
    }
    case 'color': {
      const c = shell as VaMegaFormState['colorVision'];
      return hasNonEmpty(c.testType, c.result, c.platesMissed);
    }
    case 'contrast': {
      const cs = shell as VaMegaFormState['contrastSensitivity'];
      return hasNonEmpty(cs.OD.score, cs.OS.score, cs.testType);
    }
    default:
      return false;
  }
}

/** Copy shell snapshot into live React state (call before record/update). */
export function applyShellToLiveState(
  sectionId: VaSectionId,
  shell: unknown,
  setters: SectionSetters,
): void {
  if (shell != null) {
    applySectionSnapshot(sectionId, shell, setters);
  }
}

/** Returns a new mega form state with shell values applied for one section. */
export function applyShellToMegaState(
  sectionId: VaSectionId,
  state: VaMegaFormState,
  shell: unknown,
): VaMegaFormState {
  if (shell == null) return state;
  const next = clone(state);
  applySectionSnapshot(sectionId, shell, {
    setOldGlass: (v) => {
      next.oldGlass = v;
    },
    setNewPrescription: (v) => {
      next.newPrescription = v;
    },
    setRefraction: (v) => {
      next.refraction = v;
    },
    setDistanceVision: (v) => {
      next.distanceVision = v;
    },
    setNearVision: (v) => {
      next.nearVision = v;
    },
    setProjectionRays: (v) => {
      next.projectionRays = v;
    },
    setKeratometry: (v) => {
      next.keratometry = v;
    },
    setColorVision: (v) => {
      next.colorVision = v;
    },
    setContrastSensitivity: (v) => {
      next.contrastSensitivity = v;
    },
  });
  return next;
}

/** Merge recorded snapshots with live form for clinical draft / summary. */
export function buildEffectiveVaFormState(
  state: VaMegaFormState,
  sectionRecorded: Partial<Record<VaSectionId, boolean>>,
  sectionViewMode: Partial<Record<VaSectionId, VaSectionViewMode>>,
  sectionSnapshots: VaSectionSnapshotMap,
): VaMegaFormState & { powerChangeOd?: string; powerChangeOs?: string } {
  const pick = <T>(id: VaSectionId, live: T, fromSnapshot: (snap: unknown) => T): T => {
    if (!sectionRecorded[id]) return live;
    if (sectionViewMode[id] === 'editing') return live;
    const snap = sectionSnapshots[id];
    return snap != null ? fromSnapshot(snap) : live;
  };

  const oldGlass = pick('old', state.oldGlass, (s) => s as VaMegaFormState['oldGlass']);
  const newPrescription = pick('new', state.newPrescription, (s) => s as VaMegaFormState['newPrescription']);
  const refraction = pick('refraction', state.refraction, (s) => s as VaMegaFormState['refraction']);

  const distanceSnap = sectionSnapshots.distance as
    | { distanceVision: VaMegaFormState['distanceVision']; nearVision: VaMegaFormState['nearVision']; projectionRays: VaMegaFormState['projectionRays'] }
    | undefined;
  const distanceVision = pick('distance', state.distanceVision, () => distanceSnap!.distanceVision);
  const nearVision = pick('distance', state.nearVision, () => distanceSnap!.nearVision);
  const projectionRays = pick('distance', state.projectionRays, () => distanceSnap!.projectionRays);

  const keratometry = pick('keratometry', state.keratometry, (s) => s as VaMegaFormState['keratometry']);
  const colorVision = pick('color', state.colorVision, (s) => s as VaMegaFormState['colorVision']);
  const contrastSensitivity = pick(
    'contrast',
    state.contrastSensitivity,
    (s) => s as VaMegaFormState['contrastSensitivity'],
  );

  return {
    ...state,
    oldGlass,
    newPrescription,
    refraction,
    distanceVision,
    nearVision,
    projectionRays,
    keratometry,
    colorVision,
    contrastSensitivity,
  };
}

export function snapshotToSummaryData(
  sectionId: VaSectionId,
  snapshot: unknown,
  state: VaMegaFormState,
): Parameters<typeof import('./va-section-summary').buildVaSectionSummaryLines>[1] {
  const effective = { ...state };
  applySectionSnapshot(sectionId, snapshot, {
    setOldGlass: (v) => {
      effective.oldGlass = v;
    },
    setNewPrescription: (v) => {
      effective.newPrescription = v;
    },
    setRefraction: (v) => {
      effective.refraction = v;
    },
    setDistanceVision: (v) => {
      effective.distanceVision = v;
    },
    setNearVision: (v) => {
      effective.nearVision = v;
    },
    setProjectionRays: (v) => {
      effective.projectionRays = v;
    },
    setKeratometry: (v) => {
      effective.keratometry = v;
    },
    setColorVision: (v) => {
      effective.colorVision = v;
    },
    setContrastSensitivity: (v) => {
      effective.contrastSensitivity = v;
    },
  });
  return {
    oldGlass: effective.oldGlass,
    newPrescription: effective.newPrescription,
    refraction: effective.refraction,
    distanceVision: effective.distanceVision,
    nearVision: effective.nearVision,
    keratometry: effective.keratometry,
    colorVision: effective.colorVision,
    contrastSensitivity: effective.contrastSensitivity,
  };
}

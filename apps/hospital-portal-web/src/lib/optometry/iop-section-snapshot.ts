import type { IopSectionId } from './iop-section-constants';
import type { VisualFieldEyeState } from '@/components/examination/exam-ui/VisualFieldBilateralTable';

export type IopSectionViewMode = 'view' | 'editing';

export function normalizeIopSectionViewMode(
  mode?: IopSectionViewMode | 'summary' | 'edit',
): IopSectionViewMode {
  if (mode === 'editing' || mode === 'edit') return 'editing';
  return 'view';
}

export interface IopEyeMeasurement {
  value: string;
  time: string;
}

export interface IopTonometryPhase {
  beforeDilatation: { OD: IopEyeMeasurement; OS: IopEyeMeasurement };
  afterDilatation: { OD: IopEyeMeasurement; OS: IopEyeMeasurement };
}

export interface SchirmerEye {
  measurement: string;
  time: string;
  interpretation: string;
}

export interface PachymetryEye {
  cct: string;
  correctedIOP: string;
}

export const EMPTY_IOP_EYE: IopEyeMeasurement = { value: '', time: '' };
export const EMPTY_TONOMETRY_PHASE: IopTonometryPhase = {
  beforeDilatation: { OD: { ...EMPTY_IOP_EYE }, OS: { ...EMPTY_IOP_EYE } },
  afterDilatation: { OD: { ...EMPTY_IOP_EYE }, OS: { ...EMPTY_IOP_EYE } },
};
export const EMPTY_SCHIRMER = {
  OD: { measurement: '', time: '', interpretation: '' },
  OS: { measurement: '', time: '', interpretation: '' },
};
export const EMPTY_PACHYMETRY = {
  OD: { cct: '', correctedIOP: '' },
  OS: { cct: '', correctedIOP: '' },
};
export const EMPTY_VISUAL_FIELD = {
  OD: { testType: 'Automated Perimetry', md: '', psd: '', reliability: 'Good', defects: '' },
  OS: { testType: 'Automated Perimetry', md: '', psd: '', reliability: 'Good', defects: '' },
};

export type IopSectionSnapshotMap = Partial<Record<IopSectionId, unknown>>;

export interface IopMegaFormState {
  nct: IopTonometryPhase;
  atn: IopTonometryPhase;
  schirmer: { OD: SchirmerEye; OS: SchirmerEye };
  pachymetry: { OD: PachymetryEye; OS: PachymetryEye };
  visualField: { OD: VisualFieldEyeState; OS: VisualFieldEyeState };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasNonEmpty(...values: unknown[]): boolean {
  return values.some((v) => v != null && String(v).trim() !== '');
}

function hasTonometryContent(phase: IopTonometryPhase): boolean {
  return (
    hasNonEmpty(
      phase.beforeDilatation.OD.value,
      phase.beforeDilatation.OD.time,
      phase.beforeDilatation.OS.value,
      phase.beforeDilatation.OS.time,
      phase.afterDilatation.OD.value,
      phase.afterDilatation.OD.time,
      phase.afterDilatation.OS.value,
      phase.afterDilatation.OS.time,
    )
  );
}

export function extractSectionSnapshot(
  sectionId: IopSectionId,
  state: IopMegaFormState,
): unknown {
  switch (sectionId) {
    case 'nct':
      return clone(state.nct);
    case 'atn':
      return clone(state.atn);
    case 'schirmer':
      return clone(state.schirmer);
    case 'pachymetry':
      return clone(state.pachymetry);
    case 'visual-field':
      return clone(state.visualField);
    default:
      return null;
  }
}

type SectionSetters = {
  setNct: (v: IopTonometryPhase) => void;
  setAtn: (v: IopTonometryPhase) => void;
  setSchirmer: (v: IopMegaFormState['schirmer']) => void;
  setPachymetry: (v: IopMegaFormState['pachymetry']) => void;
  setVisualField: (v: IopMegaFormState['visualField']) => void;
};

export function applySectionSnapshot(
  sectionId: IopSectionId,
  snapshot: unknown,
  setters: SectionSetters,
): void {
  if (!snapshot) return;
  switch (sectionId) {
    case 'nct':
      setters.setNct(snapshot as IopTonometryPhase);
      break;
    case 'atn':
      setters.setAtn(snapshot as IopTonometryPhase);
      break;
    case 'schirmer':
      setters.setSchirmer(snapshot as IopMegaFormState['schirmer']);
      break;
    case 'pachymetry':
      setters.setPachymetry(snapshot as IopMegaFormState['pachymetry']);
      break;
    case 'visual-field':
      setters.setVisualField(snapshot as IopMegaFormState['visualField']);
      break;
    default:
      break;
  }
}

export function clearSectionLiveState(sectionId: IopSectionId, setters: SectionSetters): void {
  switch (sectionId) {
    case 'nct':
      setters.setNct(clone(EMPTY_TONOMETRY_PHASE));
      break;
    case 'atn':
      setters.setAtn(clone(EMPTY_TONOMETRY_PHASE));
      break;
    case 'schirmer':
      setters.setSchirmer(clone(EMPTY_SCHIRMER));
      break;
    case 'pachymetry':
      setters.setPachymetry(clone(EMPTY_PACHYMETRY));
      break;
    case 'visual-field':
      setters.setVisualField(clone(EMPTY_VISUAL_FIELD));
      break;
    default:
      break;
  }
}

export function hasSectionShellContent(sectionId: IopSectionId, shell: unknown): boolean {
  if (shell == null) return false;
  switch (sectionId) {
    case 'nct':
      return hasTonometryContent(shell as IopTonometryPhase);
    case 'atn':
      return hasTonometryContent(shell as IopTonometryPhase);
    case 'schirmer': {
      const s = shell as IopMegaFormState['schirmer'];
      return (
        hasNonEmpty(s.OD.measurement, s.OD.time, s.OS.measurement, s.OS.time)
      );
    }
    case 'pachymetry': {
      const p = shell as IopMegaFormState['pachymetry'];
      return hasNonEmpty(p.OD.cct, p.OS.cct);
    }
    case 'visual-field': {
      const vf = shell as IopMegaFormState['visualField'];
      return (
        hasNonEmpty(
          vf.OD.md,
          vf.OD.psd,
          vf.OD.defects,
          vf.OS.md,
          vf.OS.psd,
          vf.OS.defects,
        ) || vf.OD.testType !== 'Automated Perimetry' || vf.OS.testType !== 'Automated Perimetry'
      );
    }
    default:
      return false;
  }
}

export function hasSectionLiveContent(sectionId: IopSectionId, state: IopMegaFormState): boolean {
  return hasSectionShellContent(sectionId, extractSectionSnapshot(sectionId, state));
}

export function applyShellToLiveState(
  sectionId: IopSectionId,
  shell: unknown,
  setters: SectionSetters,
): void {
  if (shell != null) applySectionSnapshot(sectionId, shell, setters);
}

export function applyShellToMegaState(
  sectionId: IopSectionId,
  state: IopMegaFormState,
  shell: unknown,
): IopMegaFormState {
  if (shell == null) return state;
  const next = { ...state };
  switch (sectionId) {
    case 'nct':
      next.nct = shell as IopTonometryPhase;
      break;
    case 'atn':
      next.atn = shell as IopTonometryPhase;
      break;
    case 'schirmer':
      next.schirmer = shell as IopMegaFormState['schirmer'];
      break;
    case 'pachymetry':
      next.pachymetry = shell as IopMegaFormState['pachymetry'];
      break;
    case 'visual-field':
      next.visualField = shell as IopMegaFormState['visualField'];
      break;
    default:
      break;
  }
  return next;
}

export function buildEffectiveIopFormState(
  live: IopMegaFormState,
  sectionRecorded: Partial<Record<IopSectionId, boolean>>,
  sectionViewMode: Partial<Record<IopSectionId, IopSectionViewMode>>,
  sectionSnapshots: IopSectionSnapshotMap,
): IopMegaFormState {
  let effective = { ...live };
  (Object.keys(sectionRecorded) as IopSectionId[]).forEach((id) => {
    if (!sectionRecorded[id]) return;
    const mode = normalizeIopSectionViewMode(sectionViewMode[id]);
    if (mode === 'editing') return;
    const snap = sectionSnapshots[id];
    if (snap != null) {
      effective = applyShellToMegaState(id, effective, snap);
    }
  });
  return effective;
}

/**
 * Lightweight self-check for segment bundle builders (Phase 1 exit criteria).
 * Run: npm run test:unit:optometry
 */
import {
  buildAnteriorTabSegmentPayload,
  buildIopBundle,
  buildIopBundleFromExtended,
  buildMedicalHistoryBundle,
  buildPosteriorTabSegmentPayload,
  buildVisualAcuityBundle,
  buildVisualAcuityBundleFromExtended,
} from './build-segment-bundles';
import {
  DEFAULT_ANTERIOR_SEGMENT,
  DEFAULT_FUNDUS_EXAM,
  DEFAULT_PERIPHERAL_RETINA_EXAM,
  DEFAULT_POSTERIOR_SEGMENT,
  DEFAULT_PUPIL_EXAM,
  DEFAULT_VITREOUS_EXAM,
} from './visit-segment-defaults';
import { VA_SEGMENT_UI_ONLY_KEYS, IOP_SEGMENT_UI_ONLY_KEYS } from './sanitize-segment-bundle';
import { pickMedicalHistoryLoadSnapshot } from '@/lib/medical-history/medical-history-snapshot';
import { formatPosteriorTabLastVisitLine } from './posterior-segment-tab-utils';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runSegmentBundleSelfCheck(): void {
  const vaRaw = {
    version: 1,
    oldGlass: {
      OD: { sphere: '+1', cylinder: '', axis: '', va: '6/6' },
      OS: { sphere: '+1', cylinder: '', axis: '', va: '6/6' },
    },
    sectionDirty: { old: true },
    sectionViewMode: { old: 'editing' },
  };
  const va = buildVisualAcuityBundle(vaRaw);
  assert(va.version === 1, 'VA bundle version');
  for (const key of VA_SEGMENT_UI_ONLY_KEYS) {
    assert(!(key in va), `VA bundle must not contain ${key}`);
  }

  const vaFromExtended = buildVisualAcuityBundleFromExtended(vaRaw);
  assert(JSON.stringify(va) === JSON.stringify(vaFromExtended), 'VA extended builder matches');

  const iopRaw = {
    version: 1,
    nct: {
      beforeDilatation: { OD: { value: '14', time: '' }, OS: { value: '15', time: '' } },
      afterDilatation: { OD: { value: '', time: '' }, OS: { value: '', time: '' } },
    },
    pachymetry: { OD: { cct: '540' }, OS: { cct: '545' } },
    visualField: { OD: { result: 'Full' }, OS: { result: 'Full' } },
    sectionDirty: { nct: true },
    sectionViewMode: { nct: 'editing' },
  };
  const iop = buildIopBundle(iopRaw);
  assert(iop.version === 1, 'IOP bundle version');
  assert(iop.pachymetry != null, 'IOP bundle includes pachymetry');
  assert(iop.visualField != null, 'IOP bundle includes visualField');
  for (const key of IOP_SEGMENT_UI_ONLY_KEYS) {
    assert(!(key in iop), `IOP bundle must not contain ${key}`);
  }

  const iopFromExtended = buildIopBundleFromExtended(iopRaw);
  assert(JSON.stringify(iop) === JSON.stringify(iopFromExtended), 'IOP extended builder matches');

  const mh = buildMedicalHistoryBundle({ nkda: true, allergies: [], chronicConditions: [] });
  assert(mh.version === 1, 'MH bundle version');
  assert(mh.nkda === true, 'MH bundle preserves nkda');

  const va2 = buildVisualAcuityBundle(vaRaw);
  assert(JSON.stringify(va) === JSON.stringify(va2), 'VA builder is idempotent');
  const iop2 = buildIopBundle(iopRaw);
  assert(JSON.stringify(iop) === JSON.stringify(iop2), 'IOP builder is idempotent');

  const segmentMh = { version: 1, nkda: false, allergies: [{ id: '1', allergenName: 'Dust' }] };
  const draftMh = { version: 1, nkda: true, allergies: [] };
  const picked = pickMedicalHistoryLoadSnapshot({
    visitSegment: segmentMh as never,
    draft: draftMh as never,
    patient: null,
  });
  assert(picked?.nkda === false, 'MH load picks visit segment over draft');

  const pupil = {
    ...DEFAULT_PUPIL_EXAM,
    sizeLightOD: 3,
    sizeLightOS: 3,
    sizeDarkOD: 5,
    sizeDarkOS: 5,
    shapeOD: 'Round',
    shapeOS: 'Round',
    directReactionOD: 'Brisk',
    directReactionOS: 'Brisk',
    consensualReactionOD: 'Brisk',
    consensualReactionOS: 'Brisk',
  };
  const anteriorIn = { pupil, segment: { ...DEFAULT_ANTERIOR_SEGMENT, lidsOD: 'Normal' } };
  const anteriorOut = buildAnteriorTabSegmentPayload(anteriorIn);
  assert(anteriorOut.pupil.sizeLightOD === 3, 'AS builder copies pupil');
  assert(anteriorOut.segment.lidsOD === 'Normal', 'AS builder copies segment');
  assert(anteriorOut.segment !== anteriorIn.segment, 'AS builder shallow-clones segment');

  const posteriorIn = {
    overview: { ...DEFAULT_POSTERIOR_SEGMENT, mediaClarityOD: 'Clear' },
    fundus: { ...DEFAULT_FUNDUS_EXAM, cupDiscRatioOD: '0.3' },
    vitreous: { ...DEFAULT_VITREOUS_EXAM, clarityOD: 'Clear' },
    peripheralRetina: { ...DEFAULT_PERIPHERAL_RETINA_EXAM, peripheralAppearanceOD: 'Normal' },
  };
  const posteriorOut = buildPosteriorTabSegmentPayload(posteriorIn);
  assert(posteriorOut.overview.mediaClarityOD === 'Clear', 'PS builder copies overview');
  assert(posteriorOut.fundus.cupDiscRatioOD === '0.3', 'PS builder copies fundus');
  assert(posteriorOut.vitreous.clarityOD === 'Clear', 'PS builder copies vitreous');
  assert(posteriorOut.peripheralRetina.peripheralAppearanceOD === 'Normal', 'PS builder copies peripheral');
  assert(posteriorOut.fundus !== posteriorIn.fundus, 'PS builder shallow-clones fundus');

  const priorLine = formatPosteriorTabLastVisitLine({
    posteriorSegment: {
      isDilatedOD: true,
      mediaClarityOD: 'Clear',
      overallFindingOD: 'Abnormal - specify below',
    },
    fundusExam: { cupDiscRatioOD: '0.4' },
    vitreousExam: { clarityOD: 'Clear' },
    peripheralRetinaExam: { peripheralAppearanceOD: 'Normal' },
  });
  assert(priorLine != null && priorLine.includes('Dilated'), 'PS prior line includes dilation');
  assert(priorLine.includes('Abnormal fundus'), 'PS prior line includes abnormal fundus snippet');
  assert(priorLine.includes('C/D OD 0.4'), 'PS prior line includes C/D');
}

runSegmentBundleSelfCheck();
console.log('segment-bundles self-check passed');

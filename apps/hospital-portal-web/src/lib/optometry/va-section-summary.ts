import type { VaSectionId } from './visual-acuity-constants';
import type { EyeRx } from '@/components/examination/exam-ui/RxBilateralPrescriptionCard';

function rxLine(eye: string, r: { sphere: string; cylinder: string; axis: string; va?: string }) {
  const parts = [r.sphere, r.cylinder, r.axis].filter(Boolean);
  const sca = parts.length ? parts.join(' / ') : '—';
  const va = r.va ? ` · VA ${r.va}` : '';
  return `${eye}: ${sca}${va}`;
}

function scaLine(eye: string, r: { sphere: string; cylinder: string; axis: string }) {
  const parts = [r.sphere, r.cylinder, r.axis].filter(Boolean);
  return `${eye}: ${parts.length ? parts.join(' / ') : '—'}`;
}

export interface VaSectionSummaryLine {
  label?: string;
  value: string;
}

export function buildVaSectionSummaryLines(
  sectionId: VaSectionId,
  data: {
    oldGlass: { OD: EyeRx; OS: EyeRx };
    newPrescription: { OD: EyeRx; OS: EyeRx };
    refraction: { OD: { sphere: string; cylinder: string; axis: string }; OS: { sphere: string; cylinder: string; axis: string } };
    distanceVision: { OD: { unaided: string; aided: string }; OS: { unaided: string; aided: string } };
    nearVision: { OD: { unaided: string; aided: string }; OS: { unaided: string; aided: string } };
    keratometry: { OD: { k1: string; k2: string; axis: string }; OS: { k1: string; k2: string; axis: string } };
    colorVision: { testType: string; result: string; platesMissed: string };
    contrastSensitivity: {
      testType: string;
      OD: { score: string; interpretation: string };
      OS: { score: string; interpretation: string };
    };
    powerChangeOd?: string;
    powerChangeOs?: string;
  },
): VaSectionSummaryLine[] {
  switch (sectionId) {
    case 'old':
      return [
        { value: rxLine('OD', data.oldGlass.OD) },
        { value: rxLine('OS', data.oldGlass.OS) },
      ];
    case 'new': {
      const lines: VaSectionSummaryLine[] = [
        { value: rxLine('OD', data.newPrescription.OD) },
        { value: rxLine('OS', data.newPrescription.OS) },
      ];
      if (data.powerChangeOd) lines.push({ label: 'Δ power', value: `OD ${data.powerChangeOd}` });
      if (data.powerChangeOs) lines.push({ label: 'Δ power', value: `OS ${data.powerChangeOs}` });
      return lines;
    }
    case 'refraction':
      return [scaLine('OD', data.refraction.OD), scaLine('OS', data.refraction.OS)];
    case 'distance':
      return [
        {
          label: 'Distance',
          value: `OD ${data.distanceVision.OD.unaided || '—'} / ${data.distanceVision.OD.aided || '—'} aided · OS ${data.distanceVision.OS.unaided || '—'} / ${data.distanceVision.OS.aided || '—'} aided`,
        },
        {
          label: 'Near',
          value: `OD ${data.nearVision.OD.unaided || '—'} / ${data.nearVision.OD.aided || '—'} · OS ${data.nearVision.OS.unaided || '—'} / ${data.nearVision.OS.aided || '—'}`,
        },
      ];
    case 'keratometry':
      return [
        {
          value: `OD K1 ${data.keratometry.OD.k1 || '—'} · K2 ${data.keratometry.OD.k2 || '—'} × ${data.keratometry.OD.axis || '—'}`,
        },
        {
          value: `OS K1 ${data.keratometry.OS.k1 || '—'} · K2 ${data.keratometry.OS.k2 || '—'} × ${data.keratometry.OS.axis || '—'}`,
        },
      ];
    case 'color':
      return [
        { label: 'Test', value: data.colorVision.testType },
        { label: 'Result', value: data.colorVision.result },
        ...(data.colorVision.platesMissed
          ? [{ label: 'Plates missed', value: data.colorVision.platesMissed }]
          : []),
      ];
    case 'contrast':
      return [
        { label: 'Test', value: data.contrastSensitivity.testType },
        {
          label: 'OD',
          value: `${data.contrastSensitivity.OD.score || '—'}${data.contrastSensitivity.OD.interpretation ? ` (${data.contrastSensitivity.OD.interpretation})` : ''}`,
        },
        {
          label: 'OS',
          value: `${data.contrastSensitivity.OS.score || '—'}${data.contrastSensitivity.OS.interpretation ? ` (${data.contrastSensitivity.OS.interpretation})` : ''}`,
        },
      ];
    default:
      return [];
  }
}

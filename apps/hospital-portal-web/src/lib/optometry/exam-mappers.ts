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

const parseNum = (v: string) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

export interface VisualAcuityMegaSnapshot {
  distanceVision: {
    OD: { unaided: string; aided: string };
    OS: { unaided: string; aided: string };
  };
  nearVision: {
    OD: { unaided: string; aided: string };
    OS: { unaided: string; aided: string };
  };
  oldGlass: {
    OD: { sphere: string; cylinder: string; axis: string; va: string };
    OS: { sphere: string; cylinder: string; axis: string; va: string };
  };
  newPrescription: {
    OD: { sphere: string; cylinder: string; axis: string; va: string };
    OS: { sphere: string; cylinder: string; axis: string; va: string };
  };
  refraction: {
    OD: { sphere: string; cylinder: string; axis: string };
    OS: { sphere: string; cylinder: string; axis: string };
  };
  keratometry: {
    OD: { k1: string; k2: string; axis: string };
    OS: { k1: string; k2: string; axis: string };
  };
  colorVision: { testType: string; result: string; platesMissed: string };
  contrastSensitivity: {
    testType: string;
    OD: { score: string; interpretation: string };
    OS: { score: string; interpretation: string };
  };
}

export function buildVisualAcuityPayload(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing?: VisualAcuityData | null,
): VisualAcuityData {
  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    distanceVA: {
      OD: {
        unaided: snap.distanceVision.OD.unaided || '6/6',
        aided: snap.distanceVision.OD.aided || undefined,
      },
      OS: {
        unaided: snap.distanceVision.OS.unaided || '6/6',
        aided: snap.distanceVision.OS.aided || undefined,
      },
    },
    nearVA: {
      OD: {
        unaided: snap.nearVision.OD.unaided || 'N6',
        aided: snap.nearVision.OD.aided || undefined,
      },
      OS: {
        unaided: snap.nearVision.OS.unaided || 'N6',
        aided: snap.nearVision.OS.aided || undefined,
      },
    },
    chart: existing?.chart ?? 'Snellen',
    testingDistance: existing?.testingDistance ?? '6 meters',
  };
}

export function buildRefractionPayload(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing?: RefractionData | null,
): RefractionData {
  const mapEye = (eye: { sphere: string; cylinder: string; axis: string; va?: string }) => ({
    sphere: parseNum(eye.sphere),
    cylinder: eye.cylinder ? parseNum(eye.cylinder) : undefined,
    axis: eye.axis ? parseInt(eye.axis, 10) : undefined,
    visualAcuity: eye.va || '6/6',
  });

  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    startingRx: {
      source: 'Previous Prescription',
      OD: mapEye({ ...snap.oldGlass.OD, va: snap.oldGlass.OD.va }),
      OS: mapEye({ ...snap.oldGlass.OS, va: snap.oldGlass.OS.va }),
    },
    finalRx: {
      OD: mapEye({ ...snap.newPrescription.OD, va: snap.newPrescription.OD.va }),
      OS: mapEye({ ...snap.newPrescription.OS, va: snap.newPrescription.OS.va }),
    },
  };
}

export function buildKeratometryPayload(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing?: KeratometryData | null,
): KeratometryData {
  const mapK = (eye: { k1: string; k2: string; axis: string }) => {
    const k1 = parseNum(eye.k1);
    const k2 = parseNum(eye.k2);
    const astig = Math.abs(k2 - k1);
    return {
      K1: k1,
      K2: k2,
      axis: parseInt(eye.axis || '0', 10) || 0,
      astigmatism: astig,
      astigmatismType: 'WTR' as const,
      averageK: (k1 + k2) / 2,
    };
  };

  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    OD: mapK(snap.keratometry.OD),
    OS: mapK(snap.keratometry.OS),
    miresQuality: existing?.miresQuality ?? 'Good',
    forIOLCalculation: existing?.forIOLCalculation ?? false,
    forContactLensFitting: existing?.forContactLensFitting ?? false,
  };
}

export function buildColorVisionPayload(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing?: ColorVisionData | null,
): ColorVisionData {
  const base: ColorVisionData = {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    notes: snap.colorVision.platesMissed || existing?.notes,
  };
  if (snap.colorVision.testType === 'Ishihara' || !snap.colorVision.testType) {
    base.ishiharaTest = {
      platesRead: 38,
      totalPlates: 38,
      result: 'Normal',
      notes: [snap.colorVision.result, snap.colorVision.platesMissed].filter(Boolean).join(' — '),
    };
  }
  return base;
}

const mapCsInterpretation = (
  label: string,
): ContrastSensitivityData['OD']['interpretation'] => {
  if (label === 'Borderline') return 'Mild Reduction';
  if (label === 'Reduced') return 'Moderate Reduction';
  return 'Normal';
};

export function buildContrastPayload(
  patientId: string,
  examinerId: string,
  snap: VisualAcuityMegaSnapshot,
  existing?: ContrastSensitivityData | null,
): ContrastSensitivityData {
  const odScore = parseNum(snap.contrastSensitivity.OD.score);
  const osScore = parseNum(snap.contrastSensitivity.OS.score);
  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    testType: (snap.contrastSensitivity.testType || 'Pelli-Robson') as ContrastSensitivityData['testType'],
    testingDistance: existing?.testingDistance ?? '1 meter',
    lighting: existing?.lighting ?? 'Photopic',
    OD: {
      score: odScore,
      logCS: odScore,
      interpretation: mapCsInterpretation(snap.contrastSensitivity.OD.interpretation),
    },
    OS: {
      score: osScore,
      logCS: osScore,
      interpretation: mapCsInterpretation(snap.contrastSensitivity.OS.interpretation),
    },
  };
}

export interface IOPMegaSnapshot {
  nct: {
    beforeDilatation: { OD: { value: string }; OS: { value: string } };
    afterDilatation: { OD: { value: string }; OS: { value: string } };
  };
  pachymetry: { OD: { cct: string }; OS: { cct: string } };
  visualField: {
    OD: { testType: string; md: string; psd: string; reliability: string; defects: string };
    OS: { testType: string; md: string; psd: string; reliability: string; defects: string };
  };
}

/**
 * Legacy tonometry DTO: NCT pre-dilatation values only.
 * ATN, Schirmer, and per-eye times live in draft `iopExtended` (see optometry-persistence.ts).
 */
export function buildTonometryPayload(
  patientId: string,
  examinerId: string,
  snap: IOPMegaSnapshot,
  existing?: TonometryData | null,
): TonometryData {
  const odVal = parseNum(snap.nct.beforeDilatation.OD.value || '0');
  const osVal = parseNum(snap.nct.beforeDilatation.OS.value || '0');

  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    method: 'NCT',
    measurementTime: new Date(),
    OD: {
      measuredIOP: odVal,
      correctedIOP: existing?.OD?.correctedIOP,
    },
    OS: {
      measuredIOP: osVal,
      correctedIOP: existing?.OS?.correctedIOP,
    },
    cctCorrectionApplied: Boolean(snap.pachymetry.OD.cct || snap.pachymetry.OS.cct),
    cctOD: snap.pachymetry.OD.cct ? parseNum(snap.pachymetry.OD.cct) : undefined,
    cctOS: snap.pachymetry.OS.cct ? parseNum(snap.pachymetry.OS.cct) : undefined,
    glaucomaSuspectOD: odVal > 21,
    glaucomaSuspectOS: osVal > 21,
    hypotonyOD: odVal > 0 && odVal < 10,
    hypotonyOS: osVal > 0 && osVal < 10,
    isGlaucomaPatient: existing?.isGlaucomaPatient ?? false,
    onGlaucomaMedication: existing?.onGlaucomaMedication ?? false,
  };
}

export function buildPachymetryPayload(
  patientId: string,
  examinerId: string,
  snap: IOPMegaSnapshot,
  existing?: PachymetryData | null,
): PachymetryData {
  const odCct = parseNum(snap.pachymetry.OD.cct);
  const osCct = parseNum(snap.pachymetry.OS.cct);
  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    device: existing?.device ?? 'Ultrasound',
    OD: { centralThickness: odCct || existing?.OD?.centralThickness || 0 },
    OS: { centralThickness: osCct || existing?.OS?.centralThickness || 0 },
    glaucomaRiskOD: existing?.glaucomaRiskOD ?? false,
    glaucomaRiskOS: existing?.glaucomaRiskOS ?? false,
    lasikSuitableOD: existing?.lasikSuitableOD ?? true,
    lasikSuitableOS: existing?.lasikSuitableOS ?? true,
  };
}

export function buildVisualFieldPayload(
  patientId: string,
  examinerId: string,
  snap: IOPMegaSnapshot,
  existing?: VisualFieldData | null,
): VisualFieldData {
  const notesOd = [
    snap.visualField.OD.md && `MD ${snap.visualField.OD.md}`,
    snap.visualField.OD.psd && `PSD ${snap.visualField.OD.psd}`,
    snap.visualField.OD.reliability && `Reliability ${snap.visualField.OD.reliability}`,
    snap.visualField.OD.defects,
  ]
    .filter(Boolean)
    .join('; ');
  const notesOs = [
    snap.visualField.OS.md && `MD ${snap.visualField.OS.md}`,
    snap.visualField.OS.psd && `PSD ${snap.visualField.OS.psd}`,
    snap.visualField.OS.reliability && `Reliability ${snap.visualField.OS.reliability}`,
    snap.visualField.OS.defects,
  ]
    .filter(Boolean)
    .join('; ');

  return {
    ...existing,
    id: existing?.id,
    patientId,
    examinerId,
    examinationDate: new Date(),
    testType: 'Humphrey',
    notes: [notesOd && `OD: ${notesOd}`, notesOs && `OS: ${notesOs}`].filter(Boolean).join(' | '),
  };
}

import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import { buildPriorRawFromMedicalHistorySnapshot } from '@/lib/medical-history/medical-history-prior-visit';
import type { OptometryVisitExamRecord } from './optometry-history.types';
import type { PriorVisitSnapshot } from './optometry-exam-types';
import type { VisualAcuityBundle, IopBundle } from './optometry-history.types';
import { isAtnTonometryMethod } from './iop-section-history';

function formatSphere(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return String(v);
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

function mapEyeRx(eye?: { sphere?: string; cylinder?: string; axis?: string; va?: string }) {
  if (!eye) return undefined;
  return {
    sphere: formatSphere(eye.sphere),
    cylinder: formatSphere(eye.cylinder),
    axis: eye.axis != null ? String(eye.axis) : undefined,
    visualAcuity: eye.va,
  };
}

export function mapVisitRecordToPriorSnapshot(
  visit: OptometryVisitExamRecord,
): PriorVisitSnapshot {
  const va = visit.segments.visual_acuity_bundle;
  const iop = visit.segments.iop_bundle;
  const mh = visit.segments.medical_history_bundle as MedicalHistorySnapshot | undefined;

  const mhRaw = mh ? buildPriorRawFromMedicalHistorySnapshot(mh) : {};
  const seg = visit.segments;
  const pupilExam = seg.pupil_exam;
  const anteriorSegment = seg.anterior_segment;
  const posteriorSegment = seg.posterior_segment;
  const fundusExam = seg.fundus_exam;
  const vitreousExam = seg.vitreous_exam;
  const peripheralRetinaExam = seg.peripheral_retina_exam;

  const snapshot: PriorVisitSnapshot = {
    examinationDate: visit.examinationDate,
    raw: {
      visitId: visit.visitId,
      visualAcuityBundle: va,
      iopExtended: iop,
      wet_retinoscopy: seg.wet_retinoscopy,
      dry_retinoscopy: seg.dry_retinoscopy,
      subjective_refraction: seg.subjective_refraction,
      pupil_exam: pupilExam,
      anterior_segment: anteriorSegment,
      posterior_segment: posteriorSegment,
      fundus_exam: fundusExam,
      vitreous_exam: vitreousExam,
      peripheral_retina_exam: peripheralRetinaExam,
      pupilExam,
      anteriorSegment,
      posteriorSegment,
      fundusExam,
      vitreousExam,
      peripheralRetinaExam,
      ...mhRaw,
    },
  };

  if (va) {
    snapshot.visualAcuity = {
      distanceODUnaided: va.distanceVision?.OD?.unaided,
      distanceODAided: va.distanceVision?.OD?.aided,
      distanceOSUnaided: va.distanceVision?.OS?.unaided,
      distanceOSAided: va.distanceVision?.OS?.aided,
      distanceOD: va.distanceVision?.OD?.unaided ?? va.distanceVision?.OD?.aided,
      distanceOS: va.distanceVision?.OS?.unaided ?? va.distanceVision?.OS?.aided,
      nearODUnaided: va.nearVision?.OD?.unaided,
      nearODAided: va.nearVision?.OD?.aided,
      nearOSUnaided: va.nearVision?.OS?.unaided,
      nearOSAided: va.nearVision?.OS?.aided,
      nearOD: va.nearVision?.OD?.unaided ?? va.nearVision?.OD?.aided,
      nearOS: va.nearVision?.OS?.unaided ?? va.nearVision?.OS?.aided,
    };
    snapshot.refraction = {
      startingRxOD: mapEyeRx(va.oldGlass?.OD),
      startingRxOS: mapEyeRx(va.oldGlass?.OS),
      finalRxOD: mapEyeRx(va.newPrescription?.OD),
      finalRxOS: mapEyeRx(va.newPrescription?.OS),
    };
    snapshot.keratometry = {
      od: va.keratometry?.OD,
      os: va.keratometry?.OS,
    };
  }

  if (iop?.nct) {
    snapshot.iop = {
      od: iop.nct.beforeDilatation?.OD?.value,
      os: iop.nct.beforeDilatation?.OS?.value,
      method: 'NCT',
    };
    if (isAtnTonometryMethod(snapshot.iop.method)) {
      /* NCT only here */
    }
  }

  return snapshot;
}

export function getVisualAcuityBundleFromVisit(
  visit: OptometryVisitExamRecord,
): VisualAcuityBundle | undefined {
  return visit.segments.visual_acuity_bundle;
}

export function getIopBundleFromVisit(visit: OptometryVisitExamRecord): IopBundle | undefined {
  return visit.segments.iop_bundle;
}

export function fallbackVaSectionSnapshot(
  sectionId: keyof NonNullable<VisualAcuityBundle['sectionSnapshots']>,
  va?: VisualAcuityBundle,
): unknown {
  if (!va) return null;
  const snap = va.sectionSnapshots?.[sectionId];
  if (snap != null) return snap;
  switch (sectionId) {
    case 'old':
      return va.oldGlass;
    case 'new':
      return va.newPrescription;
    case 'refraction':
      return va.refraction;
    case 'distance':
      return {
        distanceVision: va.distanceVision,
        nearVision: va.nearVision,
        projectionRays: va.projectionRays,
      };
    case 'keratometry':
      return va.keratometry;
    case 'color':
      return va.colorVision;
    case 'contrast':
      return va.contrastSensitivity;
    default:
      return null;
  }
}

export function fallbackIopSectionSnapshot(
  sectionId: keyof NonNullable<IopBundle['sectionSnapshots']>,
  iop?: IopBundle,
): unknown {
  if (!iop) return null;
  const snap = iop.sectionSnapshots?.[sectionId];
  if (snap != null) return snap;
  return iop[sectionId as keyof IopBundle] ?? null;
}

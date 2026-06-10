import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';

/** Normalized prior-visit segment blobs (snake + camel aliases). */
export interface PriorSegmentRaw {
  pupilExam?: PupilExamData;
  anteriorSegment?: AnteriorSegmentExamData;
  posteriorSegment?: PosteriorSegmentExamData;
  fundusExam?: FundusExamData;
  vitreousExam?: VitreousExamData;
  peripheralRetinaExam?: PeripheralRetinaExamData;
}

export function priorRawFromSnapshot(raw: Record<string, unknown> | undefined): PriorSegmentRaw {
  if (!raw) return {};
  const r = raw as Record<string, unknown>;
  return {
    pupilExam: (r.pupilExam ?? r.pupil_exam) as PupilExamData | undefined,
    anteriorSegment: (r.anteriorSegment ?? r.anterior_segment) as AnteriorSegmentExamData | undefined,
    posteriorSegment: (r.posteriorSegment ?? r.posterior_segment) as
      | PosteriorSegmentExamData
      | undefined,
    fundusExam: (r.fundusExam ?? r.fundus_exam) as FundusExamData | undefined,
    vitreousExam: (r.vitreousExam ?? r.vitreous_exam) as VitreousExamData | undefined,
    peripheralRetinaExam: (r.peripheralRetinaExam ?? r.peripheral_retina_exam) as
      | PeripheralRetinaExamData
      | undefined,
  };
}

export function priorSegmentsHaveClinicalData(raw?: Record<string, unknown>): boolean {
  const p = priorRawFromSnapshot(raw);
  const has = (obj: Record<string, unknown> | undefined) =>
    obj &&
    Object.values(obj).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'boolean') return v;
      return v !== undefined && v !== null && v !== '';
    });
  return (
    has(p.pupilExam as Record<string, unknown>) ||
    has(p.anteriorSegment as Record<string, unknown>) ||
    has(p.posteriorSegment as Record<string, unknown>) ||
    has(p.fundusExam as Record<string, unknown>) ||
    has(p.vitreousExam as Record<string, unknown>) ||
    has(p.peripheralRetinaExam as Record<string, unknown>)
  );
}

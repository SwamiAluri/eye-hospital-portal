import type { PriorVisitSnapshot } from './optometry-exam-types';
import type { AnteriorSectionId } from './anterior-segment-section-constants';
import type { AnteriorSegmentExamData, PupilExamData } from './anterior-segment-types';
import { priorRawFromSnapshot } from './prior-segment-raw';

export function formatAnteriorTabLastVisitLine(priorVisit: PriorVisitSnapshot): string | null {
  const { anteriorSegment, pupilExam } = priorRawFromSnapshot(
    priorVisit.raw as Record<string, unknown> | undefined,
  );
  const parts: string[] = [];
  if (pupilExam?.sizeLightOD != null || pupilExam?.sizeLightOS != null) {
    parts.push(
      `Pupil light OD ${pupilExam.sizeLightOD ?? '—'}mm · OS ${pupilExam.sizeLightOS ?? '—'}mm`,
    );
  }
  if (anteriorSegment?.conjunctivaOD || anteriorSegment?.conjunctivaOS) {
    parts.push(
      `Conjunctiva OD ${anteriorSegment.conjunctivaOD ?? '—'} · OS ${anteriorSegment.conjunctivaOS ?? '—'}`,
    );
  }
  if (anteriorSegment?.corneaOD || anteriorSegment?.corneaOS) {
    parts.push(
      `Cornea OD ${anteriorSegment.corneaOD ?? '—'} · OS ${anteriorSegment.corneaOS ?? '—'}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function getPriorAnteriorForSection(
  priorVisit: PriorVisitSnapshot | null | undefined,
  _sectionId: AnteriorSectionId,
): { pupil?: PupilExamData; segment?: AnteriorSegmentExamData } {
  if (!priorVisit) return {};
  const { pupilExam, anteriorSegment } = priorRawFromSnapshot(
    priorVisit.raw as Record<string, unknown> | undefined,
  );
  return { pupil: pupilExam, segment: anteriorSegment };
}

export function priorFieldHint(
  prior: Partial<AnteriorSegmentExamData> | undefined,
  field: keyof AnteriorSegmentExamData,
): string | undefined {
  const v = prior?.[field];
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

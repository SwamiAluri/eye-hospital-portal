import type { PacAssessmentDto, PreOpCompletionDto } from '@/lib/api/ip-management.api';

export const FITNESS_CERTIFICATE_ITEM_KEY = 'fitness_certificate_uploaded';

export interface AnaesthesiaClearanceRow {
  parameter: string;
  value: string;
}

const MALLAMPATI_LABELS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function formatMallampati(airway: PacAssessmentDto['airwayExam']): string {
  const grade = airway?.mallampati;
  if (grade == null) return '—';
  return `Class ${MALLAMPATI_LABELS[grade] ?? String(grade)}`;
}

function formatContraindications(pac: PacAssessmentDto): string {
  const flags: string[] = [];
  const review = pac.systemicReview ?? {};
  const systemicKeys = ['cvs', 'respiratory', 'renal', 'hepaticGi', 'diabetes', 'cns', 'others'] as const;
  for (const key of systemicKeys) {
    const text = review[key]?.trim();
    if (!text || text.toUpperCase() === 'NAD') continue;
    flags.push(text);
  }
  if (pac.allergies?.trim() && pac.allergies.trim().toUpperCase() !== 'NAD') {
    flags.push(pac.allergies.trim());
  }
  if (pac.pastAnaestheticHistory?.trim()) {
    flags.push(pac.pastAnaestheticHistory.trim());
  }
  return flags.length > 0 ? flags.join('; ') : '—';
}

function formatFitness(pac: PacAssessmentDto): string {
  if (pac.assessmentStatus !== 'Completed' || !pac.completedAt) return '—';
  const at = new Date(pac.completedAt);
  if (Number.isNaN(at.getTime())) return 'Cleared';
  return `Cleared · ${at.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function buildAnaesthesiaClearanceRows(
  pac: PacAssessmentDto,
  anaesthetistName?: string | null,
): AnaesthesiaClearanceRow[] {
  return [
    {
      parameter: 'ASA Physical Status',
      value: pac.physicalStatusAsa != null ? `ASA ${pac.physicalStatusAsa}` : '—',
    },
    {
      parameter: 'Anaesthesia Type',
      value: dash(pac.anaesthesiaPlan),
    },
    {
      parameter: 'Anaesthetist',
      value: dash(anaesthetistName),
    },
    {
      parameter: 'Airway (Mallampati)',
      value: formatMallampati(pac.airwayExam),
    },
    {
      parameter: 'Allergies',
      value: dash(pac.allergies),
    },
    {
      parameter: 'Contraindications',
      value: formatContraindications(pac),
    },
    {
      parameter: 'Fitness',
      value: formatFitness(pac),
    },
  ];
}

export function findFitnessCertificateCompletion(
  completions: PreOpCompletionDto[] | undefined,
): PreOpCompletionDto | undefined {
  return completions?.find(c => c.itemKey === FITNESS_CERTIFICATE_ITEM_KEY);
}

'use client';

export interface InvestigationPhaseSummary {
  verifiedCount: number;
  totalApplicable: number;
  unverifiedCritical: string[];
}

const PHASE_LABELS: Record<string, string> = {
  ward_investigation_complete: 'P1 Investigation',
  ward_checklist_complete: 'P2 Ward',
  pac_completed: 'PAC',
  med_log_complete: 'Med Log',
  before_anaesthesia_complete: 'Before Anaesthesia',
  who_timeout_complete: 'WHO Timeout',
  after_surgery_complete: 'After Surgery',
  ward_postop_complete: 'Post-Op Ward',
  anaesthesia_discharge_cleared: 'Anaesthesia D/C',
};

export interface ChecklistPhaseStatusChipsProps {
  phaseStatus?: Record<string, boolean> | null;
  investigationSummary?: InvestigationPhaseSummary | null;
}

function formatChipLabel(key: string, done: boolean, investigationSummary?: InvestigationPhaseSummary | null): string {
  const base = PHASE_LABELS[key] ?? key;
  if (key === 'ward_investigation_complete' && investigationSummary && investigationSummary.totalApplicable > 0) {
    const { verifiedCount, totalApplicable, unverifiedCritical } = investigationSummary;
    const count = `${verifiedCount}/${totalApplicable} verified`;
    if (unverifiedCritical.length > 0) {
      return `${base}: ${count} (${unverifiedCritical.length} critical)`;
    }
    return `${base}: ${done ? '✓' : count}`;
  }
  return `${base}: ${done ? '✓' : '—'}`;
}

export function ChecklistPhaseStatusChips({ phaseStatus, investigationSummary }: ChecklistPhaseStatusChipsProps) {
  if (!phaseStatus || Object.keys(phaseStatus).length === 0) return null;

  const entries = Object.entries(phaseStatus)
    .filter(([key]) => PHASE_LABELS[key])
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, done]) => (
        <span
          key={key}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            done
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}
        >
          {formatChipLabel(key, done, investigationSummary)}
        </span>
      ))}
    </div>
  );
}

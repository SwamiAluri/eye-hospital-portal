'use client';

interface CompactExamPatientStripProps {
  loading?: boolean;
  name: string | null;
  mrn: string | null;
  age: number | null;
  gender: string | null;
  bloodGroup?: string | null;
  complaint?: string | null;
  allergies?: string[];
  medicationCount?: number;
  savedSections?: number;
  totalSections?: number;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  canEdit: boolean;
  onSaveExam: () => void;
  onComplete: () => void;
  backHref: string;
}

export function CompactExamPatientStrip({
  loading,
  name,
  mrn,
  age,
  gender,
  bloodGroup,
  complaint,
  allergies = [],
  medicationCount = 0,
  savedSections,
  totalSections = 11,
  lastSavedAt,
  hasUnsavedChanges,
  isSaving,
  canEdit,
  onSaveExam,
  onComplete,
  backHref,
}: CompactExamPatientStripProps) {
  return (
    <div className="px-4 py-2 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {name?.[0] ?? 'P'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {loading ? 'Loading…' : name ?? 'Unknown patient'}
            </p>
            <p className="text-xs text-gray-600 tabular-nums">
              MRN {mrn ?? '—'} · {age ?? '—'}y · {gender ?? '—'}
              {bloodGroup ? ` · ${bloodGroup}` : ''}
            </p>
          </div>
          {complaint && (
            <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded max-w-[200px] truncate">
              CC: {complaint}
            </span>
          )}
          {allergies.slice(0, 3).map((a) => (
            <span
              key={a}
              className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded font-medium"
            >
              ⚠ {a}
            </span>
          ))}
          {allergies.length > 3 && (
            <span className="text-[10px] text-red-700">+{allergies.length - 3} allergies</span>
          )}
          {medicationCount > 0 && (
            <span className="text-[10px] text-slate-500">{medicationCount} current meds</span>
          )}
          {savedSections != null && (
            <span className="text-[10px] text-slate-500">
              {savedSections}/{totalSections} sections saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastSavedAt && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="text-[10px] font-medium text-amber-700">Unsaved</span>
          )}
          <button
            type="button"
            onClick={onSaveExam}
            disabled={isSaving || !canEdit}
            className="px-3 py-1.5 text-xs font-semibold border-2 border-emerald-600 text-emerald-700 rounded-md hover:bg-emerald-50 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save exam'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            Complete
          </button>
          <a
            href={backHref}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </a>
        </div>
      </div>
    </div>
  );
}

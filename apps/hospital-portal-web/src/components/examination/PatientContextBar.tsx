'use client';

import { AlertTriangle, ChevronRight, Phone } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { isCriticalSeverity, isHighSeverity } from '@/lib/medical-history/allergy-utils';

export interface PatientContextAllergy {
  name: string;
  severity?: string;
}

interface PatientContextBarProps {
  loading?: boolean;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  mrn: string | null;
  age: number | null;
  gender: string | null;
  bloodGroup?: string | null;
  dateOfBirthLabel?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  complaint?: string | null;
  visitLabel?: string;
  allergies?: PatientContextAllergy[];
  medicationCount?: number;
  conditionCount?: number;
  nkda?: boolean;
  savedSections?: number;
  totalSections?: number;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  medicalHistoryDirty?: boolean;
  isSaving: boolean;
  canEdit: boolean;
  onViewDetails?: () => void;
  onPhotoClick?: () => void;
  onSaveExam: () => void;
  onComplete: () => void;
  onBack: () => void;
}

export function PatientContextBar({
  loading,
  name,
  firstName,
  lastName,
  mrn,
  age,
  gender,
  bloodGroup,
  dateOfBirthLabel,
  phone,
  photoUrl,
  complaint,
  visitLabel = 'Optometry examination',
  allergies = [],
  medicationCount = 0,
  conditionCount = 0,
  nkda = false,
  savedSections,
  totalSections = 11,
  lastSavedAt,
  hasUnsavedChanges,
  medicalHistoryDirty = false,
  isSaving,
  canEdit,
  onViewDetails,
  onPhotoClick,
  onSaveExam,
  onComplete,
  onBack,
}: PatientContextBarProps) {
  const openDetails = onViewDetails ?? onPhotoClick;
  const progress =
    savedSections != null && totalSections > 0
      ? Math.round((savedSections / totalSections) * 100)
      : 0;

  const criticalAllergies = allergies.filter((a) => isCriticalSeverity(a.severity));
  const highAllergies = allergies.filter(
    (a) => isHighSeverity(a.severity) && !isCriticalSeverity(a.severity),
  );
  const otherAllergies = allergies.filter(
    (a) => !isHighSeverity(a.severity) && !isCriticalSeverity(a.severity),
  );

  const showSafetyStrip =
    nkda || criticalAllergies.length > 0 || highAllergies.length > 0 || otherAllergies.length > 0;

  const identityMeta = [
    mrn ? `MRN ${mrn}` : 'MRN —',
    age != null ? `${age}y` : '—y',
    gender ?? '—',
    bloodGroup ?? null,
    dateOfBirthLabel ? `DOB ${dateOfBirthLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const avatar = (
    <PatientAvatar
      photoUrl={photoUrl}
      firstName={firstName}
      lastName={lastName}
      displayName={name}
      size="lg"
      className="ring-2 ring-emerald-100"
    />
  );

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {openDetails ? (
              <button
                type="button"
                onClick={openDetails}
                className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                aria-label="View patient details"
              >
                {avatar}
              </button>
            ) : (
              avatar
            )}

            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900 truncate leading-tight">
                {loading ? 'Loading…' : name ?? 'Unknown patient'}
              </p>
              <p className="text-xs text-gray-600 tabular-nums mt-0.5">{identityMeta}</p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">{visitLabel}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                {phone && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                    {phone}
                  </span>
                )}
                {complaint && (
                  <span className="inline-block px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded max-w-[240px] sm:max-w-xs truncate">
                    CC: {complaint}
                  </span>
                )}
                {openDetails && (
                  <button
                    type="button"
                    onClick={openDetails}
                    className="inline-flex items-center gap-0.5 text-emerald-700 font-medium hover:text-emerald-800 hover:underline min-h-[32px]"
                  >
                    Patient details
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {savedSections != null && (
              <div className="hidden lg:flex flex-col items-end gap-0.5 min-w-[100px]">
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {savedSections}/{totalSections} sections
                </span>
                <Progress value={progress} className="h-1.5 w-24" />
              </div>
            )}
            {lastSavedAt && (
              <span className="text-[10px] text-slate-500 hidden md:inline tabular-nums">
                Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {(hasUnsavedChanges || medicalHistoryDirty) && (
              <span className="text-[10px] font-medium text-amber-700">Unsaved</span>
            )}
            <button
              type="button"
              onClick={onSaveExam}
              disabled={isSaving || !canEdit}
              data-testid="patient-encounter-save"
              className="px-3 py-1.5 text-xs font-semibold border-2 border-emerald-600 text-emerald-700 rounded-md hover:bg-emerald-50 disabled:opacity-50 min-h-[44px] sm:min-h-0"
            >
              {isSaving ? 'Saving…' : 'Save exam'}
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 min-h-[44px] sm:min-h-0"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 min-h-[44px] sm:min-h-0"
            >
              Back
            </button>
          </div>
        </div>

        <div className="lg:hidden mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          {conditionCount > 0 && <span>{conditionCount} conditions</span>}
          {medicationCount > 0 && <span>{medicationCount} meds</span>}
          {savedSections != null && (
            <span className="tabular-nums">
              {savedSections}/{totalSections} saved
            </span>
          )}
        </div>
      </div>

      {showSafetyStrip && (
        <div
          className={`px-4 py-1.5 flex flex-wrap items-center gap-2 text-xs border-t overflow-x-auto ${
            criticalAllergies.length > 0
              ? 'bg-red-50 border-red-200'
              : highAllergies.length > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-slate-50 border-slate-200'
          }`}
        >
          {criticalAllergies.length > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden />
          )}
          <span className="font-semibold text-slate-700 shrink-0">Allergies:</span>
          {nkda && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium shrink-0">
              NKDA
            </span>
          )}
          {criticalAllergies.map((a) => (
            <span
              key={`c-${a.name}`}
              className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 font-semibold shrink-0"
            >
              ⚠ {a.name}
            </span>
          ))}
          {highAllergies.map((a) => (
            <span
              key={`h-${a.name}`}
              className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 font-medium shrink-0"
            >
              {a.name}
            </span>
          ))}
          {otherAllergies.slice(0, 6).map((a) => (
            <span
              key={`o-${a.name}`}
              className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shrink-0"
            >
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

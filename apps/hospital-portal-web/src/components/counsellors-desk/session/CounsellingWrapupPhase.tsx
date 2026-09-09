'use client';

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { CounsellingPhaseValidationContext } from '@/lib/counsellors-desk/counselling-progress';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { resolveNotesPhaseBlocker } from '@/lib/counsellors-desk/notes-workspace-presentation';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingAdditionalOptionsSection } from '@/components/counsellors-desk/session/CounsellingWorkflowSections';
import {
  CounsellingLabel,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export interface CounsellingWrapupPhaseProps {
  /** Retained for caller compatibility; Pre-op panel is not shown on Notes (Wave 2E-5R). */
  counselingSessionId: string;
  counsellorNotes: string;
  setCounsellorNotes: (v: string) => void;
  patientRemarks: string;
  setPatientRemarks: (v: string) => void;
  doctorNotes: string;
  setDoctorNotes: (v: string) => void;
  wantToSeeDoctor: boolean;
  setWantToSeeDoctor: (v: boolean) => void;
  interestedToUpgrade: boolean;
  setInterestedToUpgrade: (v: boolean) => void;
  notRequiredPreAuth: boolean;
  setNotRequiredPreAuth: (v: boolean) => void;
  isReadOnly: boolean;
  markDirty: () => void;
  phaseValidationContext: CounsellingPhaseValidationContext;
}

export function CounsellingWrapupPhase({
  counselingSessionId: _counselingSessionId,
  counsellorNotes,
  setCounsellorNotes,
  patientRemarks,
  setPatientRemarks,
  doctorNotes,
  setDoctorNotes,
  wantToSeeDoctor,
  setWantToSeeDoctor,
  interestedToUpgrade,
  setInterestedToUpgrade,
  notRequiredPreAuth,
  setNotRequiredPreAuth,
  isReadOnly,
  markDirty,
  phaseValidationContext,
}: CounsellingWrapupPhaseProps) {
  const blocker = useMemo(
    () => resolveNotesPhaseBlocker(phaseValidationContext),
    [phaseValidationContext],
  );

  const noteFields = [
    {
      id: 'counsellor',
      testId: counsellingTestIds.notesCounsellorField,
      label: 'Counsellor',
      placeholder: 'Enter counsellor notes…',
      value: counsellorNotes,
      rows: 2,
      minClass: 'min-h-[3.25rem]',
      onChange: (v: string) => {
        setCounsellorNotes(v);
        markDirty();
      },
    },
    {
      id: 'patient',
      testId: counsellingTestIds.notesPatientField,
      label: 'Patient',
      placeholder: 'Enter patient remarks…',
      value: patientRemarks,
      rows: 2,
      minClass: 'min-h-[2.75rem]',
      onChange: (v: string) => {
        setPatientRemarks(v);
        markDirty();
      },
    },
    {
      id: 'doctor',
      testId: counsellingTestIds.notesDoctorField,
      label: 'Doctor',
      placeholder: 'Enter doctor notes…',
      value: doctorNotes,
      rows: 2,
      minClass: 'min-h-[2.75rem]',
      onChange: (v: string) => {
        setDoctorNotes(v);
        markDirty();
      },
    },
  ] as const;

  return (
    <section
      data-testid={counsellingTestIds.notesWorkspace}
      className={cn(
        counsellingSessionTokens.sessionWidget,
        counsellingSessionTokens.sessionWidgetPad,
        'flex h-full min-h-0 flex-col gap-3 overflow-hidden',
      )}
    >
      <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'shrink-0')}>
        <FileText className="h-4 w-4 text-counselling-primary" aria-hidden />
        {counsellingCopy.notes}
      </h2>

      {blocker ? (
        <p
          data-testid={counsellingTestIds.notesInlineBlocker}
          className="shrink-0 text-xs text-amber-900"
          role="status"
        >
          {blocker}
        </p>
      ) : null}

      <div
        data-testid={counsellingTestIds.notesDocumentationSection}
        className="min-h-0 flex-1 space-y-2"
      >
        {noteFields.map(({ id, testId, label, placeholder, value, rows, minClass, onChange }) => (
          <div key={id} className="space-y-1">
            <CounsellingLabel
              htmlFor={`counselling-note-${id}`}
              className="text-xs font-medium text-counselling-muted-foreground"
            >
              {label}
            </CounsellingLabel>
            <CounsellingTextarea
              id={`counselling-note-${id}`}
              data-testid={testId}
              rows={rows}
              value={value}
              placeholder={isReadOnly ? undefined : placeholder}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              className={cn(
                minClass,
                'resize-none border-counselling-border/80 bg-counselling-card py-1.5',
              )}
              onChange={(e) => {
                if (!isReadOnly) onChange(e.target.value);
              }}
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-counselling-border/50 pt-2.5">
        <p className={counsellingSessionTokens.sessionAdditionalOptionsLabel}>
          {counsellingCopy.additionalOptions}
        </p>
        <div data-testid={counsellingTestIds.notesAdditionalOptions}>
          <CounsellingAdditionalOptionsSection
            embedded
            wantToSeeDoctor={wantToSeeDoctor}
            setWantToSeeDoctor={setWantToSeeDoctor}
            interestedToUpgrade={interestedToUpgrade}
            setInterestedToUpgrade={setInterestedToUpgrade}
            notRequiredPreAuth={notRequiredPreAuth}
            setNotRequiredPreAuth={setNotRequiredPreAuth}
            isReadOnly={isReadOnly}
            markDirty={markDirty}
          />
        </div>
      </div>
    </section>
  );
}

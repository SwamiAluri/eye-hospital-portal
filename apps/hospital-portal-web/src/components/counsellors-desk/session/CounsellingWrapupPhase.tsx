'use client';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingBadge,
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
  CounsellingLabel,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingAdditionalOptionsSection } from '@/components/counsellors-desk/session/CounsellingWorkflowSections';

export interface CounsellingWrapupPhaseProps {
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
}

export function CounsellingWrapupPhase({
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
}: CounsellingWrapupPhaseProps) {
  const noteFields = [
    {
      id: 'counsellor',
      label: 'Counsellor notes',
      value: counsellorNotes,
      onChange: (v: string) => {
        setCounsellorNotes(v);
        markDirty();
      },
    },
    {
      id: 'patient',
      label: 'Patient remarks',
      value: patientRemarks,
      onChange: (v: string) => {
        setPatientRemarks(v);
        markDirty();
      },
    },
    {
      id: 'doctor',
      label: 'Doctor notes',
      value: doctorNotes,
      onChange: (v: string) => {
        setDoctorNotes(v);
        markDirty();
      },
    },
  ] as const;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <CounsellingCard className={counsellingSessionTokens.card}>
        <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
          <div className="flex items-center gap-2">
            <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
              Notes
            </CounsellingCardTitle>
            <CounsellingBadge variant="outline" className="border-counselling-border text-[10px] text-counselling-muted-foreground">
              Optional
            </CounsellingBadge>
          </div>
        </CounsellingCardHeader>
        <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
          <div className="space-y-4">
            {noteFields.map(({ id, label, value, onChange }) => (
              <div key={id}>
                <CounsellingLabel
                  htmlFor={`counselling-note-${id}`}
                  className="mb-1.5 block text-xs font-medium text-counselling-muted-foreground"
                >
                  {label}
                </CounsellingLabel>
                <CounsellingTextarea
                  id={`counselling-note-${id}`}
                  rows={4}
                  value={value}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    if (!isReadOnly) onChange(e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
        </CounsellingCardContent>
      </CounsellingCard>

      <CounsellingCard className={counsellingSessionTokens.card}>
        <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
          <div className="flex items-center gap-2">
            <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
              Workflow options
            </CounsellingCardTitle>
            <CounsellingBadge variant="outline" className="border-counselling-border text-[10px] text-counselling-muted-foreground">
              Optional
            </CounsellingBadge>
          </div>
        </CounsellingCardHeader>
        <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
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
        </CounsellingCardContent>
      </CounsellingCard>
    </div>
  );
}

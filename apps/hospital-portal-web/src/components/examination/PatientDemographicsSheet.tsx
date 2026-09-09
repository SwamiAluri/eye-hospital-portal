'use client';

import type { ReactNode } from 'react';
import type { Patient } from '@/lib/api/patients.api';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  formatPatientDisplayName,
  formatPatientDob,
  formatPatientSex,
  resolvePatientMrn,
  resolvePatientPhone,
} from '@/lib/patients/patient-display-utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export type PatientDemographicsCounsellingContext = {
  counsellingType?: string | null;
  sessionStatus?: string | null;
  operativeEye?: string | null;
  consultingDoctor?: string | null;
};

export interface PatientDemographicsSheetProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  age: number | null;
  visitLabel?: string;
  /** Authoritative display name when first/last are missing (e.g. session.patientName). */
  displayNameFallback?: string | null;
  /** Optional counselling-only context; omit for optometry and other callers. */
  counsellingContext?: PatientDemographicsCounsellingContext | null;
  /** Fallback MRN when patient record lacks identifiers. */
  mrnFallback?: string | null;
  genderFallback?: string | null;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="w-[38%] shrink-0 text-[12.5px] font-medium leading-[18px] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right text-sm font-medium leading-5 text-foreground">
        {value}
      </span>
    </div>
  );
}

/** Section widget — one card per domain section; rows inside are not cards. */
function SectionWidget({
  title,
  children,
  emptyMessage,
  isEmpty = false,
}: {
  title: string;
  children?: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold leading-5 text-foreground">{title}</h3>
      {isEmpty ? (
        <p className="text-sm font-medium leading-5 text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </section>
  );
}

export interface PatientDemographicsContentProps {
  patient: Patient;
  age: number | null;
  visitLabel?: string;
  displayNameFallback?: string | null;
  counsellingContext?: PatientDemographicsCounsellingContext | null;
  mrnFallback?: string | null;
  genderFallback?: string | null;
}

export function PatientDemographicsContent({
  patient,
  age,
  visitLabel,
  displayNameFallback,
  counsellingContext,
  mrnFallback,
  genderFallback,
}: PatientDemographicsContentProps) {
  const name = formatPatientDisplayName(patient, displayNameFallback);
  const dob = formatPatientDob(patient.dateOfBirth);
  const mrn = resolvePatientMrn(patient, mrnFallback);
  const phone = resolvePatientPhone(patient);
  const gender = formatPatientSex(patient.gender?.trim() || genderFallback);
  const eye = counsellingContext?.operativeEye?.trim() || null;
  const address = [patient.address, patient.city, patient.state, patient.postalCode]
    .filter(Boolean)
    .join(', ');

  const identityMeta = [
    age != null ? `${age} yrs` : null,
    gender,
    eye ? `Eye ${eye}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const contactRows = (
    <>
      <FieldRow label="Mobile" value={phone} />
      <FieldRow label="Email" value={patient.email} />
      <FieldRow label="Address" value={address || null} />
      <FieldRow label="Emergency" value={patient.emergencyContactName} />
      <FieldRow label="Emergency Phone" value={patient.emergencyContactPhone} />
    </>
  );

  const hasContact =
    Boolean(phone) ||
    Boolean(patient.email?.trim()) ||
    Boolean(address) ||
    Boolean(patient.emergencyContactName?.trim()) ||
    Boolean(patient.emergencyContactPhone?.trim());

  const hasVisitContext = Boolean(
    counsellingContext &&
      (visitLabel?.trim() ||
        counsellingContext.counsellingType?.trim() ||
        counsellingContext.sessionStatus?.trim()),
  );

  const hasClinical = Boolean(
    counsellingContext?.operativeEye?.trim() ||
      counsellingContext?.consultingDoctor?.trim(),
  );

  // Hero already shows name / MRN / age / sex / eye — Identity only adds remaining fields.
  const hasExtraIdentity = Boolean(dob || patient.bloodGroup?.trim());

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <PatientAvatar
            photoUrl={patient.photoUrl}
            firstName={patient.firstName}
            lastName={patient.lastName}
            displayName={name}
            size="lg"
            className="!h-[88px] !w-[88px] shrink-0 !text-xl ring-2 ring-border/80"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-semibold leading-6 text-foreground">{name}</p>
            {mrn ? (
              <p className="mt-1 font-mono text-[13px] font-medium leading-[18px] tabular-nums text-muted-foreground">
                {mrn}
              </p>
            ) : null}
            {identityMeta ? (
              <p className="mt-1 text-sm font-medium leading-5 text-foreground/80">{identityMeta}</p>
            ) : null}
            {visitLabel && !counsellingContext ? (
              <p className="mt-1.5 text-sm font-medium leading-5 text-emerald-700">{visitLabel}</p>
            ) : null}
          </div>
        </div>
      </section>

      {hasExtraIdentity ? (
        <SectionWidget title="Identity">
          <FieldRow label="Date of Birth" value={dob} />
          <FieldRow label="Blood Group" value={patient.bloodGroup} />
        </SectionWidget>
      ) : null}

      <SectionWidget
        title="Contact"
        emptyMessage="No contact information available"
        isEmpty={!hasContact}
      >
        {contactRows}
      </SectionWidget>

      {hasVisitContext ? (
        <SectionWidget title="Visit & Session">
          <FieldRow label="Visit" value={visitLabel} />
          <FieldRow label="Counselling" value={counsellingContext?.counsellingType} />
          <FieldRow label="Session Status" value={counsellingContext?.sessionStatus} />
        </SectionWidget>
      ) : null}

      {hasClinical ? (
        <SectionWidget title="Clinical Context">
          <FieldRow label="Eye" value={eye} />
          <FieldRow
            label="Consulting Doctor"
            value={counsellingContext?.consultingDoctor}
          />
        </SectionWidget>
      ) : null}

      {(patient.insuranceProvider || patient.insurancePolicyNumber) && (
        <SectionWidget title="Insurance">
          <FieldRow label="Provider" value={patient.insuranceProvider} />
          <FieldRow label="Policy" value={patient.insurancePolicyNumber} />
        </SectionWidget>
      )}
    </div>
  );
}

export function PatientDemographicsSheet({
  open,
  onClose,
  patient,
  age,
  visitLabel = 'Optometry examination',
  displayNameFallback,
  counsellingContext,
  mrnFallback,
  genderFallback,
}: PatientDemographicsSheetProps) {
  const isOpen = open && Boolean(patient);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName="!z-[90] bg-black/40"
        className={cn(
          '!z-[100] flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-l border-border bg-muted/30',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <SheetTitle className="text-[18px] font-semibold leading-6 text-foreground">
              Patient Details
            </SheetTitle>
            <SheetDescription className="sr-only">
              Read-only patient identity, contact, and visit context
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          {patient ? (
            <PatientDemographicsContent
              patient={patient}
              age={age}
              visitLabel={visitLabel}
              displayNameFallback={displayNameFallback}
              counsellingContext={counsellingContext}
              mrnFallback={mrnFallback}
              genderFallback={genderFallback}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

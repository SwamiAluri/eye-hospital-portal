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
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  Eye,
  Phone,
  Shield,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';

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

function FieldRow({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string | null;
  valueNode?: ReactNode;
}) {
  if (!valueNode && !value?.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="w-[40%] shrink-0 text-[12.5px] font-medium leading-[18px] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right text-sm font-semibold leading-5 text-foreground">
        {valueNode ?? value}
      </span>
    </div>
  );
}

const sectionIconChrome: Record<string, string> = {
  identity: 'bg-sky-100 text-sky-700',
  contact: 'bg-emerald-100 text-emerald-700',
  visit: 'bg-violet-100 text-violet-700',
  clinical: 'bg-teal-100 text-teal-700',
  insurance: 'bg-amber-100 text-amber-800',
};

/** Section widget — one card per domain section; rows inside are not cards. */
function SectionWidget({
  title,
  icon: Icon,
  iconTone,
  children,
  emptyMessage,
  isEmpty = false,
  flat = false,
}: {
  title: string;
  icon: LucideIcon;
  iconTone: keyof typeof sectionIconChrome;
  children?: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  flat?: boolean;
}) {
  return (
    <section
      className={
        flat
          ? 'border-t border-border/50 pt-2.5 first:border-t-0 first:pt-0'
          : 'rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm'
      }
    >
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold leading-5 text-foreground">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            sectionIconChrome[iconTone],
          )}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </h3>
      {isEmpty ? (
        <p className="text-sm font-medium leading-5 text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </section>
  );
}

function SessionStatusValue({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold leading-[18px] text-amber-900">
      {status}
    </span>
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
  /** Sheet keeps nested cards. Counselling session uses one outer card and flat rows. */
  presentation?: 'sheet' | 'workspace';
}

export function PatientDemographicsContent({
  patient,
  age,
  visitLabel,
  displayNameFallback,
  counsellingContext,
  mrnFallback,
  genderFallback,
  presentation = 'sheet',
}: PatientDemographicsContentProps) {
  const workspace = presentation === 'workspace';
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

  const ageYearsLabel = age != null ? `${age} years` : null;
  const hasIdentitySection = Boolean(
    dob || gender || ageYearsLabel || patient.bloodGroup?.trim(),
  );

  const identitySection = hasIdentitySection ? (
    <SectionWidget title="Identity" icon={UserRound} iconTone="identity" flat={workspace}>
      <FieldRow label="Date of Birth" value={dob} />
      <FieldRow label="Gender" value={gender} />
      <FieldRow label="Age" value={ageYearsLabel} />
      <FieldRow label="Blood Group" value={patient.bloodGroup} />
    </SectionWidget>
  ) : null;

  const lowerSections = (
    <>
      <SectionWidget
        title="Contact"
        icon={Phone}
        iconTone="contact"
        emptyMessage="No contact information available"
        isEmpty={!hasContact}
        flat={workspace}
      >
        {contactRows}
      </SectionWidget>

      {hasVisitContext ? (
        <SectionWidget title="Visit & Session" icon={CalendarDays} iconTone="visit" flat={workspace}>
          <FieldRow label="Visit" value={visitLabel} />
          <FieldRow label="Counselling" value={counsellingContext?.counsellingType} />
          <FieldRow
            label="Session Status"
            value={counsellingContext?.sessionStatus}
            valueNode={
              counsellingContext?.sessionStatus?.trim() ? (
                <SessionStatusValue status={counsellingContext.sessionStatus.trim()} />
              ) : undefined
            }
          />
        </SectionWidget>
      ) : null}

      {hasClinical ? (
        <SectionWidget title="Clinical Context" icon={Eye} iconTone="clinical" flat={workspace}>
          <FieldRow label="Eye" value={eye} />
          <FieldRow
            label="Consulting Doctor"
            value={counsellingContext?.consultingDoctor}
          />
        </SectionWidget>
      ) : null}

      {(patient.insuranceProvider || patient.insurancePolicyNumber) && (
        <SectionWidget title="Insurance" icon={Shield} iconTone="insurance" flat={workspace}>
          <FieldRow label="Provider" value={patient.insuranceProvider} />
          <FieldRow label="Policy" value={patient.insurancePolicyNumber} />
        </SectionWidget>
      )}
    </>
  );

  if (workspace) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-6" data-testid="patient-details-identity-band">
          <PatientAvatar
            photoUrl={patient.photoUrl}
            firstName={patient.firstName}
            lastName={patient.lastName}
            displayName={name}
            size="xl"
            className="h-56 w-48 shrink-0 rounded-lg text-3xl ring-1 ring-border/70"
          />
          <div className="min-w-0 flex-1">{identitySection}</div>
        </div>
        <div data-testid="patient-details-lower">{lowerSections}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <section
        data-testid="patient-details-identity-hero"
        className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <PatientAvatar
            photoUrl={patient.photoUrl}
            firstName={patient.firstName}
            lastName={patient.lastName}
            displayName={name}
            size="lg"
            className="h-14 w-14 shrink-0 text-lg ring-2 ring-border/70"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold leading-6 text-foreground sm:text-[20px]">
              {name}
            </p>
            {mrn ? (
              <p className="mt-0.5 text-[13px] font-medium leading-[18px] tabular-nums text-muted-foreground">
                {mrn}
              </p>
            ) : null}
            {identityMeta ? (
              <p className="mt-0.5 text-[13px] font-medium leading-5 text-muted-foreground">
                {identityMeta}
              </p>
            ) : null}
            {visitLabel && !counsellingContext ? (
              <p className="mt-1 text-sm font-medium leading-5 text-emerald-700">{visitLabel}</p>
            ) : null}
          </div>
        </div>
      </section>
      {identitySection}
      {lowerSections}
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
  const useCounsellingChrome = Boolean(counsellingContext);

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
          'border-l border-border shadow-lg',
          useCounsellingChrome
            ? 'counselling-session bg-counselling-card border-counselling-border'
            : 'bg-card',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3',
            useCounsellingChrome
              ? 'border-counselling-border/60 bg-counselling-card'
              : 'border-border bg-card',
          )}
        >
          <div className="min-w-0">
            <SheetTitle
              className={cn(
                'text-[18px] font-semibold leading-6',
                useCounsellingChrome ? 'text-counselling-foreground' : 'text-foreground',
              )}
            >
              {counsellingCopy.patientDetails}
            </SheetTitle>
            <SheetDescription
              data-testid="patient-details-subtitle"
              className="sr-only"
            >
              {counsellingCopy.patientDetails}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2',
              useCounsellingChrome
                ? 'text-counselling-muted-foreground hover:bg-counselling-muted hover:text-counselling-foreground focus-visible:ring-counselling-ring'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring',
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5',
            useCounsellingChrome ? 'bg-counselling-card' : 'bg-card',
          )}
        >
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

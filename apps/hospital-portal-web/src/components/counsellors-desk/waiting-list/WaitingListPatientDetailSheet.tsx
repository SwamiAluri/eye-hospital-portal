'use client';

import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';
import { formatWaitingListDoctorDisplay } from '@/lib/counsellors-desk/waiting-list-layout';
import { formatPatientDob, formatPatientSex } from '@/lib/patients/patient-display-utils';
import type { WaitingListPatient } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

export type WaitingListPatientDetailSheetProps = {
  patient: WaitingListPatient | null;
  open: boolean;
  onClose: () => void;
};

function displayValue(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return String(value);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Compact field row — omit empty values (PatientDemographicsSheet pattern). */
function FieldRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-counselling-border/40 py-1.5 last:border-0">
      <span className="w-[40%] shrink-0 text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right text-sm font-medium leading-5 text-counselling-foreground">
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  show,
}: {
  title: string;
  children: ReactNode;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <section className="min-w-0 rounded-lg border border-counselling-border/50 bg-counselling-card px-3 py-2.5">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground">
        {title}
      </h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function hasAny(...values: Array<string | null | undefined>): boolean {
  return values.some((v) => Boolean(v?.trim()));
}

function formatUpgradeDiff(diff: number | undefined): string | null {
  if (diff == null || Number.isNaN(diff)) return null;
  if (diff === 0) return '₹0';
  const sign = diff > 0 ? '+' : '';
  return `${sign}₹${diff.toLocaleString('en-IN')}`;
}

function formatFollowUpDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const ymd = raw.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? new Date(`${ymd}T00:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return displayValue(raw);
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ownerDisplay(patient: WaitingListPatient): string {
  if (!patient.counselorId) return 'Unassigned';
  return patient.counselorName?.trim() || 'Assigned';
}

export function WaitingListPatientDetailSheet({
  patient,
  open,
  onClose,
}: WaitingListPatientDetailSheetProps) {
  const isOpen = open && patient != null;
  const name = displayValue(patient?.patientName) ?? '—';
  const uhid = displayValue(patient?.uhid);
  const gender = formatPatientSex(patient?.gender);
  const ageLabel =
    patient?.age != null && patient.age > 0 ? `${patient.age} yrs` : null;
  const dob = formatPatientDob(patient?.dob);
  const doctor = displayValue(formatWaitingListDoctorDisplay(patient?.doctor));
  const statusBadge = patient ? getStatusBadge(patient.status) : null;
  const identityMeta = [uhid, ageLabel, gender].filter(Boolean).join(' · ');

  const bloodGroup = displayValue(patient?.bloodGroup);
  const visitType = displayValue(patient?.type);
  const patientType = displayValue(patient?.patientType);
  const visitTime = displayValue(patient?.time);
  const procedure = displayValue(patient?.surgeryName);
  const eye = displayValue(patient?.eye);
  const followUpDate = formatFollowUpDate(patient?.followUpDate);
  const followUpReason = displayValue(patient?.followUpReason);
  const previousPackage = displayValue(patient?.previousPackage);
  const newPackage = displayValue(patient?.newPackage);
  const upgradeDiff = formatUpgradeDiff(patient?.upgradeDiff);
  const remarks = displayValue(patient?.remarks);

  const patientRows = (
    <>
      <FieldRow label="UHID" value={uhid} />
      <FieldRow label="Age" value={ageLabel} />
      <FieldRow label="Sex" value={gender} />
      <FieldRow label="Date of Birth" value={dob} />
      <FieldRow label="Blood Group" value={bloodGroup} />
    </>
  );

  const visitRows = (
    <>
      <FieldRow label="Visit Type" value={visitType} />
      <FieldRow label="Doctor" value={doctor} />
      <FieldRow label="Time" value={visitTime} />
      <FieldRow label="Patient Type" value={patientType} />
    </>
  );

  const ownerLabel = patient ? ownerDisplay(patient) : null;
  const counsellingRows = (
    <>
      <FieldRow label="Owner" value={ownerLabel} />
      <FieldRow label="Follow-up Date" value={followUpDate} />
      <FieldRow label="Follow-up Reason" value={followUpReason} />
      <FieldRow label="Remarks" value={remarks} />
    </>
  );

  const clinicalRows = (
    <>
      <FieldRow label="Procedure" value={procedure} />
      <FieldRow label="Eye" value={eye} />
      <FieldRow label="Previous Package" value={previousPackage} />
      <FieldRow label="New Package" value={newPackage} />
      <FieldRow label="Upgrade Difference" value={upgradeDiff} />
    </>
  );

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          'counselling-session flex w-full flex-col gap-0 overflow-hidden bg-gray-100 p-0 sm:max-w-md',
        )}
        data-testid="waiting-list-patient-detail-sheet"
      >
        {patient ? (
          <>
            <SheetHeader className="shrink-0 space-y-0 border-b border-counselling-border/60 bg-counselling-card px-5 py-4 text-left">
              <div
                className={cn(
                  'flex items-start',
                  counsellingSessionTokens.patientHeaderGap,
                )}
              >
                <PatientAvatar
                  displayName={patient.patientName}
                  size="lg"
                  className={counsellingSessionTokens.patientHeaderPhoto}
                />
                <div
                  className={cn(
                    'min-w-0 flex-1',
                    counsellingSessionTokens.patientHeaderStack,
                  )}
                >
                  <SheetTitle
                    className={cn(
                      counsellingSessionTokens.patientName,
                      'truncate text-left',
                    )}
                  >
                    {name}
                  </SheetTitle>
                  {identityMeta ? (
                    <p
                      className={cn(
                        counsellingSessionTokens.shellMeta,
                        'mt-1 truncate text-left',
                      )}
                    >
                      {identityMeta}
                    </p>
                  ) : null}
                  {statusBadge ? (
                    <span
                      className={cn(
                        'mt-2 inline-flex w-fit rounded-md px-2.5 py-0.5',
                        counsellingSessionTokens.patientStatusPill,
                        statusBadge.cls,
                      )}
                    >
                      {statusBadge.label}
                    </span>
                  ) : null}
                </div>
              </div>
              <SheetDescription className="sr-only">
                Quick patient context for this waiting list item. Read-only —
                does not assign or claim ownership.
              </SheetDescription>
            </SheetHeader>

            <div className="counselling-hidden-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <Section
                title="Patient"
                show={hasAny(uhid, ageLabel, gender, dob, bloodGroup)}
              >
                {patientRows}
              </Section>
              <Section
                title="Visit"
                show={hasAny(visitType, doctor, visitTime, patientType)}
              >
                {visitRows}
              </Section>
              <Section
                title="Counselling"
                show={hasAny(ownerLabel, followUpDate, followUpReason, remarks)}
              >
                {counsellingRows}
              </Section>
              <Section
                title="Clinical / Surgery"
                show={hasAny(
                  procedure,
                  eye,
                  previousPackage,
                  newPackage,
                  upgradeDiff,
                )}
              >
                {clinicalRows}
              </Section>
              <p className="text-[11px] leading-4 text-counselling-muted-foreground">
                Read-only context · empty fields omitted · viewing does not assign ownership
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

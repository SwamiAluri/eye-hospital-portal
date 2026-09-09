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

function displayValue(value: string | number | null | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '—';
    return String(value);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : '—';
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-counselling-border/40 py-2 last:border-0">
      <span className="w-[40%] shrink-0 text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right text-sm font-medium leading-5 text-counselling-foreground">
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1 text-sm font-semibold text-counselling-foreground">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function formatUpgradeDiff(diff: number | undefined): string {
  if (diff == null || Number.isNaN(diff)) return '—';
  if (diff === 0) return '₹0';
  const sign = diff > 0 ? '+' : '';
  return `${sign}₹${diff.toLocaleString('en-IN')}`;
}

function formatFollowUpDate(value: string | undefined): string {
  if (!value?.trim()) return '—';
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

export function WaitingListPatientDetailSheet({
  patient,
  open,
  onClose,
}: WaitingListPatientDetailSheetProps) {
  const isOpen = open && patient != null;
  const name = displayValue(patient?.patientName);
  const uhid = displayValue(patient?.uhid);
  const gender = formatPatientSex(patient?.gender) ?? '—';
  const ageLabel =
    patient?.age != null && patient.age > 0 ? `${patient.age} yrs` : '—';
  const dob = formatPatientDob(patient?.dob) ?? '—';
  const doctor = displayValue(formatWaitingListDoctorDisplay(patient?.doctor));
  const statusBadge = patient ? getStatusBadge(patient.status) : null;
  const identityMeta = [uhid, ageLabel !== '—' ? ageLabel : null, gender !== '—' ? gender : null]
    .filter(Boolean)
    .join(' · ');

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
                {/* WaitingListPatient has no photoUrl — initials from name only */}
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
                Read-only waiting list patient identity, contact, visit, and
                clinical details
              </SheetDescription>
            </SheetHeader>

            <div className="counselling-hidden-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <Section title="Identity">
                <FieldRow label="UHID" value={uhid} />
                <FieldRow label="Age" value={ageLabel} />
                <FieldRow label="Sex" value={gender} />
                <FieldRow label="Date of Birth" value={dob} />
                <FieldRow label="Blood Group" value={displayValue(patient.bloodGroup)} />
              </Section>

              <Section title="Contact">
                <FieldRow
                  label="Contact Number"
                  value={displayValue(patient.contactNumber)}
                />
              </Section>

              <Section title="Visit / Counselling Context">
                <FieldRow label="Type" value={displayValue(patient.type)} />
                <FieldRow
                  label="Patient Type"
                  value={displayValue(patient.patientType)}
                />
                <FieldRow
                  label="Status"
                  value={statusBadge?.label ?? '—'}
                />
                <FieldRow label="Time" value={displayValue(patient.time)} />
                <FieldRow label="Remarks" value={displayValue(patient.remarks)} />
                <FieldRow
                  label="Follow-up Date"
                  value={formatFollowUpDate(patient.followUpDate)}
                />
                <FieldRow
                  label="Follow-up Reason"
                  value={displayValue(patient.followUpReason)}
                />
              </Section>

              <Section title="Clinical / Surgery Context">
                <FieldRow
                  label="Procedure"
                  value={displayValue(patient.surgeryName)}
                />
                <FieldRow label="Eye" value={displayValue(patient.eye)} />
                <FieldRow label="Doctor" value={doctor} />
                <FieldRow
                  label="Previous Package"
                  value={displayValue(patient.previousPackage)}
                />
                <FieldRow
                  label="New Package"
                  value={displayValue(patient.newPackage)}
                />
                <FieldRow
                  label="Upgrade Difference"
                  value={formatUpgradeDiff(patient.upgradeDiff)}
                />
              </Section>

              <Section title="Emergency / Address">
                <FieldRow
                  label="Emergency Contact"
                  value={displayValue(patient.emergencyContactName)}
                />
                <FieldRow
                  label="Emergency Phone"
                  value={displayValue(patient.emergencyContactPhone)}
                />
                <FieldRow
                  label="Relationship"
                  value={displayValue(patient.emergencyContactRelationship)}
                />
                <FieldRow label="Address" value={displayValue(patient.address)} />
              </Section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

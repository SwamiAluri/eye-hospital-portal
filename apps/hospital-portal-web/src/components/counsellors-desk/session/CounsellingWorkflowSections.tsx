'use client';

import { useMemo } from 'react';
import { startOfDay } from 'date-fns';
import { Calendar, Clock, Heart, ThumbsDown, Timer } from 'lucide-react';
import { requiresInsuranceCompany, formatTime } from '@/lib/counsellors-desk/session-utils';
import { usePaymentCoverageOptions } from '@/hooks/use-payment-coverage-options';
import type { CombinedPaymentType, DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSectionIds, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingAccordion,
  CounsellingAccordionContent,
  CounsellingAccordionItem,
  CounsellingAccordionTrigger,
  CounsellingButton,
  CounsellingCard,
  SessionDatePicker,
  CounsellingInput,
  CounsellingLabel,
  CounsellingRadioGroup,
  CounsellingRadioGroupItem,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectGroup,
  CounsellingSelectItem,
  CounsellingSelectLabel,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
  CounsellingSelectableRow,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

function SectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-counselling-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-counselling-primary text-[10px] font-bold text-white">
          {step}
        </span>
        {title}
      </h3>
    </div>
  );
}

const DECISION_OPTIONS: {
  value: DecisionType;
  label: string;
  icon: typeof Calendar;
}[] = [
  {
    value: 'DateForSurgery',
    label: counsellingCopy.dateForSurgery,
    icon: Calendar,
  },
  {
    value: 'Interested',
    label: counsellingCopy.interested,
    icon: Heart,
  },
  {
    value: 'NotInterested',
    label: counsellingCopy.notInterested,
    icon: ThumbsDown,
  },
  {
    value: 'NeedsTime',
    label: counsellingCopy.needsTime,
    icon: Timer,
  },
];

const FOLLOW_UP_REASONS = [
  'Discuss with Family',
  'Financial Planning',
  'Fear of Surgery',
  'Wants Second Opinion',
  'Travel Plans',
  'Medical Hold',
  'Other',
] as const;

export interface CounsellingPaymentSectionProps {
  embedded?: boolean;
  paymentType: CombinedPaymentType | '';
  setPaymentType: (v: CombinedPaymentType | '') => void;
  insuranceCompany: string;
  setInsuranceCompany: (v: string) => void;
  insuranceProviderOptions: { value: string; label: string }[];
  freeSurgeryReason: string;
  setFreeSurgeryReason: (v: string) => void;
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingPaymentSection({
  embedded = false,
  paymentType,
  setPaymentType,
  insuranceCompany,
  setInsuranceCompany,
  insuranceProviderOptions,
  freeSurgeryReason,
  setFreeSurgeryReason,
  isReadOnly,
  markDirty,
}: CounsellingPaymentSectionProps) {
  const { groups: paymentCoverageGroups } = usePaymentCoverageOptions();

  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <CounsellingLabel className="mb-1 block text-xs font-medium">
            {counsellingCopy.paymentType} <span className="text-red-500">*</span>
          </CounsellingLabel>
            <CounsellingSelect
              value={paymentType || undefined}
              onValueChange={(v) => {
                setPaymentType(v as CombinedPaymentType | '');
                markDirty();
              }}
              disabled={isReadOnly}
            >
              <CounsellingSelectTrigger className="h-11 w-full">
                <CounsellingSelectValue placeholder="Select funding source" />
              </CounsellingSelectTrigger>
              <CounsellingSelectContent>
                {paymentCoverageGroups.map((group) => (
                  <CounsellingSelectGroup key={group.key}>
                    <CounsellingSelectLabel>{group.label}</CounsellingSelectLabel>
                    {group.options.map((opt) => (
                      <CounsellingSelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </CounsellingSelectItem>
                    ))}
                  </CounsellingSelectGroup>
                ))}
              </CounsellingSelectContent>
            </CounsellingSelect>
        </div>

        {requiresInsuranceCompany(paymentType as CombinedPaymentType) && (
          <div className="min-w-[12rem] flex-1">
            <CounsellingLabel className="mb-1 block text-xs font-medium">{counsellingCopy.insuranceCompany}</CounsellingLabel>
              <CounsellingSelect
                value={insuranceCompany || undefined}
                onValueChange={(v) => {
                  setInsuranceCompany(v);
                  markDirty();
                }}
                disabled={isReadOnly}
              >
                <CounsellingSelectTrigger
                  className="h-11 w-full"
                  data-testid="counselling-insurance-company"
                >
                  <CounsellingSelectValue placeholder="Select insurer" />
                </CounsellingSelectTrigger>
                <CounsellingSelectContent>
                  {insuranceProviderOptions.map((o) => (
                    <CounsellingSelectItem key={o.value} value={o.label}>
                      {o.label}
                    </CounsellingSelectItem>
                  ))}
                </CounsellingSelectContent>
              </CounsellingSelect>
          </div>
        )}
      </div>

      {paymentType === 'Free' && (
        <div>
          <CounsellingLabel className="mb-1 block text-xs font-medium">{counsellingCopy.freeSurgeryReason}</CounsellingLabel>
            <CounsellingInput
              type="text"
              placeholder="Reason for complimentary surgery"
              value={freeSurgeryReason}
              onChange={(e) => {
                setFreeSurgeryReason(e.target.value);
                markDirty();
              }}
              disabled={isReadOnly}
            />
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div id={counsellingSectionIds.payment} className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id={counsellingSectionIds.payment}
      className="rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm scroll-mt-24"
    >
      <SectionHeader step={3} title={counsellingCopy.payment} />
      {body}
    </section>
  );
}

export interface CounsellingDecisionSectionProps {
  embedded?: boolean;
  decision: DecisionType | '';
  setDecision: (v: DecisionType) => void;
  followUpReason: string;
  setFollowUpReason: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  schedule: ScheduleData | null;
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingDecisionSection({
  embedded = false,
  decision,
  setDecision,
  followUpReason,
  setFollowUpReason,
  followUpDate,
  setFollowUpDate,
  schedule,
  isReadOnly,
  markDirty,
}: CounsellingDecisionSectionProps) {
  const followUpMinDate = useMemo(() => startOfDay(new Date()), []);

  const body = (
    <>
      <CounsellingRadioGroup
        value={decision || undefined}
        onValueChange={(v) => {
          if (!isReadOnly && v) {
            setDecision(v as DecisionType);
            markDirty();
          }
        }}
        disabled={isReadOnly}
        className="grid gap-2 sm:grid-cols-2"
      >
        {DECISION_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = decision === value;
          return (
            <label
              key={value}
              htmlFor={`counselling-decision-${value}`}
              className={cn('block cursor-pointer', isReadOnly && 'cursor-not-allowed opacity-60')}
            >
              <CounsellingCard
                className={cn(
                  'flex items-start gap-3 p-3 transition-colors shadow-none',
                  selected
                    ? 'border-counselling-primary bg-counselling-accent/80 ring-1 ring-counselling-primary/25'
                    : 'border-counselling-border bg-counselling-card hover:border-counselling-border hover:bg-counselling-muted',
                )}
              >
                <CounsellingRadioGroupItem
                  id={`counselling-decision-${value}`}
                  value={value}
                  className="mt-1 shrink-0"
                />
                <Icon
                  size={18}
                  className={`mt-0.5 shrink-0 ${selected ? 'text-counselling-primary' : 'text-counselling-muted-foreground/80'}`}
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className={`text-sm font-semibold ${selected ? 'text-counselling-accent-foreground' : 'text-counselling-foreground'}`}>
                    {label}
                  </p>
                </div>
              </CounsellingCard>
            </label>
          );
        })}
      </CounsellingRadioGroup>

      {(decision === 'NotInterested' || decision === 'NeedsTime') && (
        <div className="mt-4 space-y-3 border-t border-counselling-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {counsellingCopy.followUpRequired}
            </span>
            <span className="text-xs text-counselling-muted-foreground">
              {decision === 'NeedsTime'
                ? 'Patient needs more time before deciding'
                : 'Patient will be tagged for follow-up'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <CounsellingLabel className="mb-1 block text-xs font-medium">{counsellingCopy.followUpReason}</CounsellingLabel>
              <CounsellingSelect
                value={followUpReason || undefined}
                onValueChange={(v) => {
                  setFollowUpReason(v);
                  markDirty();
                }}
                disabled={isReadOnly}
              >
                <CounsellingSelectTrigger className="h-11 w-full">
                  <CounsellingSelectValue placeholder="Select reason…" />
                </CounsellingSelectTrigger>
                <CounsellingSelectContent>
                  {FOLLOW_UP_REASONS.map((r) => (
                    <CounsellingSelectItem key={r} value={r}>
                      {r}
                    </CounsellingSelectItem>
                  ))}
                </CounsellingSelectContent>
              </CounsellingSelect>
            </div>
            <div>
              <CounsellingLabel className="mb-1 block text-xs font-medium">{counsellingCopy.followUpDate}</CounsellingLabel>
              <SessionDatePicker
                variant="compact"
                value={followUpDate}
                minDate={followUpMinDate}
                disabled={isReadOnly}
                data-testid={counsellingTestIds.followUpDate}
                onChange={(v) => {
                  setFollowUpDate(v);
                  markDirty();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {decision === 'DateForSurgery' && !schedule && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Surgery schedule required — add date and doctor below.
        </p>
      )}
      {decision === 'Interested' && !schedule && (
        <p className="mt-3 text-xs text-counselling-muted-foreground">
          Add a tentative surgery schedule below (optional).
        </p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div id={counsellingSectionIds.decision} className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id={counsellingSectionIds.decision}
      className="rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm scroll-mt-24"
    >
      <SectionHeader step={4} title={counsellingCopy.decision} />
      {body}
    </section>
  );
}

export interface CounsellingScheduleSectionProps {
  embedded?: boolean;
  schedule: ScheduleData | null;
  setIsScheduleModalOpen: (open: boolean) => void;
}

export function CounsellingScheduleSection({
  embedded = false,
  schedule,
  setIsScheduleModalOpen,
}: CounsellingScheduleSectionProps) {
  const body = schedule ? (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-xl border border-counselling-primary/30 bg-counselling-accent/60 p-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-counselling-accent-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">
            {new Date(schedule.selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-counselling-accent-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">{formatTime(schedule.surgeryStartTime)}</span>
        </div>
        <span className="text-xs text-counselling-primary">
          {schedule.operationTheatre} · {schedule.doctor}
        </span>
      </div>
      <CounsellingButton
        type="button"
        variant="outline"
        onClick={() => setIsScheduleModalOpen(true)}
        className="border-counselling-primary/50 text-counselling-primary hover:bg-counselling-card"
      >
        Update schedule
      </CounsellingButton>
    </div>
  ) : (
    <CounsellingButton
      type="button"
      variant="outline"
      onClick={() => setIsScheduleModalOpen(true)}
      className="h-auto w-full flex-col gap-2 border-2 border-dashed border-counselling-primary/40 py-3 text-sm font-semibold text-counselling-primary hover:bg-counselling-accent/50"
    >
      <Calendar className="h-4 w-4" />
      Select a schedule
    </CounsellingButton>
  );

  if (embedded) {
    return (
      <div id={counsellingSectionIds.schedule} className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id={counsellingSectionIds.schedule}
      className="rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm scroll-mt-24"
    >
      <SectionHeader step={5} title={counsellingCopy.schedule} />
      {body}
    </section>
  );
}

export interface CounsellingNotesSectionProps {
  embedded?: boolean;
  counsellorNotes: string;
  setCounsellorNotes: (v: string) => void;
  patientRemarks: string;
  setPatientRemarks: (v: string) => void;
  doctorNotes: string;
  setDoctorNotes: (v: string) => void;
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingNotesSection({
  embedded = false,
  counsellorNotes,
  setCounsellorNotes,
  patientRemarks,
  setPatientRemarks,
  doctorNotes,
  setDoctorNotes,
  isReadOnly,
  markDirty,
}: CounsellingNotesSectionProps) {
  const panels = [
    {
      key: 'counsellor' as const,
      label: 'Counsellor notes',
      value: counsellorNotes,
      set: (v: string) => {
        setCounsellorNotes(v);
        markDirty();
      },
    },
    {
      key: 'patient' as const,
      label: 'Patient remarks',
      value: patientRemarks,
      set: (v: string) => {
        setPatientRemarks(v);
        markDirty();
      },
    },
    {
      key: 'doctor' as const,
      label: 'Doctor notes',
      value: doctorNotes,
      set: (v: string) => {
        setDoctorNotes(v);
        markDirty();
      },
    },
  ];

  const body = (
    <CounsellingAccordion type="multiple" defaultValue={['counsellor']} className="w-full">
      {panels.map(({ key, label, value, set }) => (
        <CounsellingAccordionItem key={key} value={key} className="border-counselling-border">
          <CounsellingAccordionTrigger className="min-h-11 px-1 py-3 text-sm font-medium hover:no-underline sm:px-2">
            {label}
          </CounsellingAccordionTrigger>
          <CounsellingAccordionContent className="px-1 pb-4 sm:px-2">
            <CounsellingTextarea
              rows={3}
              value={value}
              readOnly={isReadOnly}
              onChange={(e) => {
                if (!isReadOnly) set(e.target.value);
              }}
              placeholder={`Enter ${label.toLowerCase()}…`}
              disabled={isReadOnly}
            />
          </CounsellingAccordionContent>
        </CounsellingAccordionItem>
      ))}
    </CounsellingAccordion>
  );

  if (embedded) {
    return (
      <div id={counsellingSectionIds.notes} className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id={counsellingSectionIds.notes}
      className="overflow-hidden rounded-xl border border-counselling-border bg-counselling-card shadow-sm scroll-mt-24"
    >
      <div className="border-b border-counselling-border px-4 pt-3">
        <SectionHeader step={6} title={counsellingCopy.notes} />
      </div>
      <div className="px-4">{body}</div>
    </section>
  );
}

export interface CounsellingAdditionalOptionsSectionProps {
  embedded?: boolean;
  wantToSeeDoctor: boolean;
  setWantToSeeDoctor: (v: boolean) => void;
  interestedToUpgrade: boolean;
  setInterestedToUpgrade: (v: boolean) => void;
  notRequiredPreAuth: boolean;
  setNotRequiredPreAuth: (v: boolean) => void;
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingAdditionalOptionsSection({
  embedded = false,
  wantToSeeDoctor,
  setWantToSeeDoctor,
  interestedToUpgrade,
  setInterestedToUpgrade,
  notRequiredPreAuth,
  setNotRequiredPreAuth,
  isReadOnly,
  markDirty,
}: CounsellingAdditionalOptionsSectionProps) {
  const options = [
    {
      label: 'Want to see doctor again',
      value: wantToSeeDoctor,
      set: (v: boolean) => {
        setWantToSeeDoctor(v);
        markDirty();
      },
    },
    {
      label: 'Interested to upgrade',
      value: interestedToUpgrade,
      set: (v: boolean) => {
        setInterestedToUpgrade(v);
        markDirty();
      },
    },
    {
      label: 'Not required pre-authorization',
      value: notRequiredPreAuth,
      set: (v: boolean) => {
        setNotRequiredPreAuth(v);
        markDirty();
      },
    },
  ];

  const body = (
    <div className="space-y-1">
      {options.map(({ label, value, set }) => (
        <CounsellingSelectableRow
          key={label}
          selected={value}
          disabled={isReadOnly}
          showCheckbox
          checkboxLabel={label}
          onClick={() => {
            if (!isReadOnly) set(!value);
          }}
        >
          <span className="min-w-0 flex-1 text-left text-sm text-counselling-foreground">{label}</span>
        </CounsellingSelectableRow>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div id={counsellingSectionIds.options} className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id={counsellingSectionIds.options}
      className="rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm scroll-mt-24"
    >
      <SectionHeader step={7} title={counsellingCopy.additionalOptions} />
      {body}
    </section>
  );
}

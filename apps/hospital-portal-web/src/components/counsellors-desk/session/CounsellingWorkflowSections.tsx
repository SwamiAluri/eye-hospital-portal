'use client';

import { useMemo } from 'react';
import { startOfDay } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { requiresInsuranceCompany, formatTime, formatCounsellingDateDisplay } from '@/lib/counsellors-desk/session-utils';
import { usePaymentCoverageOptions } from '@/hooks/use-payment-coverage-options';
import type { CombinedPaymentType, DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSectionIds, counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingAccordion,
  CounsellingAccordionContent,
  CounsellingAccordionItem,
  CounsellingAccordionTrigger,
  CounsellingButton,
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
}[] = [
  { value: 'DateForSurgery', label: counsellingCopy.dateForSurgery },
  { value: 'Interested', label: counsellingCopy.interested },
  { value: 'NotInterested', label: counsellingCopy.notInterested },
  { value: 'NeedsTime', label: counsellingCopy.needsTime },
];

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
          <CounsellingLabel className="mb-1 block text-xs font-medium text-counselling-muted-foreground">
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
            <CounsellingSelectTrigger className={`${counsellingSessionTokens.catalogInput} w-full`}>
              <CounsellingSelectValue placeholder="Select payment type" />
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
            <CounsellingLabel className="mb-1 block text-xs font-medium text-counselling-muted-foreground">
              {counsellingCopy.insuranceCompany}
            </CounsellingLabel>
            <CounsellingSelect
              value={insuranceCompany || undefined}
              onValueChange={(v) => {
                setInsuranceCompany(v);
                markDirty();
              }}
              disabled={isReadOnly}
            >
              <CounsellingSelectTrigger
                className={`${counsellingSessionTokens.catalogInput} w-full`}
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
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingDecisionSection({
  embedded = false,
  decision,
  setDecision,
  followUpReason: _followUpReason,
  setFollowUpReason: _setFollowUpReason,
  followUpDate: _followUpDate,
  setFollowUpDate: _setFollowUpDate,
  isReadOnly,
  markDirty,
}: CounsellingDecisionSectionProps) {
  const body = (
    <CounsellingRadioGroup
      value={decision || undefined}
      onValueChange={(v) => {
        if (!isReadOnly && v) {
          setDecision(v as DecisionType);
          markDirty();
        }
      }}
      disabled={isReadOnly}
      className="space-y-1"
      aria-label={counsellingCopy.patientDecisionTitle}
    >
      {DECISION_OPTIONS.map(({ value, label }) => {
        const selected = decision === value;
        return (
          <label
            key={value}
            htmlFor={`counselling-decision-${value}`}
            data-testid={counsellingTestIds.decisionOption(value)}
            className={cn(
              counsellingSessionTokens.notesOptionRow,
              selected && counsellingSessionTokens.notesOptionRowSelected,
              isReadOnly && 'cursor-default',
            )}
          >
            <CounsellingRadioGroupItem
              id={`counselling-decision-${value}`}
              value={value}
              className="shrink-0"
            />
            <span
              className={cn(
                'min-w-0 flex-1 text-left text-sm',
                selected ? 'font-semibold text-counselling-foreground' : 'text-counselling-foreground',
              )}
            >
              {label}
            </span>
          </label>
        );
      })}
    </CounsellingRadioGroup>
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

const FOLLOW_UP_REASONS = [
  'Discuss with Family',
  'Financial Planning',
  'Fear of Surgery',
  'Wants Second Opinion',
  'Travel Plans',
  'Medical Hold',
  'Other',
] as const;

export interface CounsellingFollowUpSectionProps {
  embedded?: boolean;
  followUpReason: string;
  setFollowUpReason: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  isReadOnly: boolean;
  markDirty: () => void;
}

export function CounsellingFollowUpSection({
  embedded = false,
  followUpReason,
  setFollowUpReason,
  followUpDate,
  setFollowUpDate,
  isReadOnly,
  markDirty,
}: CounsellingFollowUpSectionProps) {
  const followUpMinDate = useMemo(() => startOfDay(new Date()), []);

  const body = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <CounsellingLabel className="mb-1 block text-xs font-medium text-counselling-muted-foreground">
          {counsellingCopy.followUpReason}
        </CounsellingLabel>
        <CounsellingSelect
          value={followUpReason || undefined}
          onValueChange={(v) => {
            setFollowUpReason(v);
            markDirty();
          }}
          disabled={isReadOnly}
        >
          <CounsellingSelectTrigger className={`${counsellingSessionTokens.catalogInput} w-full`}>
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
        <CounsellingLabel className="mb-1 block text-xs font-medium text-counselling-muted-foreground">
          {counsellingCopy.followUpDate}
        </CounsellingLabel>
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
  );

  if (embedded) {
    return (
      <div
        id="counselling-decision-follow-up"
        data-testid={counsellingTestIds.decisionFollowUpSection}
        className="scroll-mt-24"
      >
        {body}
      </div>
    );
  }

  return (
    <section className="scroll-mt-24 p-4">
      <SectionHeader step={4} title={counsellingCopy.followUpRequired} />
      {body}
    </section>
  );
}

export interface CounsellingScheduleSectionProps {
  embedded?: boolean;
  compact?: boolean;
  required?: boolean;
  optional?: boolean;
  schedule: ScheduleData | null;
  setIsScheduleModalOpen: (open: boolean) => void;
}

export function CounsellingScheduleSection({
  embedded = false,
  compact = false,
  required: _required = false,
  optional: _optional = false,
  schedule,
  setIsScheduleModalOpen,
}: CounsellingScheduleSectionProps) {
  const body = schedule ? (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 rounded-md bg-counselling-accent/40 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-counselling-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-counselling-muted-foreground" aria-hidden />
          {formatCounsellingDateDisplay(schedule.selectedDate) ?? 'Date not set'}
        </span>
        {schedule.surgeryStartTime ? (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="h-3.5 w-3.5 shrink-0 text-counselling-muted-foreground" aria-hidden />
            {formatTime(schedule.surgeryStartTime)}
          </span>
        ) : null}
        <span className="text-xs text-counselling-muted-foreground">
          {schedule.operationTheatre} · {schedule.doctor}
        </span>
      </div>
      <CounsellingButton
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsScheduleModalOpen(true)}
        className="h-8 shrink-0"
      >
        {counsellingCopy.changeSchedule}
      </CounsellingButton>
    </div>
  ) : (
    <div className="space-y-1.5">
      <CounsellingButton
        type="button"
        variant="outline"
        onClick={() => setIsScheduleModalOpen(true)}
        className={cn(
          `${counsellingSessionTokens.catalogInput} w-full justify-start gap-2 text-sm font-medium sm:w-auto`,
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-counselling-muted-foreground" aria-hidden />
        Select a schedule
      </CounsellingButton>
    </div>
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
    <div
      className="space-y-1.5"
      role="group"
      aria-label={counsellingCopy.additionalOptions}
    >
      {options.map(({ label, value, set }) => (
        <button
          key={label}
          type="button"
          aria-disabled={isReadOnly || undefined}
          aria-pressed={value}
          onClick={() => {
            if (!isReadOnly) set(!value);
          }}
          className={cn(
            counsellingSessionTokens.notesOptionRow,
            value && counsellingSessionTokens.notesOptionRowSelected,
            isReadOnly && 'cursor-default',
            'outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
              value
                ? 'border-counselling-primary bg-counselling-primary text-white'
                : 'border-counselling-border bg-counselling-card',
            )}
          >
            {value ? (
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden>
                <path
                  d="M2.5 6.2 4.8 8.5 9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-counselling-foreground">
            {label}
          </span>
        </button>
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

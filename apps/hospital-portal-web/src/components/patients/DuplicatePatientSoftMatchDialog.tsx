'use client';

import { useEffect, useState } from 'react';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { calcPatientAge } from '@/lib/patients/patient-display-utils';
import {
  formatDuplicateCandidateDob,
  formatDuplicateCandidateName,
  type DuplicateHardBlockCandidate,
} from '@/lib/patients/duplicate-hard-block';
import {
  buildMatchedEvidenceRows,
  formatMatchedAttributeLabel,
  formatRegistrationPhoneEnding,
  type SoftMatchRegistrationDraft,
} from '@/lib/patients/registration-duplicate-check';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

const DIALOG_TITLE = 'Possible Duplicate Patient';

const DIALOG_DESCRIPTION = 'Review the existing patient before continuing.';

function formatGenderLabel(gender?: string | null): string | null {
  const value = gender?.trim();
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function IdentityMetaLine({ parts }: { parts: Array<string | null | undefined> }) {
  const line = parts.filter(Boolean).join(' · ');
  if (!line) return null;
  return (
    <p className="mt-0.5 text-[13px] font-medium leading-4 text-counselling-muted-foreground tabular-nums">
      {line}
    </p>
  );
}

function NewRegistrationPanel({ draft }: { draft?: SoftMatchRegistrationDraft | null }) {
  const name =
    [draft?.firstName, draft?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || 'New registration';
  const dob = formatDuplicateCandidateDob(draft?.dateOfBirth ?? null);
  const gender = formatGenderLabel(draft?.gender);
  const phoneEnding = formatRegistrationPhoneEnding(draft?.phone);

  return (
    <section
      className="shrink-0 border-b border-counselling-border/60 px-4 py-3"
      data-testid="duplicate-soft-match-new-registration"
      aria-label="New registration"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
        New registration
      </p>
      <p className="mt-1 truncate text-sm font-bold text-counselling-foreground">{name}</p>
      <IdentityMetaLine parts={[dob, gender, phoneEnding]} />
    </section>
  );
}

function CandidateIdentityLine({ candidate }: { candidate: DuplicateHardBlockCandidate }) {
  const dobRaw =
    candidate.dateOfBirth instanceof Date
      ? candidate.dateOfBirth.toISOString()
      : candidate.dateOfBirth;
  const age = calcPatientAge(typeof dobRaw === 'string' ? dobRaw : null);
  return (
    <IdentityMetaLine
      parts={[
        candidate.medicalRecordNumber?.trim() || null,
        formatDuplicateCandidateDob(candidate.dateOfBirth),
        age != null ? `${age}Y` : null,
        formatGenderLabel(candidate.gender),
      ]}
    />
  );
}

function EvidenceRow({
  signal,
  label,
  state,
  candidateId,
}: {
  signal: string;
  label: string;
  state: 'matches' | 'different';
  candidateId: string;
}) {
  const stateLabel = state === 'matches' ? 'Matches' : 'Different';
  const iconClass =
    state === 'matches'
      ? 'text-red-600'
      : 'text-green-600';
  const testIdPrefix =
    state === 'matches' ? 'duplicate-soft-match-matched' : 'duplicate-soft-match-different';

  return (
    <li
      className="flex min-w-0 items-center justify-between gap-3 text-xs leading-4"
      data-testid={`${testIdPrefix}-${candidateId}-${signal}`}
      data-evidence-state={state}
      aria-label={`${label}: ${stateLabel}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Check className={cn('h-3.5 w-3.5 shrink-0', iconClass)} aria-hidden />
        <span className="truncate font-semibold text-counselling-foreground">{label}</span>
      </span>
      <span className="shrink-0 font-medium text-counselling-muted-foreground">{stateLabel}</span>
    </li>
  );
}

function MatchReview({ candidate }: { candidate: DuplicateHardBlockCandidate }) {
  // Server-authored evidence only; never compare registration fields client-side.
  // Prefer matchedAttributes (all signals). FirstName+LastName → "Name".
  const matched = buildMatchedEvidenceRows(candidate.matchedAttributes);
  const different = (candidate.differentAttributes ?? [])
    .map((signal) => ({ signal, label: formatMatchedAttributeLabel(signal) }))
    .filter((row): row is { signal: string; label: string } => Boolean(row.label));

  if (matched.length === 0 && different.length === 0) {
    return (
      <div className="mt-2" data-testid={`duplicate-soft-match-evidence-${candidate.id}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
          Match review
        </p>
        <p className="mt-1 text-xs text-counselling-muted-foreground">Match details unavailable</p>
      </div>
    );
  }

  const matchedSummary = matched.map((row) => row.label).join(', ');
  const differentSummary = different.map((row) => row.label).join(', ');

  return (
    <div className="mt-2" data-testid={`duplicate-soft-match-evidence-${candidate.id}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
        Match review
      </p>
      <ul
        className="mt-1.5 list-none space-y-1.5 p-0"
        aria-label={[
          matchedSummary ? `Matches: ${matchedSummary}` : null,
          differentSummary ? `Different: ${differentSummary}` : null,
        ]
          .filter(Boolean)
          .join('. ')}
      >
        {matched.map((row) => (
          <EvidenceRow
            key={`m-${row.signal}`}
            candidateId={candidate.id}
            signal={row.signal}
            label={row.label}
            state="matches"
          />
        ))}
        {different.map((row) => (
          <EvidenceRow
            key={`d-${row.signal}`}
            candidateId={candidate.id}
            signal={row.signal}
            label={row.label}
            state="different"
          />
        ))}
      </ul>
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
  showDivider,
}: {
  candidate: DuplicateHardBlockCandidate;
  selected: boolean;
  onSelect: () => void;
  showDivider?: boolean;
}) {
  const name = formatDuplicateCandidateName(candidate);
  return (
    <div
      className={cn(showDivider && 'border-t border-counselling-border/50 pt-3')}
      data-testid={`duplicate-soft-match-candidate-${candidate.id}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-md p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
          selected
            ? 'bg-counselling-muted/35 ring-1 ring-counselling-primary/35'
            : 'hover:bg-counselling-muted/20',
        )}
      >
        <PatientAvatar
          size="sm"
          firstName={candidate.firstName ?? ''}
          lastName={candidate.lastName ?? ''}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-counselling-foreground">{name}</p>
          <CandidateIdentityLine candidate={candidate} />
          <MatchReview candidate={candidate} />
        </div>
      </button>
    </div>
  );
}

/** Presentational body — unit-tested without Radix portal SSR. */
export function DuplicatePatientSoftMatchContent({
  candidates,
  registrationDraft,
  onDismiss,
  onReviewMatchingInformation,
  onContinueRegistration,
  continuing = false,
  titled = true,
}: {
  candidates: DuplicateHardBlockCandidate[];
  registrationDraft?: SoftMatchRegistrationDraft | null;
  /** Optional dismiss control for the single-shell duplicate view. */
  onDismiss?: () => void;
  onReviewMatchingInformation?: (candidate: DuplicateHardBlockCandidate) => void;
  onContinueRegistration: () => void;
  continuing?: boolean;
  titled?: boolean;
}) {
  const rows = candidates.filter((row) => Boolean(row.id?.trim()));
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  useEffect(() => {
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="duplicate-soft-match-content"
    >
      {titled ? (
        <div className="relative shrink-0 space-y-1 border-b border-counselling-border/60 px-4 py-3 pr-12 text-left">
          <h2 className="text-base font-semibold text-counselling-foreground">{DIALOG_TITLE}</h2>
          <p className="text-sm text-counselling-muted-foreground">{DIALOG_DESCRIPTION}</p>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              disabled={continuing}
              className="absolute right-3 top-3 rounded-md p-1 text-counselling-muted-foreground hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
              aria-label="Close duplicate review"
              data-testid="duplicate-soft-match-dismiss"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <NewRegistrationPanel draft={registrationDraft} />

      <section
        className="flex min-h-0 flex-1 flex-col px-4 py-3"
        aria-label="Existing patient"
        data-testid="duplicate-soft-match-existing-patients"
      >
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
          Existing patient
        </p>
        {rows.length > 1 ? (
          <p className="mt-1 text-xs text-counselling-muted-foreground">
            Select a possible match to review its evidence.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Possible matches were reported, but no candidate details were returned. Return to
            registration and review before trying again.
          </p>
        ) : (
          <div
            className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
            data-testid="duplicate-soft-match-candidate-list"
            role="radiogroup"
            aria-label="Possible matching patients"
          >
            {rows.map((candidate, index) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                selected={candidate.id === selectedId}
                onSelect={() => setSelectedId(candidate.id)}
                showDivider={index > 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* Soft footer: Review + Continue only. X/close dismisses back to the active session. */}
      <div className="flex shrink-0 flex-row flex-wrap justify-end gap-2 border-t border-counselling-border/60 px-4 py-3">
        {onReviewMatchingInformation ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              if (selected) onReviewMatchingInformation(selected);
            }}
            disabled={continuing || !selected}
            data-testid="duplicate-soft-match-review"
          >
            Review matching information
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-8"
          onClick={onContinueRegistration}
          disabled={continuing}
          data-testid="duplicate-soft-match-continue"
        >
          {continuing ? 'Continuing…' : 'Continue Registration'}
        </Button>
      </div>
    </div>
  );
}

/** Standalone dialog wrapper retained for isolated tests; registration uses inline shell view. */
export function DuplicatePatientSoftMatchDialog({
  open,
  candidates,
  registrationDraft,
  onOpenChange,
  onReviewMatchingInformation,
  onContinueRegistration,
  continuing = false,
}: {
  open: boolean;
  candidates: DuplicateHardBlockCandidate[];
  registrationDraft?: SoftMatchRegistrationDraft | null;
  onOpenChange: (open: boolean) => void;
  onReviewMatchingInformation?: (candidate: DuplicateHardBlockCandidate) => void;
  onContinueRegistration: () => void;
  continuing?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (continuing) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="xl"
        className="counselling-session flex w-[min(100vw-1.5rem,40rem)] max-h-[min(85vh,42rem)] flex-col gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none"
        data-testid="duplicate-soft-match-dialog"
        // Nested over registration Dialog — ignore outside dismiss so soft UI
        // cannot flash-close and leave a remounted empty wizard underneath.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-counselling-border/60 px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base font-semibold text-counselling-foreground">
            {DIALOG_TITLE}
          </DialogTitle>
          <DialogDescription className="text-sm text-counselling-muted-foreground">
            {DIALOG_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>
        <DuplicatePatientSoftMatchContent
          candidates={candidates}
          registrationDraft={registrationDraft}
          onDismiss={() => onOpenChange(false)}
          onReviewMatchingInformation={onReviewMatchingInformation}
          onContinueRegistration={onContinueRegistration}
          continuing={continuing}
          titled={false}
        />
      </DialogContent>
    </Dialog>
  );
}

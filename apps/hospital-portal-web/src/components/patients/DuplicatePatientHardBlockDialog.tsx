'use client';

import { useEffect, useState } from 'react';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { Badge } from '@/components/ui/badge';
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
import { resolveMatchedEvidenceLabels } from '@/lib/patients/registration-duplicate-check';
import { cn } from '@/lib/utils';

const DIALOG_TITLE = 'Possible Duplicate Patient';

const DIALOG_DESCRIPTION =
  'We found existing patients with matching information. Review the match before creating a new patient.';

function CandidateIdentityLine({ candidate }: { candidate: DuplicateHardBlockCandidate }) {
  const dobRaw =
    candidate.dateOfBirth instanceof Date
      ? candidate.dateOfBirth.toISOString()
      : candidate.dateOfBirth;
  const age = calcPatientAge(typeof dobRaw === 'string' ? dobRaw : null);
  const parts = [
    candidate.medicalRecordNumber?.trim() || null,
    formatDuplicateCandidateDob(candidate.dateOfBirth),
    age != null ? `${age}Y` : null,
    candidate.gender?.trim() || null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="mt-0.5 text-[13px] font-medium leading-4 text-counselling-muted-foreground tabular-nums">
      {parts.join(' · ')}
    </p>
  );
}

function MatchedInformation({ candidate }: { candidate: DuplicateHardBlockCandidate }) {
  // Prefer server matchedAttributes; MatchType labels only when attributes absent.
  const matchedFields = resolveMatchedEvidenceLabels(
    candidate.matchedAttributes,
    candidate.matchType,
  );
  return (
    <div className="mt-1.5" data-testid="duplicate-hard-block-matched-information">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
        Matched information
      </p>
      {matchedFields.length > 0 ? (
        <ul
          className="mt-1 flex list-none flex-wrap gap-1 p-0"
          aria-label={`Matched information: ${matchedFields.join(', ')}`}
        >
          {matchedFields.map((field) => (
            <li key={field}>
              <Badge
                variant="outline"
                aria-hidden
                className="h-5 rounded-md border-counselling-border bg-counselling-muted/30 px-1.5 py-0 text-[10px] font-medium text-counselling-foreground"
              >
                {field}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="mt-1 text-xs leading-4 text-counselling-muted-foreground"
          data-testid="duplicate-hard-block-match-explanation"
        >
          Match details unavailable
        </p>
      )}
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
      className={cn(showDivider && 'border-t border-counselling-border/50 pt-2.5')}
      data-testid={`duplicate-hard-block-candidate-${candidate.id}`}
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
          <MatchedInformation candidate={candidate} />
        </div>
      </button>
    </div>
  );
}

/** Presentational body — unit-tested without Radix portal SSR. */
export function DuplicatePatientHardBlockContent({
  message,
  duplicates,
  onBackToRegistration,
  onReviewMatching,
  titled = true,
}: {
  message?: string;
  duplicates: DuplicateHardBlockCandidate[];
  onBackToRegistration: () => void;
  onReviewMatching?: (candidate: DuplicateHardBlockCandidate) => void;
  titled?: boolean;
}) {
  const candidates = duplicates.filter((row) => Boolean(row.id?.trim()));
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.id ?? null);

  useEffect(() => {
    if (!candidates.some((row) => row.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? null);
    }
  }, [candidates, selectedId]);

  const selected = candidates.find((row) => row.id === selectedId) ?? null;

  const handleReview = () => {
    if (selected && onReviewMatching) {
      onReviewMatching(selected);
      return;
    }
    onBackToRegistration();
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="duplicate-hard-block-content"
    >
      {titled ? (
        <div className="space-y-1 border-b border-counselling-border/60 px-4 py-3 text-left">
          <h2 className="text-base font-semibold text-counselling-foreground">{DIALOG_TITLE}</h2>
          <p className="text-sm text-counselling-muted-foreground">{DIALOG_DESCRIPTION}</p>
          {message?.trim() && message.trim() !== DIALOG_DESCRIPTION ? (
            <p className="text-xs text-counselling-muted-foreground">{message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground">
          Existing patients
        </p>
        {candidates.length > 1 ? (
          <p className="mt-1 text-xs text-counselling-muted-foreground">
            Select a possible match to review its evidence.
          </p>
        ) : null}

        {candidates.length === 0 ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            A matching patient already exists, but no candidate details were returned. Return to
            registration and search the directory before trying again.
          </p>
        ) : (
          <div
            className="mt-2 max-h-[min(18rem,40vh)] space-y-2.5 overflow-y-auto pr-0.5"
            data-testid="duplicate-hard-block-candidate-list"
            role="radiogroup"
            aria-label="Possible matching patients"
          >
            {candidates.map((candidate, index) => (
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
      </div>

      <div className="flex shrink-0 flex-row flex-wrap justify-end gap-2 border-t border-counselling-border/60 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onBackToRegistration}
          data-testid="duplicate-hard-block-back"
        >
          Back to Registration
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-8"
          onClick={handleReview}
          disabled={!selected && candidates.length > 0}
          data-testid="duplicate-hard-block-review"
        >
          Review matching information
        </Button>
      </div>
    </div>
  );
}

export function DuplicatePatientHardBlockDialog({
  open,
  message,
  duplicates,
  onOpenChange,
  onBackToRegistration,
  onReviewMatching,
}: {
  open: boolean;
  message?: string;
  duplicates: DuplicateHardBlockCandidate[];
  onOpenChange: (open: boolean) => void;
  onBackToRegistration: () => void;
  onReviewMatching?: (candidate: DuplicateHardBlockCandidate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="counselling-session w-[min(100vw-1.5rem,36rem)] max-h-[min(85vh,40rem)] gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none"
        data-testid="duplicate-hard-block-dialog"
      >
        <DialogHeader className="space-y-1 border-b border-counselling-border/60 px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base font-semibold text-counselling-foreground">
            {DIALOG_TITLE}
          </DialogTitle>
          <DialogDescription className="text-sm text-counselling-muted-foreground">
            {DIALOG_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>
        <DuplicatePatientHardBlockContent
          message={message}
          duplicates={duplicates}
          onBackToRegistration={onBackToRegistration}
          onReviewMatching={onReviewMatching}
          titled={false}
        />
      </DialogContent>
    </Dialog>
  );
}

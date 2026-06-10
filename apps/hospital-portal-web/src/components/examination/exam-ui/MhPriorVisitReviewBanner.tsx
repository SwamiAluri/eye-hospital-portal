'use client';

import { useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import { Button } from '@/components/ui/button';

interface MhPriorVisitReviewBannerProps {
  priorVisit: PriorVisitSnapshot | null;
  onMarkReviewed?: () => void;
  onCopyFromPrior?: () => void;
  reviewed?: boolean;
}

export function MhPriorVisitReviewBanner({
  priorVisit,
  onMarkReviewed,
  onCopyFromPrior,
  reviewed = false,
}: MhPriorVisitReviewBannerProps) {
  const [localReviewed, setLocalReviewed] = useState(reviewed);

  if (!priorVisit?.examinationDate) return null;

  const raw = priorVisit.raw as {
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
  } | undefined;

  const conditions = raw?.conditions ?? [];
  const allergies = raw?.allergies ?? [];
  const meds = raw?.medications ?? [];

  const summaryParts: string[] = [];
  if (conditions.length) summaryParts.push(`${conditions.length} condition(s) on file`);
  if (allergies.length) summaryParts.push(`${allergies.length} allergy alert(s)`);
  if (meds.length) summaryParts.push(`${meds.length} medication(s) noted`);

  const dateLabel = new Date(priorVisit.examinationDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isReviewed = reviewed || localReviewed;

  return (
    <div className="mb-4 p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-indigo-950">Last visit: {dateLabel}</p>
          <p className="text-xs text-indigo-800 mt-1">
            {summaryParts.length > 0
              ? summaryParts.join(' · ')
              : 'Review prior medical history before documenting changes.'}
          </p>
          {(conditions.length > 0 || allergies.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {conditions.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-2 py-0.5 bg-white border border-indigo-100 rounded text-slate-700"
                >
                  {c}
                </span>
              ))}
              {allergies.slice(0, 2).map((a) => (
                <span
                  key={a}
                  className="text-[10px] px-2 py-0.5 bg-red-50 border border-red-200 rounded text-red-800 font-medium"
                >
                  ⚠ {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {onCopyFromPrior && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<Copy className="w-3.5 h-3.5" />}
              onClick={onCopyFromPrior}
            >
              Copy from last visit
            </Button>
          )}
          {onMarkReviewed && (
            <Button
              type="button"
              size="sm"
              variant={isReviewed ? 'secondary' : 'primary'}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setLocalReviewed(true);
                onMarkReviewed();
              }}
              disabled={isReviewed}
            >
              {isReviewed ? 'Reviewed' : 'Mark as reviewed'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Check, Eye, Stethoscope, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { OPTOMETRIST_RECOMMENDATION_PLACEHOLDER } from '@/lib/counsellors-desk/clinical-recommendations-placeholder';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

type ContributorVariant = 'doctor' | 'optometrist';

/** Local contributor presentation — extensible for future approved clinical sources. */
type ClinicalRecommendationContributor = {
  role: string;
  roleHint: string;
  testId: string;
  variant: ContributorVariant;
  icon: typeof Stethoscope;
  items: string[];
  /** When true, render items as checklist bullets (optometrist key points). */
  checklist?: boolean;
};

const variantChrome: Record<
  ContributorVariant,
  {
    card: string;
    header: string;
    iconWrap: string;
    itemBox: string;
    checkWrap: string;
  }
> = {
  // Sky = existing counselling info accent (statusPillInfo); emerald = counselling success/primary family
  doctor: {
    card: 'border-sky-200/90 bg-counselling-card',
    header: 'border-b border-sky-100 bg-sky-50/90',
    iconWrap: 'bg-sky-600 text-white',
    itemBox: 'border border-sky-100 bg-white',
    checkWrap: 'bg-sky-600 text-white',
  },
  optometrist: {
    card: 'border-emerald-200/90 bg-counselling-card',
    header: 'border-b border-emerald-100 bg-emerald-50/90',
    iconWrap: 'bg-emerald-600 text-white',
    itemBox: 'border border-emerald-100 bg-white',
    checkWrap: 'bg-emerald-600 text-white',
  },
};

export interface ClinicalRecommendationsContentProps {
  /** Existing doctor recommendation summary from session data path (may include eye). */
  doctorRecommendationSummary?: string | null;
}

/**
 * Counsellor-facing Clinical Recommendations body.
 * Doctor content uses the existing session recommendation data path.
 *
 * Optometrist lines are STATIC UX PLACEHOLDER content pending future
 * clinical-source integration and are not a clinical source of truth.
 */
export function ClinicalRecommendationsContent({
  doctorRecommendationSummary,
}: ClinicalRecommendationsContentProps) {
  const contributors: ClinicalRecommendationContributor[] = [];

  const doctorSummary = doctorRecommendationSummary?.trim();
  if (doctorSummary) {
    contributors.push({
      role: counsellingCopy.clinicalRecommendationDoctor,
      roleHint: counsellingCopy.clinicalRecommendationDoctorHint,
      testId: counsellingTestIds.clinicalRecommendationDoctor,
      variant: 'doctor',
      icon: Stethoscope,
      items: [doctorSummary],
    });
  }

  contributors.push({
    role: counsellingCopy.clinicalRecommendationOptometrist,
    roleHint: counsellingCopy.clinicalRecommendationOptometristHint,
    testId: counsellingTestIds.clinicalRecommendationOptometrist,
    variant: 'optometrist',
    icon: Eye,
    checklist: true,
    // Static UX placeholder — not clinical SoT; not persisted; not API-backed.
    items: [...OPTOMETRIST_RECOMMENDATION_PLACEHOLDER.lines],
  });

  return (
    <div
      data-testid={counsellingTestIds.clinicalRecommendationsSheet}
      className="flex flex-col gap-3.5"
    >
      {contributors.map((contributor) => {
        const Icon = contributor.icon;
        const chrome = variantChrome[contributor.variant];
        return (
          <section
            key={contributor.role}
            data-testid={contributor.testId}
            className={cn(
              'overflow-hidden rounded-xl border shadow-sm',
              chrome.card,
            )}
          >
            <div className={cn('flex items-center gap-3 px-3.5 py-3', chrome.header)}>
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  chrome.iconWrap,
                )}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5 text-counselling-foreground">
                  {contributor.role}
                </p>
                <p className="text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
                  {contributor.roleHint}
                </p>
              </div>
            </div>

            <div className="space-y-2 px-3.5 py-3">
              {contributor.checklist
                ? contributor.items.map((item) => (
                    <div
                      key={item}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg px-3 py-2.5',
                        chrome.itemBox,
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                          chrome.checkWrap,
                        )}
                        aria-hidden
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-counselling-foreground">
                        {item}
                      </p>
                    </div>
                  ))
                : contributor.items.map((item) => (
                    <div
                      key={item}
                      className={cn('rounded-lg px-3 py-3', chrome.itemBox)}
                    >
                      <p className="text-[15px] font-semibold leading-6 text-counselling-foreground">
                        {item}
                      </p>
                    </div>
                  ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export interface ClinicalRecommendationsSheetProps {
  open: boolean;
  onClose: () => void;
  doctorRecommendationSummary?: string | null;
}

/**
 * Right-side Clinical Recommendations sheet.
 * Portaled SheetContent keeps `counselling-session` so theme tokens resolve.
 */
export function ClinicalRecommendationsSheet({
  open,
  onClose,
  doctorRecommendationSummary,
}: ClinicalRecommendationsSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName="!z-[90] bg-black/40"
        data-testid={counsellingTestIds.clinicalRecommendationsSheetRoot}
        className={cn(
          'counselling-session !z-[100] flex h-full w-full flex-col gap-0 overflow-hidden bg-counselling-card p-0 sm:max-w-md',
          'border-l border-counselling-border shadow-lg',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-counselling-border/60 bg-counselling-card px-4 py-3">
          <div className="min-w-0">
            <SheetTitle className="text-[18px] font-semibold leading-6 text-counselling-foreground">
              {counsellingCopy.clinicalRecommendations}
            </SheetTitle>
            <SheetDescription
              data-testid={counsellingTestIds.clinicalRecommendationsSubtitle}
              className="sr-only"
            >
              {counsellingCopy.clinicalRecommendations}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-counselling-card px-4 py-4 sm:px-5">
          <ClinicalRecommendationsContent
            doctorRecommendationSummary={doctorRecommendationSummary}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import type { ReactNode } from 'react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export interface QuoteWorkspaceSectionProps {
  id?: string;
  title: string;
  /** Optional section number prefix, e.g. 1 → "1. Procedure & eye" */
  sectionNumber?: number;
  /** Optional right-side meta (counts, totals). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Show top divider — use false for first section in workspace. */
  divider?: boolean;
  'data-testid'?: string;
}

/** Flat clinical section — heading + content, no nested card chrome. */
export function QuoteWorkspaceSection({
  id,
  title,
  sectionNumber,
  meta,
  children,
  className,
  divider = true,
  'data-testid': testId,
}: QuoteWorkspaceSectionProps) {
  const heading = sectionNumber != null ? `${sectionNumber}. ${title}` : title;

  return (
    <section
      id={id}
      data-testid={testId}
      className={cn(
        divider && 'border-t border-counselling-border/60 pt-4',
        className,
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={counsellingSessionTokens.quoteSectionHeading}>{heading}</h3>
        {meta ? (
          <div className="text-xs tabular-nums text-counselling-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

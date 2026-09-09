'use client';

import {
  buildNotesReadinessItems,
  type NotesReadinessItem,
} from '@/lib/counsellors-desk/notes-workspace-presentation';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingPhaseValidationContext } from '@/lib/counsellors-desk/counselling-progress';
import { cn } from '@/lib/utils';

export interface NotesReadinessStripProps {
  context: Pick<
    CounsellingPhaseValidationContext,
    'decision' | 'paymentType' | 'insuranceCompany' | 'schedule' | 'followUpDate' | 'followUpReason'
  >;
  className?: string;
}

function ReadinessCell({ item }: { item: NotesReadinessItem }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground">
        {item.label}
      </p>
      <p className="mt-0.5 truncate text-xs font-medium text-counselling-foreground">{item.value}</p>
    </div>
  );
}

/** Compact session handoff facts for Notes — does not duplicate the global status strip. */
export function NotesReadinessStrip({ context, className }: NotesReadinessStripProps) {
  const items = buildNotesReadinessItems(context);
  if (!items?.length) return null;

  return (
    <div
      data-testid={counsellingTestIds.notesReadinessStrip}
      className={cn(counsellingSessionTokens.workspacePanel, 'px-3 py-2.5', className)}
      aria-label={counsellingCopy.notesReadiness}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ReadinessCell key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

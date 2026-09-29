'use client';

import { ChevronUp, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import {
  COUNSELLING_ACTION_BAR_HEIGHT_PX,
  COUNSELLING_QUOTE_STRIP_HEIGHT_PX,
} from '@/components/counsellors-desk/session/counselling-layout-constants';
import {
  CounsellingButton,
  CounsellingSheet,
  CounsellingSheetContent,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

interface CounsellingQuoteBottomSheetProps {
  finalPayable: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
}

export function CounsellingQuoteBottomSheet({
  finalPayable,
  expanded,
  onExpandedChange,
  children,
}: CounsellingQuoteBottomSheetProps) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[55] lg:hidden"
        style={{ bottom: COUNSELLING_ACTION_BAR_HEIGHT_PX }}
      >
        <CounsellingButton
          type="button"
          variant="ghost"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          className="pointer-events-auto flex min-h-14 w-full items-center justify-between gap-3 rounded-none border-t border-counselling-border bg-counselling-card px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] hover:bg-counselling-muted"
          style={{ minHeight: COUNSELLING_QUOTE_STRIP_HEIGHT_PX }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold text-counselling-foreground">{counsellingCopy.estimate}</span>
            <span className="text-counselling-muted-foreground/80">·</span>
            <span className="truncate text-sm font-bold tabular-nums text-counselling-primary">
              {formatInr(finalPayable)}
            </span>
          </div>
          <ChevronUp
            size={20}
            className={cn('shrink-0 text-counselling-muted-foreground/80 transition-transform', !expanded && 'rotate-180')}
          />
        </CounsellingButton>
      </div>

      <CounsellingSheet open={expanded} onOpenChange={onExpandedChange}>
        <CounsellingSheetContent
          side="bottom"
          className={cn(
            'counsellor-scrollbar flex max-h-[min(72vh,640px)] flex-col gap-0 overflow-hidden rounded-t-2xl border-t border-counselling-border p-0 lg:hidden',
            '[&>button]:hidden',
          )}
          style={{
            bottom: COUNSELLING_ACTION_BAR_HEIGHT_PX + COUNSELLING_QUOTE_STRIP_HEIGHT_PX,
          }}
        >
          <p className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50/80 px-4 py-2 text-[10px] text-amber-800">
            <Smartphone size={12} className="shrink-0" />
            Tip: Rotate to landscape or use a larger screen when sharing the estimate with the
            patient.
          </p>
          <div className="overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-hide">
            {children}
          </div>
        </CounsellingSheetContent>
      </CounsellingSheet>
    </>
  );
}

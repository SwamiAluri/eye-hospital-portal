'use client';

import type { ReactNode } from 'react';
import {
  COUNSELLING_ACTION_BAR_HEIGHT_PX,
  COUNSELLING_QUOTE_STRIP_HEIGHT_PX,
} from '@/components/counsellors-desk/session/counselling-layout-constants';
import { cn } from '@/lib/utils';

interface CounsellingSessionLayoutProps {
  workspace: ReactNode;
  /** When null/undefined, Finish and similar terminals use full-width workspace (no Estimate rail). */
  quotePanel?: ReactNode | null;
  /**
   * When false (Notes), desktop left column does not independently scroll —
   * content must fit. Mobile keeps column scroll so stacked layout stays reachable.
   * Quote/Decision keep true (default).
   */
  workspaceScroll?: boolean;
}

/** Room for fixed quote strip + action bar on tablet/phone. */
export const COUNSELLING_MOBILE_SCROLL_PAD_PX =
  COUNSELLING_ACTION_BAR_HEIGHT_PX + COUNSELLING_QUOTE_STRIP_HEIGHT_PX + 16;

/** Workspace column + quote rail — aligned two-column layout (Wave 2G / 2E-5RR). */
export function CounsellingSessionLayout({
  workspace,
  quotePanel,
  workspaceScroll = true,
}: CounsellingSessionLayoutProps) {
  const showQuoteRail = quotePanel != null;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch lg:gap-3 min-[1600px]:lg:gap-4">
      <div
        data-testid="counselling-session-workspace"
        className={cn(
          'staff-page-workspace-scroll flex min-h-0 min-w-0 flex-1 max-lg:pb-[144px] lg:min-h-0',
          showQuoteRail ? 'lg:flex-[1_1_58%]' : 'lg:flex-1',
          workspaceScroll
            ? 'overflow-y-auto overscroll-y-contain'
            : 'max-lg:overflow-y-auto max-lg:overscroll-y-contain lg:h-full lg:overflow-hidden',
        )}
      >
        <div
          className={cn(
            'min-w-0 w-full',
            !workspaceScroll && 'lg:flex lg:h-full lg:min-h-0 lg:flex-col',
          )}
        >
          {workspace}
        </div>
      </div>
      {showQuoteRail ? (
        <div className="hidden min-h-0 min-w-0 lg:flex lg:min-h-0 lg:flex-[1_1_42%] lg:overflow-hidden">
          {quotePanel}
        </div>
      ) : null}
    </div>
  );
}

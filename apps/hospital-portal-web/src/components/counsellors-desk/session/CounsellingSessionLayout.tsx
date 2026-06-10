'use client';

import type { ReactNode } from 'react';
import {
  COUNSELLING_ACTION_BAR_HEIGHT_PX,
  COUNSELLING_QUOTE_STRIP_HEIGHT_PX,
} from '@/components/counsellors-desk/session/counselling-layout-constants';

interface CounsellingSessionLayoutProps {
  phaseNav: ReactNode;
  workspace: ReactNode;
  quotePanel: ReactNode;
}

/** Room for fixed quote strip + sticky action bar on tablet/phone. */
export const COUNSELLING_MOBILE_SCROLL_PAD_PX =
  COUNSELLING_ACTION_BAR_HEIGHT_PX + COUNSELLING_QUOTE_STRIP_HEIGHT_PX + 16;

/** Desktop: phase sidebar + workspace + sticky quote. Mobile: single column + bottom-sheet quote. */
export function CounsellingSessionLayout({
  phaseNav,
  workspace,
  quotePanel,
}: CounsellingSessionLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto max-lg:pb-[144px] lg:flex-row lg:gap-5 lg:overflow-hidden lg:pb-0">
      {phaseNav}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-x-hidden lg:flex-row lg:items-start lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-h-full lg:flex-[1_1_55%] lg:overflow-y-auto lg:scrollbar-hide">
          {workspace}
        </div>
        {quotePanel}
      </div>
    </div>
  );
}

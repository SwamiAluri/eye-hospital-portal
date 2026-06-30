'use client';

import type { ReactNode } from 'react';
import {
  COUNSELLING_ACTION_BAR_HEIGHT_PX,
  COUNSELLING_QUOTE_STRIP_HEIGHT_PX,
} from '@/components/counsellors-desk/session/counselling-layout-constants';

interface CounsellingSessionLayoutProps {
  workspace: ReactNode;
  quotePanel: ReactNode;
}

/** Room for fixed quote strip + action bar on tablet/phone. */
export const COUNSELLING_MOBILE_SCROLL_PAD_PX =
  COUNSELLING_ACTION_BAR_HEIGHT_PX + COUNSELLING_QUOTE_STRIP_HEIGHT_PX + 16;

/** Workspace column + quote rail; session flow lives inside phase cards. */
export function CounsellingSessionLayout({ workspace, quotePanel }: CounsellingSessionLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:flex-row lg:items-stretch">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain max-lg:pb-[144px] lg:flex-[1_1_55%] lg:scrollbar-hide">
        {workspace}
      </div>
      {quotePanel}
    </div>
  );
}

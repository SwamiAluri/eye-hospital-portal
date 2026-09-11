'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CounselorAnalyticsTab } from '@/components/counselor/CounselorAnalyticsTab';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import { cn } from '@/lib/utils';

export default function CounselorAnalyticsPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <div
        data-testid="analytics-page"
        className={cn(
          counsellingSessionTokens.shellPage,
          'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0.5',
          'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4 min-[1600px]:pt-2.5',
        )}
      >
        <header className="flex shrink-0 flex-col justify-center px-0.5 py-0 leading-none min-[1600px]:py-0.5 print:hidden">
          <h1 className="staff-page-title font-semibold tracking-tight text-counselling-foreground max-[1599px]:text-base max-[1599px]:leading-5 min-[1600px]:text-[1.375rem]">
            Analytics
          </h1>
        </header>
        <CounselorAnalyticsTab />
      </div>
    </ProtectedRoute>
  );
}

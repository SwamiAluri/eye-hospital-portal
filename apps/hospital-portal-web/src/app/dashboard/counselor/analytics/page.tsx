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
          'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0',
          'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4',
        )}
      >
        <CounselorAnalyticsTab />
      </div>
    </ProtectedRoute>
  );
}

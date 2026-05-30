'use client';

import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { AdminDashboardHeader } from './AdminDashboardHeader';
import { AdminKpiStrip } from './AdminKpiStrip';
import { AdminIamPanel } from './AdminIamPanel';
import { AdminAttentionStrip } from './AdminAttentionStrip';
import { AdminModuleGrid } from './AdminModuleGrid';
import { AdminActivityFeed } from './AdminActivityFeed';
import { AdminAlertsPanel } from './AdminAlertsPanel';
import { AdminQuickActions } from './AdminQuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { licensesApi } from '@/lib/api';

function SectionSkeleton() {
  return <Skeleton className="h-32 w-full rounded-2xl" />;
}

export function AdminCommandCenterPage() {
  const {
    overview,
    quickStats,
    activities,
    alerts,
    activitySeries,
    breakdownStats,
    isLoading,
    refetchAll,
    dismissAlert,
  } = useAdminDashboard();

  const { data: licenseStats } = useQuery({
    queryKey: ['admin-dashboard', 'license-expiring'],
    queryFn: async () => {
      try {
        const { data } = await licensesApi.getExpiring(30);
        return Array.isArray(data) ? data.length : 0;
      } catch {
        return 0;
      }
    },
    staleTime: 300_000,
  });

  const refreshing = isLoading;

  if (isLoading && !overview) {
    return (
      <div className="flex flex-col h-full bg-gray-50/60">
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SectionSkeleton key={i} />
            ))}
          </div>
          <SectionSkeleton />
        </div>
      </div>
    );
  }

  if (!overview || !quickStats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Unable to load dashboard data. Try refreshing the page.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/60 min-h-0">
      <AdminDashboardHeader
        healthLabel={overview.systemHealthLabel}
        healthLevel={overview.systemHealth}
        onRefresh={refetchAll}
        refreshing={refreshing}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <AdminKpiStrip stats={overview} />

        <AdminAttentionStrip alerts={alerts} expiringLicenses={licenseStats} />

        <AdminIamPanel
          quickStats={quickStats}
          activitySeries={activitySeries}
          breakdownStats={breakdownStats}
        />

        <AdminModuleGrid />

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminActivityFeed activities={activities} />
          <AdminAlertsPanel alerts={alerts} onDismiss={dismissAlert} />
        </div>

        <AdminQuickActions />
      </div>
    </div>
  );
}

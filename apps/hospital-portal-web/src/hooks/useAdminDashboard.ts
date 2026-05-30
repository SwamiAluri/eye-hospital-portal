'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  mapOverviewStats,
  mapQuickStats,
  mapRecentActivities,
  mapAlerts,
  mapActivitySeries,
  mapDashboardStats,
  type AdminOverviewStats,
  type AdminQuickStats,
  type AdminRecentActivity,
  type AdminAlert,
  type ActivitySeriesPoint,
  type AdminDashboardStats,
} from '@/lib/admin/map-admin-dashboard';

export function useAdminDashboard() {
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: ['admin-dashboard', 'overview'],
    queryFn: async () => {
      const { data } = await dashboardApi.getOverview();
      return mapOverviewStats(data);
    },
    staleTime: 60_000,
  });

  const quickStats = useQuery({
    queryKey: ['admin-dashboard', 'quick-stats'],
    queryFn: async () => {
      const { data } = await dashboardApi.getQuickStats();
      return mapQuickStats(data);
    },
    staleTime: 60_000,
  });

  const activities = useQuery({
    queryKey: ['admin-dashboard', 'activities'],
    queryFn: async () => {
      const { data } = await dashboardApi.getRecentActivities(12);
      return mapRecentActivities(Array.isArray(data) ? data : []);
    },
    staleTime: 30_000,
  });

  const alerts = useQuery({
    queryKey: ['admin-dashboard', 'alerts'],
    queryFn: async () => {
      const { data } = await dashboardApi.getAlerts();
      return mapAlerts(Array.isArray(data) ? data : []);
    },
    staleTime: 30_000,
  });

  const activitySeries = useQuery({
    queryKey: ['admin-dashboard', 'activity-series'],
    queryFn: async () => {
      const { data } = await dashboardApi.getActivitySeries(24);
      return mapActivitySeries(Array.isArray(data) ? data : []);
    },
    staleTime: 60_000,
  });

  const breakdownStats = useQuery({
    queryKey: ['admin-dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await dashboardApi.getStats();
      return mapDashboardStats(data);
    },
    staleTime: 120_000,
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const dismissAlert = async (id: string) => {
    await dashboardApi.dismissAlert(id);
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard', 'alerts'] });
  };

  const isLoading =
    overview.isLoading ||
    quickStats.isLoading ||
    activities.isLoading ||
    alerts.isLoading;

  return {
    overview: overview.data as AdminOverviewStats | undefined,
    quickStats: quickStats.data as AdminQuickStats | undefined,
    activities: (activities.data ?? []) as AdminRecentActivity[],
    alerts: (alerts.data ?? []) as AdminAlert[],
    activitySeries: (activitySeries.data ?? []) as ActivitySeriesPoint[],
    breakdownStats: breakdownStats.data as AdminDashboardStats | undefined,
    isLoading,
    error: overview.error ?? quickStats.error,
    refetchAll,
    dismissAlert,
  };
}

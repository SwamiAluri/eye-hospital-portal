'use client';

import { Building2, Users, Briefcase, MapPin, Activity } from 'lucide-react';
import { AdminKpiTile } from './AdminKpiTile';
import type { AdminOverviewStats } from '@/lib/admin/map-admin-dashboard';

export function AdminKpiStrip({ stats }: { stats: AdminOverviewStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <AdminKpiTile
        label="Tenants"
        value={stats.totalTenants}
        sub="Hospital organizations"
        icon={Building2}
        iconBg="bg-indigo-50 text-indigo-600"
        accent="border-l-indigo-500"
        href="/dashboard/admin/tenants"
      />
      <AdminKpiTile
        label="Active Users"
        value={stats.activeUsers.toLocaleString()}
        sub={`${stats.totalUsers} total accounts`}
        icon={Users}
        iconBg="bg-emerald-50 text-emerald-600"
        accent="border-l-emerald-500"
        href="/dashboard/admin/users"
        trend={
          stats.userGrowth !== 0
            ? { value: stats.userGrowth, positive: stats.userGrowth >= 0 }
            : undefined
        }
      />
      <AdminKpiTile
        label="Departments"
        value={stats.totalDepartments}
        sub="Across all branches"
        icon={Briefcase}
        iconBg="bg-violet-50 text-violet-600"
        accent="border-l-violet-500"
        href="/dashboard/departments"
        trend={
          stats.departmentGrowth !== 0
            ? { value: stats.departmentGrowth, positive: stats.departmentGrowth >= 0 }
            : undefined
        }
      />
      <AdminKpiTile
        label="Branches"
        value={stats.totalBranches}
        sub="Physical locations"
        icon={MapPin}
        iconBg="bg-sky-50 text-sky-600"
        accent="border-l-sky-500"
        href="/dashboard/admin/branches"
      />
      <AdminKpiTile
        label="24h Activity"
        value={stats.last24HourActivities.toLocaleString()}
        sub="Audit log events"
        icon={Activity}
        iconBg="bg-amber-50 text-amber-600"
        accent="border-l-amber-500"
        href="/dashboard/admin/audit-logs"
      />
    </div>
  );
}

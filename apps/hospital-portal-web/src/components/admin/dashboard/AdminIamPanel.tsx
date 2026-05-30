'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { TrendingUp, Shield, Gauge } from 'lucide-react';
import type { AdminQuickStats, ActivitySeriesPoint, AdminDashboardStats } from '@/lib/admin/map-admin-dashboard';

export function AdminIamPanel({
  quickStats,
  activitySeries,
  breakdownStats,
}: {
  quickStats: AdminQuickStats;
  activitySeries: ActivitySeriesPoint[];
  breakdownStats?: AdminDashboardStats;
}) {
  const growthPct = quickStats.userGrowthPercentage;
  const isCompliant = quickStats.complianceStatus.toLowerCase().includes('compliant');
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              User growth
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {quickStats.userGrowthThisMonth}{' '}
              <span className="text-sm font-normal text-gray-500">this month</span>
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              <TrendingUp className="inline w-3 h-3 mr-0.5" />
              {growthPct >= 0 ? '+' : ''}
              {growthPct.toFixed(1)}% vs last month ({quickStats.userGrowthLastMonth})
            </p>
          </div>
        </div>
        {chartsReady && activitySeries.length > 0 ? (
          <div className="h-40 min-w-0 w-full" aria-label="24 hour audit activity chart">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={activitySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  fill="rgba(16,185,129,0.15)"
                  name="Events"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">No activity data for the last 24 hours</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-indigo-600" />
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              Compliance
            </p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {quickStats.compliancePercentage.toFixed(1)}%
          </p>
          <p
            className={`text-sm font-medium mt-1 ${
              isCompliant ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {quickStats.complianceStatus}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['HIPAA', 'NABH', 'DPA'].map((regime) => (
              <span
                key={regime}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isCompliant
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {regime}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-sky-600" />
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              API performance
            </p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{quickStats.responseTimeMs}ms</p>
          <p className="text-sm text-gray-500 mt-1">Avg response time</p>
          <p className="text-xs font-medium text-emerald-600 mt-2">{quickStats.performanceStatus}</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Dept utilization</span>
              <span>{quickStats.departmentUtilizationRate.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{
                  width: `${Math.min(100, quickStats.departmentUtilizationRate)}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {quickStats.activeDepartments} active departments
            </p>
          </div>
        </div>
      </div>

      {chartsReady && breakdownStats && breakdownStats.departmentStats.length > 0 && (
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">
            Staff by department (top 10)
          </p>
          <div className="h-48 min-w-0 w-full" aria-label="Department staff distribution">
            <ResponsiveContainer width="100%" height={192}>
              <BarChart
                data={breakdownStats.departmentStats.slice(0, 8)}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="departmentName"
                  tick={{ fontSize: 10 }}
                  width={75}
                />
                <Tooltip />
                <Bar dataKey="staffCount" fill="#6366f1" radius={[0, 4, 4, 0]} name="Staff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

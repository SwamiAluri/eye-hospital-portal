'use client';

import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';

interface DashboardStatsData {
  totalStaff: number;
  totalDepartments: number;
  totalRoles: number;
  totalBranches: number;
  departmentStats: Array<{ departmentName: string; staffCount: number }>;
  roleStats: Array<{ name: string; userCount: number }>;
  branchStats: Array<{ name: string; staffCount: number }>;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardApi.getStats();
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/2 mb-3"></div>
            <div className="h-7 bg-gray-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['Staff', 'Departments', 'Roles', 'Branches'].map((label) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">—</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalStaff}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Departments</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalDepartments}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalRoles}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Branches</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalBranches}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Department Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff by Department</h3>
          <div className="space-y-3">
            {stats.departmentStats.slice(0, 5).map((dept, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{dept.departmentName}</span>
                  <span className="font-medium text-gray-900">{dept.staffCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full"
                    style={{
                      width: `${(dept.staffCount / stats.totalStaff) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Users by Role</h3>
          <div className="space-y-3">
            {stats.roleStats.slice(0, 5).map((role, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{role.name}</span>
                  <span className="font-medium text-gray-900">{role.userCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-400 h-1.5 rounded-full"
                    style={{
                      width: `${(role.userCount / stats.totalStaff) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Branch Distribution */}
      {stats.branchStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff by Branch</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.branchStats.map((branch, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{branch.name}</div>
                <div className="text-xl font-bold text-gray-900 mt-2">{branch.staffCount}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {((branch.staffCount / stats.totalStaff) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

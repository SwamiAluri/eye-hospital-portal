'use client';

import { useState } from 'react';
import {
  UserPlus,
  Users,
  Key,
  Settings,
  Activity,
  Shield,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  filterActivitiesByTab,
  type AdminRecentActivity,
  type ActivityCategory,
} from '@/lib/admin/map-admin-dashboard';
import Link from 'next/link';

function ActivityIcon({ category }: { category: ActivityCategory }) {
  switch (category) {
    case 'registration':
      return <UserPlus className="h-4 w-4 text-emerald-600" />;
    case 'role_assignment':
      return <Users className="h-4 w-4 text-indigo-600" />;
    case 'permission_change':
      return <Key className="h-4 w-4 text-violet-600" />;
    case 'admin_action':
      return <Settings className="h-4 w-4 text-gray-600" />;
    case 'security':
      return <Shield className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

function ActivityList({ items }: { items: AdminRecentActivity[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No activities in this category</p>;
  }

  return (
    <ul className="space-y-1 max-h-80 overflow-y-auto">
      {items.map((activity) => (
        <li
          key={activity.id}
          className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
            {activity.user.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{activity.description}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {activity.user} · {activity.relativeTime}
            </p>
          </div>
          <ActivityIcon category={activity.category} />
        </li>
      ))}
    </ul>
  );
}

export function AdminActivityFeed({ activities }: { activities: AdminRecentActivity[] }) {
  const [tab, setTab] = useState<'all' | 'users' | 'roles' | 'admin' | 'security'>('all');
  const filtered = filterActivitiesByTab(activities, tab);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Recent activity</h2>
          <p className="text-xs text-gray-400">Latest audit log events</p>
        </div>
        <Link
          href="/dashboard/admin/audit-logs"
          className="text-xs font-medium text-emerald-600 hover:underline"
        >
          View all
        </Link>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 h-8">
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs">
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">
            Roles
          </TabsTrigger>
          <TabsTrigger value="admin" className="text-xs">
            Admin
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs">
            Security
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-3 flex-1">
        <ActivityList items={filtered} />
      </div>
    </div>
  );
}

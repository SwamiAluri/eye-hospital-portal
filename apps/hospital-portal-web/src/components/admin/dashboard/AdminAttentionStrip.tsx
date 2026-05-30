'use client';

import Link from 'next/link';
import { AlertCircle, Key, FileWarning, Users } from 'lucide-react';
import type { AdminAlert } from '@/lib/admin/map-admin-dashboard';

export function AdminAttentionStrip({
  alerts,
  expiringLicenses,
}: {
  alerts: AdminAlert[];
  expiringLicenses?: number;
}) {
  const errorAlerts = alerts.filter((a) => a.severity === 'error').length;
  const warningAlerts = alerts.filter((a) => a.severity === 'warning').length;

  const items = [
    {
      label: 'Critical alerts',
      count: errorAlerts,
      href: '/dashboard/admin/audit-logs',
      icon: AlertCircle,
      show: errorAlerts > 0,
      color: 'bg-red-50 text-red-700 border-red-100',
    },
    {
      label: 'Warnings',
      count: warningAlerts,
      href: '/dashboard/admin/audit-logs',
      icon: FileWarning,
      show: warningAlerts > 0,
      color: 'bg-amber-50 text-amber-800 border-amber-100',
    },
    {
      label: 'Licenses expiring',
      count: expiringLicenses ?? 0,
      href: '/dashboard/admin/licenses',
      icon: Key,
      show: (expiringLicenses ?? 0) > 0,
      color: 'bg-violet-50 text-violet-800 border-violet-100',
    },
    {
      label: 'Access requests',
      count: 0,
      href: '/dashboard/admin/access-requests',
      icon: Users,
      show: false,
      color: 'bg-sky-50 text-sky-800 border-sky-100',
    },
  ].filter((i) => i.show);

  if (items.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border flex-shrink-0 text-sm font-medium ${item.color}`}
        >
          <item.icon className="w-4 h-4" />
          <span>
            {item.count} {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

'use client';

import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminAlert } from '@/lib/admin/map-admin-dashboard';
import Link from 'next/link';

const severityStyles = {
  info: 'bg-sky-50 border-sky-100 text-sky-900',
  warning: 'bg-amber-50 border-amber-100 text-amber-900',
  error: 'bg-red-50 border-red-100 text-red-900',
};

export function AdminAlertsPanel({
  alerts,
  onDismiss,
}: {
  alerts: AdminAlert[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">System alerts</h2>
          <p className="text-xs text-gray-400">Notifications requiring attention</p>
        </div>
        <Link
          href="/dashboard/admin/audit-logs"
          className="text-xs font-medium text-emerald-600 hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto max-h-80">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Bell className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-3 ${severityStyles[alert.severity]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{alert.title}</p>
                  {alert.description && (
                    <p className="text-xs mt-1 opacity-90 line-clamp-2">{alert.description}</p>
                  )}
                  <p className="text-[10px] mt-2 opacity-70">{alert.relativeTime}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => onDismiss(alert.id)}
                  aria-label="Dismiss alert"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SystemHealthLevel } from '@/lib/admin/map-admin-dashboard';

const healthConfig: Record<
  SystemHealthLevel,
  { icon: typeof CheckCircle2; className: string }
> = {
  healthy: { icon: CheckCircle2, className: 'text-emerald-600' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  critical: { icon: XCircle, className: 'text-red-500' },
};

export function AdminDashboardHeader({
  healthLabel,
  healthLevel,
  onRefresh,
  refreshing,
}: {
  healthLabel: string;
  healthLevel: SystemHealthLevel;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const cfg = healthConfig[healthLevel] ?? { icon: Activity, className: 'text-gray-500' };
  const HealthIcon = cfg.icon;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 bg-white border-b border-gray-200">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] text-gray-400 font-medium">Administration</span>
          <span className="text-gray-300">/</span>
          <span className="text-[11px] text-gray-600 font-semibold">Overview</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Hospital Command Center</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          System overview ·{' '}
          {new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${cfg.className}`}>
          <HealthIcon className="h-4 w-4" />
          <span>System {healthLabel}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}

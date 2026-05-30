'use client';

import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULE_SNAPSHOT_CONFIGS, type ModuleSnapshot } from '@/lib/admin/module-snapshot-config';
import { AdminModuleWidget } from './AdminModuleWidget';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/auth-store';

async function fetchModuleSnapshots(token: string | null, tenantId: string | null): Promise<ModuleSnapshot[]> {
  const res = await fetch('/api/admin/command-center/snapshots', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function AdminModuleGrid() {
  const { hasPermission } = usePermissions();
  const token = useAuthStore((s) => s.token);
  const tenantId = useAuthStore((s) => s.tenantId);

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['admin-dashboard', 'module-snapshots', tenantId],
    queryFn: () => fetchModuleSnapshots(token, tenantId),
    staleTime: 120_000,
    enabled: !!token,
  });

  const allowedIds = new Set(
    MODULE_SNAPSHOT_CONFIGS.filter(
      (c) => !c.permission || hasPermission(c.permission),
    ).map((c) => c.moduleId),
  );

  const visible = snapshots.filter((s) => allowedIds.has(s.moduleId));

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No module snapshots available for your permissions.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">Module snapshots</h2>
        <p className="text-xs text-gray-400">Cross-module operational pulse</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((snapshot) => (
          <AdminModuleWidget key={snapshot.moduleId} snapshot={snapshot} />
        ))}
      </div>
    </div>
  );
}

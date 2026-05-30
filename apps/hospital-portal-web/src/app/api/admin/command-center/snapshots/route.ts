import { NextRequest, NextResponse } from 'next/server';
import { adminDashboardUrl, getAuthServiceBase } from '@/lib/admin/admin-dashboard-bff';
import { MODULE_SNAPSHOT_CONFIGS, type ModuleSnapshot } from '@/lib/admin/module-snapshot-config';

const CCMS_BASE = process.env.NEXT_PUBLIC_CCMS_API_URL || 'http://localhost:7075/api';

function authHeaders(req: NextRequest): HeadersInit {
  const auth = req.headers.get('authorization') ?? '';
  const tenant = req.headers.get('x-tenant-id') ?? req.headers.get('X-Tenant-ID') ?? '';
  return {
    Authorization: auth,
    'Content-Type': 'application/json',
    ...(tenant ? { 'X-Tenant-ID': tenant } : {}),
  };
}

async function safeJson<T>(url: string, headers: HeadersInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const headers = authHeaders(req);
  const now = new Date().toISOString();

  const [overview, quickStats, ccmsSummary, apptStats, expiringLicenses] = await Promise.all([
    safeJson<Record<string, unknown>>(adminDashboardUrl('/overview'), headers),
    safeJson<Record<string, unknown>>(adminDashboardUrl('/quick-stats'), headers),
    safeJson<{
      totalActiveCases?: number;
      pendingPreAuths?: number;
      pendingClaims?: number;
      pendingSettlements?: number;
    }>(`${CCMS_BASE}/ccms/dashboard/summary`, headers),
    safeJson<{ todayCount?: number; totalToday?: number }>(
      `${getAuthServiceBase()}/api/appointments/stats`,
      headers,
    ),
    safeJson<unknown[]>(`${getAuthServiceBase()}/api/license/expiring?days=30`, headers),
  ]);

  const activeUsers = Number(overview?.activeUsers ?? 0);
  const totalDepts = Number(overview?.totalDepartments ?? 0);
  const compliancePct = Number(
    (quickStats?.complianceStatus as Record<string, unknown>)?.compliancePercentage ?? 0,
  );
  const licenseCount = Array.isArray(expiringLicenses) ? expiringLicenses.length : 0;
  const apptToday = Number(apptStats?.todayCount ?? apptStats?.totalToday ?? 0);

  const snapshots: ModuleSnapshot[] = MODULE_SNAPSHOT_CONFIGS.map((cfg) => {
    const base = { moduleId: cfg.moduleId, label: cfg.label, href: cfg.href, lastUpdated: now };

    switch (cfg.moduleId) {
      case 'iam':
        return {
          ...base,
          metrics: [
            { label: 'Active users', value: activeUsers },
            { label: 'Departments', value: totalDepts },
            { label: 'Branches', value: Number(overview?.totalBranches ?? 0) },
          ],
        };
      case 'security':
        return {
          ...base,
          metrics: [
            {
              label: 'Compliance',
              value: `${compliancePct.toFixed(0)}%`,
              severity: compliancePct >= 95 ? 'ok' : 'warn',
            },
            { label: '24h audit events', value: Number(overview?.last24HoursActivity ?? 0) },
          ],
        };
      case 'ccms':
        return {
          ...base,
          metrics: ccmsSummary
            ? [
                { label: 'Active cases', value: ccmsSummary.totalActiveCases ?? 0 },
                {
                  label: 'Pending pre-auth',
                  value: ccmsSummary.pendingPreAuths ?? 0,
                  severity: (ccmsSummary.pendingPreAuths ?? 0) > 5 ? 'warn' : 'ok',
                },
                { label: 'Pending claims', value: ccmsSummary.pendingClaims ?? 0 },
              ]
            : [
                { label: 'Active cases', value: '—' },
                { label: 'Status', value: 'Unavailable' },
              ],
        };
      case 'opd':
        return {
          ...base,
          metrics: [
            { label: "Today's appointments", value: apptToday },
            { label: 'Queue', value: 'View desk' },
          ],
        };
      case 'hr':
        return {
          ...base,
          metrics: [
            { label: 'Active users', value: activeUsers },
            {
              label: 'Licenses expiring',
              value: licenseCount,
              severity: licenseCount > 0 ? 'warn' : 'ok',
            },
          ],
        };
      case 'compliance':
        return {
          ...base,
          metrics: [
            {
              label: 'Score',
              value: `${compliancePct.toFixed(1)}%`,
              severity: compliancePct >= 95 ? 'ok' : 'critical',
            },
            {
              label: 'Status',
              value: String(
                (quickStats?.complianceStatus as Record<string, unknown>)?.status ?? '—',
              ),
            },
          ],
        };
      default:
        return {
          ...base,
          metrics: [{ label: 'Status', value: 'Open module' }],
        };
    }
  });

  return NextResponse.json(snapshots);
}

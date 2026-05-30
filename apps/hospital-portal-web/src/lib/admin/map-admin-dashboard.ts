import { formatDistanceToNow } from 'date-fns';

export type SystemHealthLevel = 'healthy' | 'warning' | 'critical';

export interface AdminOverviewStats {
  totalTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalDepartments: number;
  totalBranches: number;
  tenantGrowth: number;
  userGrowth: number;
  departmentGrowth: number;
  branchGrowth: number;
  systemHealth: SystemHealthLevel;
  systemHealthLabel: string;
  last24HourActivities: number;
}

export interface AdminQuickStats {
  userGrowthThisMonth: number;
  userGrowthLastMonth: number;
  userGrowthPercentage: number;
  activeDepartments: number;
  departmentUtilizationRate: number;
  compliancePercentage: number;
  complianceStatus: string;
  responseTimeMs: number;
  performanceStatus: string;
}

export type ActivityCategory = 'registration' | 'role_assignment' | 'permission_change' | 'admin_action' | 'security' | 'other';

export interface AdminRecentActivity {
  id: string;
  category: ActivityCategory;
  description: string;
  user: string;
  timestamp: string;
  relativeTime: string;
  entityType: string;
  action: string;
}

export type AlertSeverity = 'info' | 'warning' | 'error';

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  relativeTime: string;
  type: string;
}

export interface ActivitySeriesPoint {
  hour: string;
  count: number;
}

export interface AdminDashboardStats {
  totalStaff: number;
  totalDepartments: number;
  totalRoles: number;
  totalBranches: number;
  departmentStats: { departmentName: string; staffCount: number }[];
  roleStats: { name: string; userCount: number }[];
}

function mapSystemHealth(raw: string | undefined): { level: SystemHealthLevel; label: string } {
  const v = (raw ?? '').toLowerCase();
  if (v === 'fair' || v === 'warning') return { level: 'warning', label: raw ?? 'Fair' };
  if (v === 'critical' || v === 'poor') return { level: 'critical', label: raw ?? 'Critical' };
  if (v === 'excellent' || v === 'healthy' || v === 'good') {
    return { level: 'healthy', label: raw ?? 'Excellent' };
  }
  return { level: 'healthy', label: raw ?? 'Excellent' };
}

export function mapOverviewStats(raw: Record<string, unknown> | null | undefined): AdminOverviewStats {
  if (!raw) {
    return {
      totalTenants: 0,
      totalUsers: 0,
      activeUsers: 0,
      totalDepartments: 0,
      totalBranches: 0,
      tenantGrowth: 0,
      userGrowth: 0,
      departmentGrowth: 0,
      branchGrowth: 0,
      systemHealth: 'healthy',
      systemHealthLabel: 'Excellent',
      last24HourActivities: 0,
    };
  }

  const health = mapSystemHealth(String(raw.systemHealth ?? ''));
  const totalUsers = Number(raw.totalUsers ?? raw.activeUsers ?? 0);
  const activeUsers = Number(raw.activeUsers ?? totalUsers);

  return {
    totalTenants: Number(raw.totalTenants ?? 0),
    totalUsers,
    activeUsers,
    totalDepartments: Number(raw.totalDepartments ?? 0),
    totalBranches: Number(raw.totalBranches ?? 0),
    tenantGrowth: Number(raw.tenantGrowth ?? 0),
    userGrowth: Number(raw.userGrowth ?? 0),
    departmentGrowth: Number(raw.departmentGrowth ?? 0),
    branchGrowth: Number(raw.branchGrowth ?? 0),
    systemHealth: health.level,
    systemHealthLabel: health.label,
    last24HourActivities: Number(raw.last24HoursActivity ?? raw.last24HourActivities ?? 0),
  };
}

export function mapQuickStats(raw: Record<string, unknown> | null | undefined): AdminQuickStats {
  if (!raw) {
    return {
      userGrowthThisMonth: 0,
      userGrowthLastMonth: 0,
      userGrowthPercentage: 0,
      activeDepartments: 0,
      departmentUtilizationRate: 0,
      compliancePercentage: 0,
      complianceStatus: 'Unknown',
      responseTimeMs: 0,
      performanceStatus: 'Unknown',
    };
  }

  const userGrowth = (raw.userGrowth ?? {}) as Record<string, unknown>;
  const deptOps = (raw.departmentOperations ?? {}) as Record<string, unknown>;
  const compliance = (raw.complianceStatus ?? {}) as Record<string, unknown>;
  const perf = (raw.systemPerformance ?? {}) as Record<string, unknown>;

  return {
    userGrowthThisMonth: Number(userGrowth.thisMonth ?? raw.userGrowthThisMonth ?? 0),
    userGrowthLastMonth: Number(userGrowth.lastMonth ?? 0),
    userGrowthPercentage: Number(userGrowth.percentageChange ?? raw.userGrowthPercentage ?? 0),
    activeDepartments: Number(deptOps.activeDepartments ?? 0),
    departmentUtilizationRate: Number(deptOps.utilizationRate ?? 0),
    compliancePercentage: Number(compliance.compliancePercentage ?? 0),
    complianceStatus: String(compliance.status ?? 'Unknown'),
    responseTimeMs: Number(perf.responseTimeMs ?? 0),
    performanceStatus: String(perf.status ?? 'Unknown'),
  };
}

function inferActivityCategory(entityType: string, action: string): ActivityCategory {
  const et = entityType.toLowerCase();
  const act = action.toLowerCase();
  if (et.includes('user') || act.includes('login') || act.includes('logout') || act.includes('register')) {
    return act.includes('role') ? 'role_assignment' : 'registration';
  }
  if (et.includes('role') || act.includes('role')) return 'role_assignment';
  if (et.includes('permission') || act.includes('permission')) return 'permission_change';
  if (act.includes('security') || act.includes('failed')) return 'security';
  if (et.includes('tenant') || et.includes('branch') || et.includes('department') || et.includes('setting')) {
    return 'admin_action';
  }
  return 'other';
}

export function formatActivityDescription(
  action: string,
  entityType: string,
  description?: string,
): string {
  if (description && !description.match(/^[\w_]+ on \w+$/i)) {
    return description;
  }
  const act = action.replace(/_/g, ' ').toLowerCase();
  const entity = entityType.replace(/_/g, ' ').toLowerCase();
  return `${act.charAt(0).toUpperCase() + act.slice(1)} — ${entity}`;
}

export function mapRecentActivities(raw: unknown[] | null | undefined): AdminRecentActivity[] {
  if (!raw?.length) return [];

  return raw.map((item) => {
    const a = item as Record<string, unknown>;
    const action = String(a.action ?? '');
    const entityType = String(a.entityType ?? 'System');
    const ts = String(a.timestamp ?? a.createdAt ?? new Date().toISOString());
    const date = new Date(ts);

    return {
      id: String(a.id ?? `${Date.now()}-${Math.random()}`),
      category: inferActivityCategory(entityType, action),
      description: formatActivityDescription(action, entityType, String(a.description ?? '')),
      user: String(a.userName ?? a.user ?? 'System'),
      timestamp: ts,
      relativeTime: Number.isNaN(date.getTime()) ? ts : formatDistanceToNow(date, { addSuffix: true }),
      entityType,
      action,
    };
  });
}

export function mapAlerts(raw: unknown[] | null | undefined): AdminAlert[] {
  if (!raw?.length) return [];

  return raw.map((item) => {
    const a = item as Record<string, unknown>;
    const ts = String(a.createdAt ?? a.timestamp ?? new Date().toISOString());
    const date = new Date(ts);
    const sev = String(a.severity ?? 'info').toLowerCase();
    const severity: AlertSeverity =
      sev === 'error' || sev === 'critical' ? 'error' : sev === 'warning' ? 'warning' : 'info';

    return {
      id: String(a.id ?? `${Date.now()}-${Math.random()}`),
      title: String(a.title ?? 'Alert'),
      description: String(a.message ?? a.description ?? ''),
      severity,
      timestamp: ts,
      relativeTime: Number.isNaN(date.getTime()) ? ts : formatDistanceToNow(date, { addSuffix: true }),
      type: String(a.type ?? severity),
    };
  });
}

export function mapActivitySeries(raw: unknown[] | null | undefined): ActivitySeriesPoint[] {
  if (!raw?.length) return [];
  return raw.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      hour: String(p.hour ?? p.label ?? ''),
      count: Number(p.count ?? 0),
    };
  });
}

export function mapDashboardStats(raw: Record<string, unknown> | null | undefined): AdminDashboardStats {
  if (!raw) {
    return {
      totalStaff: 0,
      totalDepartments: 0,
      totalRoles: 0,
      totalBranches: 0,
      departmentStats: [],
      roleStats: [],
    };
  }

  const deptStats = (raw.departmentStats ?? []) as Record<string, unknown>[];
  const roleStats = (raw.roleStats ?? []) as Record<string, unknown>[];

  return {
    totalStaff: Number(raw.totalStaff ?? 0),
    totalDepartments: Number(raw.totalDepartments ?? 0),
    totalRoles: Number(raw.totalRoles ?? 0),
    totalBranches: Number(raw.totalBranches ?? 0),
    departmentStats: deptStats.map((d) => ({
      departmentName: String(d.departmentName ?? d.name ?? ''),
      staffCount: Number(d.staffCount ?? 0),
    })),
    roleStats: roleStats.map((r) => ({
      name: String(r.name ?? ''),
      userCount: Number(r.userCount ?? 0),
    })),
  };
}

export function filterActivitiesByTab(
  activities: AdminRecentActivity[],
  tab: 'all' | 'users' | 'roles' | 'admin' | 'security',
): AdminRecentActivity[] {
  switch (tab) {
    case 'users':
      return activities.filter((a) => a.category === 'registration');
    case 'roles':
      return activities.filter((a) =>
        ['role_assignment', 'permission_change'].includes(a.category),
      );
    case 'admin':
      return activities.filter((a) => a.category === 'admin_action');
    case 'security':
      return activities.filter((a) => a.category === 'security');
    default:
      return activities;
  }
}

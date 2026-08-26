import { permissionsFailOpen } from '@/lib/permissions-fail-open';

export type BillingDashboardAccess = 'full' | 'finance' | 'ward' | 'doctor';

const FULL_ROLES = [
  'admin', 'superadmin', 'tenantadmin', 'administrator',
  'billing', 'billingexecutive', 'cashier', 'billing executive',
];
const FINANCE_ROLES = ['finance', 'financemanager', 'accountant', 'finance manager'];
const WARD_ROLES = ['nurse', 'ward', 'nursing', 'wardincharge', 'ward incharge'];
const DOCTOR_ROLES = ['doctor', 'consultant', 'surgeon'];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function hasAny(haystack: string[], needles: string[]): boolean {
  const set = new Set(haystack.map(norm));
  return needles.some(n => set.has(norm(n)));
}

/**
 * Clinical roles must not see full ledgers. Unmatched named roles default to doctor
 * (patient-relevant amounts only), not full finance. A caller we know nothing about
 * — no roles and no permissions — gets `ward`, the narrowest scope, which hides every
 * amount column and shows only patients with an outstanding balance.
 */
export function resolveBillingDashboardAccess(input: {
  roles?: string[] | null;
  userType?: string | null;
  permissions?: string[] | null;
}): BillingDashboardAccess {
  const roles = input.roles ?? [];
  const perms = (input.permissions ?? []).map(p => p.toLowerCase());
  const userType = (input.userType ?? '').toLowerCase();

  if (hasAny(roles, FULL_ROLES) || userType.includes('admin')) return 'full';
  if (perms.some(p => p.includes('billing') && !p.includes('view-own'))) return 'full';

  if (hasAny(roles, FINANCE_ROLES) || userType.includes('finance')) return 'finance';
  if (perms.some(p => p.includes('finance') || p.includes('reconcil'))) return 'finance';

  if (hasAny(roles, WARD_ROLES) || userType.includes('nurse') || userType.includes('ward')) return 'ward';
  if (hasAny(roles, DOCTOR_ROLES) || userType.includes('doctor')) return 'doctor';

  if (roles.length === 0 && perms.length === 0) {
    return permissionsFailOpen() ? 'full' : 'ward';
  }
  return 'doctor';
}

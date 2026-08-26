import { IP_ROLE_PERMISSIONS } from './ip-role-actions';

export type IpPersona = 'ward' | 'coordinator' | 'cashier' | 'clinical' | 'admin';

export type RailSection =
  | 'status'
  | 'location'
  | 'blockers'
  | 'overrides'
  | 'money'
  | 'coverage'
  | 'receipts'
  | 'activity';

const COORDINATOR_ROLES = [
  'IP COORDINATOR',
  'OT COORDINATOR',
  'COUNSELLOR',
  'COUNSELOR',
  'TPA EXECUTIVE',
];

const CASHIER_ROLES = ['CASHIER', 'BILLING CLERK'];
const CLINICAL_ROLES = ['SURGEON', 'DOCTOR', 'CONSULTANT'];
const WARD_ROLES = ['NURSE', 'OT NURSE', 'WARD INCHARGE', 'WARD IN-CHARGE'];
const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN', 'TENANTADMIN', 'ADMINISTRATOR', 'FINANCE'];

function normRole(value: string): string {
  return value.trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function has(permissions: string[], code: string): boolean {
  return permissions.includes('*') || permissions.includes(code);
}

function hasAny(permissions: string[], codes: string[]): boolean {
  return codes.some(c => has(permissions, c));
}

function hasRole(roles: string[], names: string[]): boolean {
  const set = new Set(roles.map(normRole));
  return names.some(n => set.has(n));
}

/**
 * Emphasis-only persona for the census rail. Not a security boundary —
 * `resolveIpRoleActions` and the server still decide what can run.
 *
 * Permission codes win; role strings fill in when the permission signature
 * is ambiguous (ward vs coordinator share clinical codes).
 */
export function resolveIpPersona(
  permissions: string[] | null | undefined,
  roles: string[] | null | undefined,
): IpPersona {
  const perms = permissions ?? [];
  const roleList = roles ?? [];

  if (perms.includes('*') || hasRole(roleList, ADMIN_ROLES)) return 'admin';

  const money = hasAny(perms, [
    IP_ROLE_PERMISSIONS.billing,
    IP_ROLE_PERMISSIONS.billUpdate,
    'bill.create',
  ]);
  const wardMutate = hasAny(perms, [
    IP_ROLE_PERMISSIONS.admit,
    IP_ROLE_PERMISSIONS.readyForOt,
    IP_ROLE_PERMISSIONS.sendToOt,
    IP_ROLE_PERMISSIONS.discharge,
    IP_ROLE_PERMISSIONS.wardEdit,
  ]);
  const otClinical = hasAny(perms, [
    IP_ROLE_PERMISSIONS.surgeryStart,
    IP_ROLE_PERMISSIONS.surgeryComplete,
    IP_ROLE_PERMISSIONS.acceptOt,
    IP_ROLE_PERMISSIONS.otSign,
  ]);
  const supervisor = hasAny(perms, [
    IP_ROLE_PERMISSIONS.dischargeOverride,
    'bill.admin',
    'ip.emergency_fc.apply',
  ]);

  if (money && !wardMutate && !otClinical) return 'cashier';
  if (hasRole(roleList, CASHIER_ROLES) && !wardMutate) return 'cashier';

  if (otClinical && !wardMutate) return 'clinical';
  if (hasRole(roleList, CLINICAL_ROLES) && !wardMutate) return 'clinical';

  if (supervisor) return 'admin';

  if (wardMutate || hasRole(roleList, WARD_ROLES) || hasRole(roleList, COORDINATOR_ROLES)) {
    if (hasRole(roleList, COORDINATOR_ROLES)) return 'coordinator';
    if (hasRole(roleList, WARD_ROLES)) return 'ward';
    // Clinical-ops codes with no distinguishing role: ward is the working default.
    return 'ward';
  }

  if (hasRole(roleList, COORDINATOR_ROLES)) return 'coordinator';
  if (has(perms, 'ip.view') || has(perms, 'ip_management.view')) return 'coordinator';

  return 'coordinator';
}

/** Section order and visibility. Footer (primary + open record) is always pinned. */
export function railSectionsForPersona(persona: IpPersona): RailSection[] {
  switch (persona) {
    case 'cashier':
      return ['status', 'money', 'coverage', 'receipts', 'location', 'activity'];
    case 'clinical':
      return ['status', 'location', 'blockers', 'activity'];
    case 'admin':
      return ['status', 'location', 'blockers', 'overrides', 'money', 'receipts', 'activity'];
    case 'ward':
    case 'coordinator':
    default:
      return ['status', 'location', 'blockers', 'money', 'coverage', 'activity'];
  }
}

export function personaHidesAlertStrip(persona: IpPersona): boolean {
  return persona === 'cashier';
}

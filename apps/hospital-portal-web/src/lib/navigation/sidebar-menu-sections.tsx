'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  Stethoscope,
  UserCircle,
  Pill,
  TestTube,
  Bell,
  FileText,
  Star,
  ArrowRightLeft,
  Ambulance,
  Settings,
  Shield,
  Building,
  Building2,
  Briefcase,
  UserCheck,
  FileCheck,
  Smartphone,
  Key,
  AlertTriangle,
  ClipboardList,
  DollarSign,
  TrendingUp,
  GraduationCap,
  BarChart,
  FolderOpen,
  Upload,
  Activity,
  LogIn,
  Eye,
  Glasses,
  Zap,
  Target,
  Layers,
  Droplet,
  Palette,
  Grid,
  Circle,
  ShoppingCart,
  Contact,
  Brain,
  Truck,
  Package,
  Thermometer,
  Wrench,
  Tent,
  CreditCard,
  Receipt,
  Camera,
  Video,
  Waves,
  UserPlus,
  Monitor,
  Siren,
  PhoneCall,
  RotateCcw,
  Database,
  MapPin,
  Link2,
  Scale,
} from 'lucide-react';

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission: string | null;
  /**
   * When true and requiredPermission is null, item is visible to any authenticated user.
   * Operational modules must NOT rely on null alone (PD-NAV-01).
   */
  allowAuthenticated?: boolean;
  isSection?: boolean;
  isParent?: boolean;
  isChild?: boolean;
  isExpandable?: boolean;
  exact?: boolean;
  badge?: ReactNode;
  subItems?: MenuItem[];
}

interface MenuSection {
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
}

/**
 * Filters sidebar sections by permission (PD-NAV-01).
 * - Admin wildcard `*`: preserves prior behavior (null = visible).
 * - Non-admin: null without allowAuthenticated is hidden (not all-authenticated).
 * - requiredPermission set: hasPermission(code).
 */
export function filterSidebarSectionsByPermission(
  sections: MenuSection[],
  hasPermission: (permissionCode: string) => boolean,
): MenuSection[] {
  const isAdminWildcard = hasPermission('*');

  const itemVisible = (item: MenuItem): boolean => {
    if (item.requiredPermission) {
      return hasPermission(item.requiredPermission);
    }
    if (isAdminWildcard) {
      return true;
    }
    return item.allowAuthenticated === true;
  };

  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(itemVisible),
    }))
    .filter(section => section.items.length > 0);
}

export const SIDEBAR_MENU_SECTIONS: MenuSection[] = [

    // ── 1. DASHBOARD ──────────────────────────────────────────────────────────
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        {
          label: 'Overview',
          href: '/dashboard',
          icon: LayoutDashboard,
          requiredPermission: null,
          exact: true,
        },
      ],
    },

    // ── 2. OPD & REGISTRATION ─────────────────────────────────────────────────
    {
      title: 'OPD & Registration',
      icon: Contact,
      items: [
        {
          label: 'Front Office / OPD',
          href: '/dashboard/frontdesk',
          icon: Contact,
          requiredPermission: null,
        },
        {
          label: 'Queue Management',
          href: '/dashboard/frontdesk/queue',
          icon: ClipboardList,
          requiredPermission: 'queue_management.view',
        },
        {
          label: 'Queue TV Display',
          href: '/dashboard/frontdesk/queue-display?mode=branch&interval=10',
          icon: Monitor,
          requiredPermission: null,
        },
        {
          label: 'Appointments',
          href: '/dashboard/appointments',
          icon: Calendar,
          requiredPermission: 'appointment.view',
        },
        {
          label: 'Patient Portal',
          href: '/dashboard/patient-portal',
          icon: Smartphone,
          requiredPermission: 'patient_portal.view',
        },
        {
          label: 'Eye Camps',
          href: '/dashboard/operations/eye-camps',
          icon: Tent,
          requiredPermission: 'OPERATIONS:EYECAMP:VIEW',
        },
      ],
    },

    // ── 3. DOCTOR'S DESK ──────────────────────────────────────────────────────
    {
      title: "Doctor's Desk",
      icon: Stethoscope,
      items: [
        {
          label: 'Patient Directory',
          href: '/dashboard/patients',
          icon: Users,
          requiredPermission: 'patient.view',
        },
        {
          label: "Doctor's Desk",
          href: '/dashboard/doctors-desk',
          icon: Stethoscope,
          requiredPermission: 'CLINICAL:EXAMINATION:VIEW',
        },
        {
          label: 'Junior Doctor',
          href: '/dashboard/examinations',
          icon: UserCheck,
          requiredPermission: 'clinical_examination.view',
        },
        {
          label: 'Advanced Services',
          href: '/dashboard/telemedicine',
          icon: Star,
          requiredPermission: null,
        },
      ],
    },

    // ── 4. OPTOMETRY ──────────────────────────────────────────────────────────
    {
      title: 'Optometry',
      icon: Eye,
      items: [
        {
          label: 'Optometrist Examination',
          href: '/dashboard/optometrist',
          icon: Eye,
          requiredPermission: 'CLINICAL:EXAMINATION:VIEW',
        },
      ],
    },

    // ── 5. COUNSELLOR ─────────────────────────────────────────────────────────
    {
      title: 'Counsellor',
      icon: Brain,
      items: [
        {
          label: 'Counsellor Waiting List',
          href: '/dashboard/counsellors-desk/waiting-list',
          icon: ClipboardList,
          requiredPermission: 'counseling_sessions.read',
        },
        {
          label: 'Finalize Surgery',
          href: '/dashboard/counsellors-desk/finalize-surgery',
          icon: FileCheck,
          requiredPermission: 'counseling_sessions.read',
        },
        {
          label: 'Follow-up Center',
          href: '/dashboard/counsellors-desk/surgery-followup',
          icon: PhoneCall,
          requiredPermission: 'counseling_sessions.read',
        },
        {
          label: 'Analytics',
          href: '/dashboard/counselor/analytics',
          icon: BarChart,
          requiredPermission: 'counseling_sessions.read',
        },
      ],
    },

    // ── CCMS – COVERAGE & CLAIMS MANAGEMENT ──────────────────────────────────
    {
      title: 'Coverage & Claims',
      icon: FileCheck,
      items: [
        {
          label: 'CCMS Dashboard',
          href: '/dashboard/ccms',
          icon: FileCheck,
          requiredPermission: 'ccms.coverage_case.read',
        },
        {
          label: 'Cases',
          href: '/dashboard/ccms/cases',
          icon: FileCheck,
          requiredPermission: 'ccms.coverage_case.read',
        },
        {
          label: 'Authorization Queue',
          href: '/dashboard/ccms/authorization',
          icon: FileCheck,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Claims',
          href: '/dashboard/ccms/claims',
          icon: FileCheck,
          requiredPermission: 'ccms.claim.read',
        },
        {
          label: 'Enhancements',
          href: '/dashboard/ccms/enhancements',
          icon: TrendingUp,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Settlements',
          href: '/dashboard/ccms/settlement',
          icon: FileCheck,
          requiredPermission: 'ccms.settlement.read',
        },
        {
          label: 'Pre-Auth Queue (Ops)',
          href: '/dashboard/ccms/operations/preauth',
          icon: FileCheck,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Settlement Desk',
          href: '/dashboard/ccms/operations/settlement',
          icon: FileCheck,
          requiredPermission: 'ccms.settlement.read',
        },
        {
          label: 'Payers / TPA',
          href: '/dashboard/ccms/master-data/payers',
          icon: FileCheck,
          requiredPermission: 'ccms.master_data.read',
        },
        {
          label: 'Analytics',
          href: '/dashboard/ccms/analytics',
          icon: BarChart,
          requiredPermission: 'ccms.report.dashboard',
        },
        {
          label: 'CCMS Settings',
          href: '/dashboard/ccms/settings',
          icon: Settings,
          requiredPermission: 'ccms.workflow.admin',
        },
      ],
    },

    // ── 6. WARD & INPATIENT ───────────────────────────────────────────────────
    {
      title: 'Ward & Inpatient',
      icon: Tent,
      items: [
        {
          label: 'Ward',
          href: '/dashboard/ip-management/ward',
          icon: Tent,
          requiredPermission: 'ward.checklist.edit',
        },
        {
          label: 'IP Management',
          href: '/dashboard/ip-management',
          icon: CreditCard,
          requiredPermission: 'ip_management.view',
          exact: true,
        },
        {
          label: 'Slot board',
          href: '/dashboard/ip-management/slots',
          icon: CalendarDays,
          requiredPermission: 'ip_management.view',
        },
        {
          label: 'Slot throughput',
          href: '/dashboard/ip-management/throughput',
          icon: BarChart,
          requiredPermission: 'ip_management.view',
        },
        ...(process.env.NODE_ENV === 'development'
          ? [{
              label: 'UAT Data',
              href: '/dashboard/dev/uat',
              icon: Layers,
              requiredPermission: 'ip_management.view' as string | null,
            }]
          : []),
        {
          label: 'Operation Theatre',
          href: '/dashboard/ip-management/operation-theatre',
          icon: Activity,
          requiredPermission: 'ot.safety.sign',
        },
      ],
    },

    // ── 7. DIAGNOSTICS & LAB ──────────────────────────────────────────────────
    {
      title: 'Diagnostics & Lab',
      icon: TestTube,
      items: [
        {
          label: 'Scan / Imaging',
          href: '/dashboard/diagnostic/fundus-imaging',
          icon: Camera,
          requiredPermission: 'DIAGNOSTIC:IMAGING:VIEW',
        },
        {
          label: 'Diagnostics Lab',
          href: '/dashboard/diagnostic/biometry',
          icon: TestTube,
          requiredPermission: 'DIAGNOSTIC:BIOMETRY:VIEW',
        },
        {
          label: 'Laboratory (Pathology)',
          href: '/dashboard/laboratory',
          icon: Thermometer,
          requiredPermission: 'laboratory.view',
        },
        {
          label: 'Blood Bank',
          href: '/dashboard/operations/ambulance',
          icon: Droplet,
          requiredPermission: 'OPERATIONS:AMBULANCE:VIEW',
        },
      ],
    },

    // ── 8. PHARMACY ───────────────────────────────────────────────────────────
    {
      title: 'Pharmacy',
      icon: Pill,
      items: [
        {
          label: 'Pharmacy',
          href: '/dashboard/pharmacy',
          icon: Pill,
          requiredPermission: 'pharmacy.view',
        },
        {
          label: 'Pharmacy Bills',
          href: '/admin/inventory/pharmacy',
          icon: Receipt,
          requiredPermission: 'pharmacy.view',
        },
      ],
    },

    // ── 9. OPTICAL SHOP ───────────────────────────────────────────────────────
    {
      title: 'Optical Shop',
      icon: Glasses,
      items: [
        {
          label: 'Optical Shop',
          href: '/dashboard/optical',
          icon: Glasses,
          requiredPermission: 'OPTICAL:VIEW',
        },
      ],
    },

    // ── 10. INVENTORY ─────────────────────────────────────────────────────────
    {
      title: 'Inventory',
      icon: Package,
      items: [
        {
          label: 'Dashboard',
          href: '/admin/inventory',
          icon: LayoutDashboard,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
          exact: true,
        },
        {
          label: 'Items',
          href: '/admin/inventory/items',
          icon: Grid,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Stores',
          href: '/admin/inventory/stores',
          icon: Building,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Stock',
          href: '/admin/inventory/stock',
          icon: Layers,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Transfers',
          href: '/admin/inventory/transfers',
          icon: ArrowRightLeft,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Requisitions',
          href: '/admin/inventory/requisitions',
          icon: ClipboardList,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Auto-Reorder',
          href: '/admin/inventory/reorder',
          icon: Bell,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Expiry Alerts',
          href: '/admin/inventory/expiry',
          icon: AlertTriangle,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Surgery OT',
          href: '/admin/inventory/surgery',
          icon: Activity,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Asset Management',
          href: '/dashboard/operations/biomedical',
          icon: Wrench,
          requiredPermission: 'OPERATIONS:BIOMEDICAL:VIEW',
        },
      ],
    },

    // ── 11. PROCUREMENT ───────────────────────────────────────────────────────
    {
      title: 'Procurement',
      icon: Truck,
      items: [
        {
          label: 'Vendors',
          href: '/admin/inventory/vendors',
          icon: Truck,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'GRN',
          href: '/admin/inventory/grn',
          icon: Package,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Orders',
          href: '/admin/inventory/po',
          icon: ShoppingCart,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'RFQ',
          href: '/admin/inventory/rfq',
          icon: FileText,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Query',
          href: '/admin/inventory/purchase-query',
          icon: ClipboardList,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Vendor Payments',
          href: '/admin/inventory/vendor-payments',
          icon: CreditCard,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Returns',
          href: '/admin/inventory/returns',
          icon: RotateCcw,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Procurement Policy',
          href: '/admin/inventory/procurement/policies',
          icon: Shield,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Vendor Performance',
          href: '/admin/inventory/vendor-performance',
          icon: TrendingUp,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'GST Reports',
          href: '/admin/inventory/reports',
          icon: BarChart,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
      ],
    },

    // ── 12. FINANCE & BILLING ─────────────────────────────────────────────────
    {
      title: 'Finance & Billing',
      icon: DollarSign,
      items: [
        {
          label: 'Billing & Finance',
          href: '/dashboard/billing/opd',
          icon: DollarSign,
          requiredPermission: null,
        },
        {
          label: 'Charge mapping',
          href: '/dashboard/admin/charge-mapping',
          icon: Link2,
          requiredPermission: 'bill.admin',
        },
        {
          label: 'Charge reconciliation',
          href: '/dashboard/admin/charge-reconciliation',
          icon: Scale,
          requiredPermission: 'bill.reconciliation.view',
        },
        {
          label: 'Insurance Management',
          href: '/dashboard/ccms/cases',
          icon: FileCheck,
          requiredPermission: 'FINANCE:INSURANCE:VIEW',
        },
        {
          label: 'Revenue Cycle',
          href: '/dashboard/finance?tab=reports',
          icon: TrendingUp,
          requiredPermission: 'FINANCE:REPORTS:VIEW',
        },
      ],
    },

    // ── 13. HR & STAFF ────────────────────────────────────────────────────────
    {
      title: 'HR & Staff',
      icon: Briefcase,
      items: [
        {
          label: 'Staff Scheduling',
          href: '/dashboard/admin/hr',
          icon: CalendarDays,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Onboarding',
          href: '/dashboard/admin/hr/onboarding',
          icon: UserPlus,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Licenses',
          href: '/dashboard/admin/licenses',
          icon: FileCheck,
          requiredPermission: 'license.view',
        },
        {
          label: 'Performance',
          href: '/dashboard/admin/performance',
          icon: TrendingUp,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Training',
          href: '/dashboard/admin/training',
          icon: GraduationCap,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Attendance',
          href: '/dashboard/admin/attendance',
          icon: ClipboardList,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Leave Management',
          href: '/dashboard/admin/leave',
          icon: Calendar,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Payroll',
          href: '/dashboard/admin/payroll',
          icon: DollarSign,
          requiredPermission: 'employee.view',
        },
      ],
    },

    // ── 14. REPORTS & ANALYTICS ───────────────────────────────────────────────
    {
      title: 'Reports & Analytics',
      icon: BarChart,
      items: [
        {
          label: 'Advanced Reports',
          href: '/dashboard/reports',
          icon: FileText,
          requiredPermission: null,
        },
        {
          label: 'Analytics & BI',
          href: '/dashboard/analytics',
          icon: BarChart,
          requiredPermission: null,
        },
        {
          label: 'Medical Records',
          href: '/dashboard/documents',
          icon: FolderOpen,
          requiredPermission: 'document.view',
        },
      ],
    },

    // ── 15. COMPLIANCE & QUALITY ──────────────────────────────────────────────
    {
      title: 'Compliance & Quality',
      icon: Shield,
      items: [
        {
          label: 'Consent Management',
          href: '/dashboard/quality',
          icon: FileCheck,
          requiredPermission: 'quality.view',
        },
        {
          label: 'NABH Management',
          href: '/dashboard/quality',
          icon: Star,
          requiredPermission: 'quality.view',
        },
        {
          label: 'HIPAA Management',
          href: '/dashboard/admin/compliance',
          icon: Shield,
          requiredPermission: 'audit.view',
        },
        {
          label: 'Feedback & Surveys',
          href: '/dashboard/quality',
          icon: Monitor,
          requiredPermission: 'quality.view',
        },
      ],
    },

    // ── 16. COMMUNICATION & SUPPORT ───────────────────────────────────────────
    {
      title: 'Communication & Support',
      icon: Bell,
      items: [
        {
          label: 'Helpdesk & Support',
          href: '/dashboard/referrals',
          icon: AlertTriangle,
          requiredPermission: 'referral.view',
        },
        {
          label: 'Communication',
          href: '/dashboard/notifications',
          icon: Bell,
          requiredPermission: 'notification.view',
        },
        {
          label: 'Housekeeping',
          href: '/dashboard/operations/cssd',
          icon: Building,
          requiredPermission: 'OPERATIONS:CSSD:VIEW',
        },
      ],
    },

    // ── 17. MASTER DATA ───────────────────────────────────────────────────────
    {
      title: 'Master Data',
      icon: Database,
      items: [
        {
          label: 'Overview',
          href: '/dashboard/master-data',
          icon: LayoutDashboard,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Patient Setup',
          href: '/dashboard/master-data/patient_setup',
          icon: Users,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Clinical',
          href: '/dashboard/master-data/clinical',
          icon: Stethoscope,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Service Catalog',
          href: '/dashboard/master-data/service-catalog',
          icon: Layers,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Appointments',
          href: '/dashboard/master-data/appointments',
          icon: Calendar,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Counsellor',
          href: '/dashboard/master-data/counsellor',
          icon: Brain,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Billing & Finance',
          href: '/dashboard/master-data/billing_finance',
          icon: DollarSign,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Insurance',
          href: '/dashboard/master-data/insurance',
          icon: Shield,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Inventory',
          href: '/dashboard/master-data/inventory',
          icon: Package,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Pharmacy',
          href: '/dashboard/master-data/pharmacy',
          icon: Pill,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Lab & Diagnostics',
          href: '/dashboard/master-data/lab_diagnostics',
          icon: TestTube,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Ward & IP',
          href: '/dashboard/master-data/ward_ip',
          icon: Tent,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'HR & Staff',
          href: '/dashboard/master-data/hr_staff',
          icon: Briefcase,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'System',
          href: '/dashboard/master-data/system',
          icon: Settings,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Operations',
          href: '/dashboard/master-data/operations',
          icon: MapPin,
          requiredPermission: 'master_data.view',
        },
      ],
    },

    // ── 18. ADMINISTRATION ────────────────────────────────────────────────────
    {
      title: 'Administration',
      icon: Settings,
      items: [
        {
          label: 'Overview',
          href: '/dashboard/admin/overview',
          icon: LayoutDashboard,
          requiredPermission: null,
        },
        // — Organization —
        {
          label: 'Organization',
          href: '#',
          icon: Building2,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Hierarchy Viewer',
          href: '/dashboard/admin/hierarchy',
          icon: Activity,
          requiredPermission: 'organization.view',
        },
        {
          label: 'Tenants',
          href: '/dashboard/admin/tenants',
          icon: Building,
          requiredPermission: 'tenant.view',
        },
        {
          label: 'Organizations',
          href: '/dashboard/organizations',
          icon: Building2,
          requiredPermission: 'organization.view',
        },
        {
          label: 'Branches',
          href: '/dashboard/admin/branches',
          icon: Building,
          requiredPermission: 'branch.view',
        },
        {
          label: 'Departments',
          href: '/dashboard/departments',
          icon: Briefcase,
          requiredPermission: 'department.view',
        },
        // — People —
        {
          label: 'People',
          href: '#',
          icon: Users,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Users & Employees',
          href: '/dashboard/admin/users',
          icon: Users,
          requiredPermission: 'user.view',
        },
        {
          label: 'Bulk Operations',
          href: '/dashboard/bulk-operations',
          icon: Upload,
          requiredPermission: 'bulk.import',
        },
        // — Access Control —
        {
          label: 'Access Control',
          href: '#',
          icon: Key,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Roles & Permissions',
          href: '/dashboard/roles',
          icon: Shield,
          requiredPermission: 'role.view',
        },
        {
          label: 'Department Access',
          href: '/dashboard/admin/department-access',
          icon: Key,
          requiredPermission: 'department.view',
        },
        {
          label: 'Access Requests',
          href: '/dashboard/admin/access-requests',
          icon: AlertTriangle,
          requiredPermission: 'permission.view',
        },
        // — Security & Compliance —
        {
          label: 'Security & Compliance',
          href: '#',
          icon: Shield,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Security Dashboard',
          href: '/dashboard/admin/security',
          icon: Shield,
          requiredPermission: 'session.view',
        },
        {
          label: 'IT Security',
          href: '/dashboard/admin/security',
          icon: Key,
          requiredPermission: 'session.view',
        },
        {
          label: 'Integration health',
          href: '/dashboard/admin/integration-health',
          icon: Activity,
          requiredPermission: 'integration.admin',
        },
        {
          label: 'Audit Logs',
          href: '/dashboard/audit-logs',
          icon: Activity,
          requiredPermission: 'audit.view',
        },
        {
          label: 'Compliance Reports',
          href: '/dashboard/admin/compliance',
          icon: FileCheck,
          requiredPermission: 'audit.view',
        },
        {
          label: 'System Settings',
          href: '/dashboard/system-settings',
          icon: Settings,
          requiredPermission: 'system_settings.view',
        },
      ],
    },
];

export type { MenuItem, MenuSection };

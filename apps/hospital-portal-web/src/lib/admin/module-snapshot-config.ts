import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Shield,
  Calendar,
  Stethoscope,
  Heart,
  FileCheck,
  Bed,
  FlaskConical,
  Pill,
  Package,
  IndianRupee,
  UserCog,
  ClipboardCheck,
  Database,
  BarChart3,
} from 'lucide-react';

export interface ModuleSnapshotConfig {
  moduleId: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string | null;
  accent: string;
  iconBg: string;
}

export const MODULE_SNAPSHOT_CONFIGS: ModuleSnapshotConfig[] = [
  {
    moduleId: 'iam',
    label: 'Organization & IAM',
    href: '/dashboard/admin/users',
    icon: Users,
    permission: 'user.view',
    accent: 'border-l-indigo-500',
    iconBg: 'bg-indigo-50 text-indigo-600',
  },
  {
    moduleId: 'security',
    label: 'Security',
    href: '/dashboard/admin/sessions',
    icon: Shield,
    permission: 'audit.view',
    accent: 'border-l-red-500',
    iconBg: 'bg-red-50 text-red-600',
  },
  {
    moduleId: 'opd',
    label: 'OPD & Registration',
    href: '/dashboard/frontdesk',
    icon: Calendar,
    permission: 'appointment.view',
    accent: 'border-l-sky-500',
    iconBg: 'bg-sky-50 text-sky-600',
  },
  {
    moduleId: 'clinical',
    label: 'Clinical',
    href: '/dashboard/doctors-desk',
    icon: Stethoscope,
    permission: 'CLINICAL:EXAMINATION:VIEW',
    accent: 'border-l-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    moduleId: 'counsellor',
    label: 'Counsellor',
    href: '/dashboard/counsellors-desk/waiting-list',
    icon: Heart,
    permission: null,
    accent: 'border-l-pink-500',
    iconBg: 'bg-pink-50 text-pink-600',
  },
  {
    moduleId: 'ccms',
    label: 'Coverage & Claims',
    href: '/dashboard/ccms',
    icon: FileCheck,
    permission: 'ccms.coverage_case.read',
    accent: 'border-l-violet-500',
    iconBg: 'bg-violet-50 text-violet-600',
  },
  {
    moduleId: 'ward',
    label: 'Ward & Inpatient',
    href: '/dashboard/ip-management',
    icon: Bed,
    permission: null,
    accent: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  {
    moduleId: 'lab',
    label: 'Diagnostics & Lab',
    href: '/dashboard/laboratory',
    icon: FlaskConical,
    permission: 'laboratory.view',
    accent: 'border-l-cyan-500',
    iconBg: 'bg-cyan-50 text-cyan-600',
  },
  {
    moduleId: 'pharmacy',
    label: 'Pharmacy',
    href: '/dashboard/pharmacy',
    icon: Pill,
    permission: 'pharmacy.view',
    accent: 'border-l-green-500',
    iconBg: 'bg-green-50 text-green-600',
  },
  {
    moduleId: 'inventory',
    label: 'Inventory',
    href: '/admin/inventory',
    icon: Package,
    permission: 'OPERATIONS:STORES:VIEW',
    accent: 'border-l-orange-500',
    iconBg: 'bg-orange-50 text-orange-600',
  },
  {
    moduleId: 'finance',
    label: 'Finance & Billing',
    href: '/dashboard/billing/opd',
    icon: IndianRupee,
    permission: 'FINANCE:REPORTS:VIEW',
    accent: 'border-l-yellow-500',
    iconBg: 'bg-yellow-50 text-yellow-700',
  },
  {
    moduleId: 'hr',
    label: 'HR & Staff',
    href: '/dashboard/admin/employees',
    icon: UserCog,
    permission: 'employee.view',
    accent: 'border-l-teal-500',
    iconBg: 'bg-teal-50 text-teal-600',
  },
  {
    moduleId: 'compliance',
    label: 'Compliance & Quality',
    href: '/dashboard/quality',
    icon: ClipboardCheck,
    permission: 'audit.view',
    accent: 'border-l-rose-500',
    iconBg: 'bg-rose-50 text-rose-600',
  },
  {
    moduleId: 'master-data',
    label: 'Master Data',
    href: '/dashboard/master-data/patient',
    icon: Database,
    permission: 'master_data.view',
    accent: 'border-l-gray-500',
    iconBg: 'bg-gray-100 text-gray-600',
  },
  {
    moduleId: 'reports',
    label: 'Reports & Analytics',
    href: '/dashboard/reports',
    icon: BarChart3,
    permission: 'document.view',
    accent: 'border-l-blue-500',
    iconBg: 'bg-blue-50 text-blue-600',
  },
];

export interface ModuleSnapshotMetric {
  label: string;
  value: number | string;
  severity?: 'ok' | 'warn' | 'critical';
}

export interface ModuleSnapshot {
  moduleId: string;
  label: string;
  href: string;
  metrics: ModuleSnapshotMetric[];
  lastUpdated: string;
}

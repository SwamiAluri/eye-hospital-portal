import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart,
  Beaker,
  ClipboardList,
  FileCheck,
  FileText,
  FlaskConical,
  Layers,
  LayoutDashboard,
  ListChecks,
  Microscope,
  Package,
  Settings,
  Shield,
  TestTube,
  Thermometer,
  Wrench,
} from 'lucide-react';
import { LMS_CATALOGUE_PERMISSIONS, LMS_VIEW } from '@/lib/lms/lms-permissions';

export type LmsNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission: string | null;
  exact?: boolean;
  isSection?: boolean;
  isExpandable?: boolean;
  subItems?: LmsNavItem[];
};

/**
 * Enterprise LMS left-nav IA (PRD-aligned operational domains).
 * Isolated from `/dashboard/laboratory` (legacy Pathology Laboratory).
 */
export const LMS_NAV_ITEMS: LmsNavItem[] = [
  {
    label: 'Overview',
    href: '/dashboard/lms',
    icon: LayoutDashboard,
    requiredPermission: LMS_VIEW,
    exact: true,
  },
  {
    label: 'Work Queue',
    href: '/dashboard/lms/work-queue',
    icon: ListChecks,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Orders',
    href: '/dashboard/lms/orders',
    icon: ClipboardList,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Collection',
    href: '/dashboard/lms/collection',
    icon: TestTube,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Specimens',
    href: '/dashboard/lms/specimens',
    icon: FlaskConical,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Testing',
    href: '/dashboard/lms/testing',
    icon: Microscope,
    requiredPermission: LMS_VIEW,
    isExpandable: true,
    subItems: [
      {
        label: 'Workbench',
        href: '/dashboard/lms/testing/workbench',
        icon: Microscope,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Runs',
        href: '/dashboard/lms/testing/runs',
        icon: Activity,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Manual Results',
        href: '/dashboard/lms/testing/manual-results',
        icon: ClipboardList,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Instrument Results',
        href: '/dashboard/lms/testing/instrument-results',
        icon: Beaker,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Exceptions',
        href: '/dashboard/lms/testing/exceptions',
        icon: AlertTriangle,
        requiredPermission: LMS_VIEW,
      },
    ],
  },
  {
    label: 'Results & Authorization',
    href: '/dashboard/lms/results',
    icon: FileCheck,
    requiredPermission: LMS_VIEW,
    isExpandable: true,
    subItems: [
      {
        label: 'Verification',
        href: '/dashboard/lms/results/verification',
        icon: FileCheck,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Authorization',
        href: '/dashboard/lms/results/authorization',
        icon: Shield,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Authorized Results',
        href: '/dashboard/lms/results/authorized',
        icon: ClipboardList,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Critical Results',
        href: '/dashboard/lms/results/critical',
        icon: AlertTriangle,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Amendments',
        href: '/dashboard/lms/results/amendments',
        icon: FileText,
        requiredPermission: LMS_VIEW,
      },
    ],
  },
  {
    label: 'Reports',
    href: '/dashboard/lms/reports',
    icon: FileText,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Referrals',
    href: '/dashboard/lms/referrals',
    icon: Package,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Quality & commercial',
    href: '#',
    icon: Wrench,
    requiredPermission: LMS_VIEW,
    isSection: true,
  },
  {
    label: 'Quality',
    href: '/dashboard/lms/quality',
    icon: Shield,
    requiredPermission: LMS_VIEW,
    isExpandable: true,
    subItems: [
      {
        label: 'QC',
        href: '/dashboard/lms/quality/qc',
        icon: Beaker,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Nonconformities',
        href: '/dashboard/lms/quality/nonconformities',
        icon: AlertTriangle,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'CAPA',
        href: '/dashboard/lms/quality/capa',
        icon: ClipboardList,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Equipment',
        href: '/dashboard/lms/quality/equipment',
        icon: Wrench,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Reagents',
        href: '/dashboard/lms/quality/reagents',
        icon: FlaskConical,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Competency',
        href: '/dashboard/lms/quality/competency',
        icon: FileCheck,
        requiredPermission: LMS_VIEW,
      },
    ],
  },
  {
    label: 'Operations',
    href: '/dashboard/lms/operations',
    icon: Activity,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Billing',
    href: '/dashboard/lms/billing',
    icon: FileText,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Analytics',
    href: '/dashboard/lms/analytics',
    icon: BarChart,
    requiredPermission: LMS_VIEW,
  },
  {
    label: 'Governance',
    href: '#',
    icon: Settings,
    requiredPermission: LMS_VIEW,
    isSection: true,
  },
  {
    label: 'Configuration',
    href: '/dashboard/lms/configuration',
    icon: Settings,
    requiredPermission: LMS_VIEW,
    isExpandable: true,
    subItems: [
      {
        label: 'Test Catalogue',
        href: '/dashboard/lms/configuration/test-catalogue',
        icon: ClipboardList,
        requiredPermission: LMS_CATALOGUE_PERMISSIONS.view,
      },
      {
        label: 'Panels',
        href: '/dashboard/lms/configuration/panels',
        icon: Layers,
        requiredPermission: LMS_CATALOGUE_PERMISSIONS.view,
      },
      {
        label: 'Specimen Types',
        href: '/dashboard/lms/configuration/specimen-types',
        icon: TestTube,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Reference Intervals',
        href: '/dashboard/lms/configuration/reference-intervals',
        icon: Thermometer,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'TAT Rules',
        href: '/dashboard/lms/configuration/tat-rules',
        icon: Activity,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Sites / Sections',
        href: '/dashboard/lms/configuration/sites-sections',
        icon: Settings,
        requiredPermission: LMS_VIEW,
      },
      {
        label: 'Referral Partners',
        href: '/dashboard/lms/configuration/referral-partners',
        icon: Package,
        requiredPermission: LMS_VIEW,
      },
    ],
  },
  {
    label: 'Administration',
    href: '/dashboard/lms/administration',
    icon: Settings,
    requiredPermission: LMS_VIEW,
  },
];

export const LMS_ROUTE_PREFIX = '/dashboard/lms';
export const LEGACY_LABORATORY_ROUTE = '/dashboard/laboratory';

export function collectLmsHrefs(items: LmsNavItem[] = LMS_NAV_ITEMS): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    if (item.href && item.href !== '#') hrefs.push(item.href);
    if (item.subItems?.length) hrefs.push(...collectLmsHrefs(item.subItems));
  }
  return hrefs;
}

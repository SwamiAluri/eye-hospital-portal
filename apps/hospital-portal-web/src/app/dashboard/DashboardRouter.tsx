'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const ROLE_DASHBOARD_MAP: Record<string, string> = {
  Admin: '/dashboard/admin/overview',
  'IT Administrator': '/dashboard/admin/overview',
  'Medical Records Officer': '/dashboard/admin/overview',
  'Super Admin': '/dashboard/admin/overview',
  'Platform Admin': '/dashboard/admin/overview',
  'Admin Manager': '/dashboard/admin/overview',
  'Compliance Officer': '/dashboard/admin/overview',
  'System Auditor': '/dashboard/admin/overview',
  'Support Engineer': '/dashboard/admin/overview',
  // Clinical: /dashboard/clinical does not exist. Doctor's Desk is the live
  // queue at /dashboard/doctors-desk (sidebar "Doctor's Desk").
  Doctor: '/dashboard/doctors-desk',
  Consultant: '/dashboard/doctors-desk',
  'Junior Doctor': '/dashboard/doctors-desk',
  // Nursing: ward board is the operational home (sidebar "Ward").
  Nurse: '/dashboard/ip-management/ward',
  'Nurse Manager': '/dashboard/ip-management/ward',
  Receptionist: '/dashboard/frontdesk',
  Counsellor: '/dashboard/frontdesk',
  Pharmacist: '/dashboard/pharmacy',
  'Pharmacy Manager': '/dashboard/pharmacy',
  // Lab: /dashboard/lab does not exist. Sidebar "Laboratory (Pathology)".
  'Lab Technician': '/dashboard/laboratory',
  'Lab Manager': '/dashboard/laboratory',
  // Billing: /dashboard/billing has no index. Sidebar "Billing & Finance".
  'Billing Clerk': '/dashboard/billing/opd',
  // Support: /dashboard/support does not exist. Sidebar maps Housekeeping → CSSD
  // and Asset Management / maintenance → biomedical.
  'Housekeeping Supervisor': '/dashboard/operations/cssd',
  'Maintenance Technician': '/dashboard/operations/biomedical',
};

const ADMIN_ROLE_PATTERNS = [
  /^admin$/i,
  /admin\s*manager/i,
  /super\s*admin/i,
  /platform\s*admin/i,
  /it\s*admin/i,
  /compliance\s*officer/i,
  /system\s*auditor/i,
  /medical\s*records/i,
];

function resolveDashboard(roles: string[]): string {
  for (const role of roles) {
    const exact = ROLE_DASHBOARD_MAP[role];
    if (exact) return exact;
  }
  for (const role of roles) {
    if (ADMIN_ROLE_PATTERNS.some((p) => p.test(role))) {
      return '/dashboard/admin/overview';
    }
  }
  return '/dashboard/frontdesk';
}

export function DashboardRouter() {
  const router = useRouter();
  const { roles } = useAuthStore();

  useEffect(() => {
    if (roles && roles.length > 0) {
      router.replace(resolveDashboard(roles));
    } else {
      router.replace('/dashboard/frontdesk');
    }
  }, [roles, router]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading your dashboard...</p>
      </div>
    </div>
  );
}

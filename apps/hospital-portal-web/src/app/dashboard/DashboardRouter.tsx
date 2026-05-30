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
  Doctor: '/dashboard/clinical',
  Consultant: '/dashboard/clinical',
  'Junior Doctor': '/dashboard/clinical',
  Nurse: '/dashboard/clinical',
  'Nurse Manager': '/dashboard/clinical',
  Receptionist: '/dashboard/frontdesk',
  Counsellor: '/dashboard/frontdesk',
  Pharmacist: '/dashboard/pharmacy',
  'Pharmacy Manager': '/dashboard/pharmacy',
  'Lab Technician': '/dashboard/lab',
  'Lab Manager': '/dashboard/lab',
  'Billing Clerk': '/dashboard/billing',
  'Housekeeping Supervisor': '/dashboard/support',
  'Maintenance Technician': '/dashboard/support',
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

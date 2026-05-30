'use client';

import { AdminSectionHub } from '@/components/admin/AdminSectionHub';

export default function AdminHrPage() {
  return (
    <AdminSectionHub
      title="HR & staff"
      description="Staff lifecycle, attendance, and workforce management."
      links={[
        { label: 'Employees', href: '/dashboard/admin/employees', description: 'Staff directory' },
        { label: 'Onboarding', href: '/dashboard/admin/onboarding', description: 'New hire workflows' },
        { label: 'Attendance', href: '/dashboard/admin/attendance', description: 'Daily attendance' },
        { label: 'Leave', href: '/dashboard/admin/leave', description: 'Leave management' },
        { label: 'Payroll', href: '/dashboard/admin/payroll', description: 'Payroll processing' },
        { label: 'Licenses', href: '/dashboard/admin/licenses', description: 'Professional licenses' },
        { label: 'Training', href: '/dashboard/admin/training', description: 'Staff training programs' },
        { label: 'Performance', href: '/dashboard/admin/performance', description: 'Performance reviews' },
      ]}
    />
  );
}

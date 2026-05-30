'use client';

import { AdminSectionHub } from '@/components/admin/AdminSectionHub';

export default function AdminSecurityPage() {
  return (
    <AdminSectionHub
      title="Security"
      description="Sessions, devices, and security monitoring."
      links={[
        { label: 'Active sessions', href: '/dashboard/admin/sessions', description: 'View and revoke user sessions' },
        { label: 'Device management', href: '/dashboard/admin/devices', description: 'Registered devices and approvals' },
        { label: 'Audit logs', href: '/dashboard/admin/audit-logs', description: 'Security and compliance audit trail' },
        { label: 'Emergency access', href: '/dashboard/admin/emergency-access', description: 'Break-glass access requests' },
        { label: 'Command center', href: '/dashboard/admin/overview', description: 'Admin dashboard overview' },
      ]}
    />
  );
}

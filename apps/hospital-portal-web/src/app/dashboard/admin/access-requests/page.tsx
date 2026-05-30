'use client';

import { AdminSectionHub } from '@/components/admin/AdminSectionHub';

export default function AccessRequestsPage() {
  return (
    <AdminSectionHub
      title="Access requests"
      description="Review pending access and role assignment requests."
      links={[
        { label: 'Users & employees', href: '/dashboard/admin/users', description: 'Approve user provisioning' },
        { label: 'Device approvals', href: '/dashboard/admin/devices/approval', description: 'Pending device registrations' },
        { label: 'Emergency access', href: '/dashboard/admin/emergency-access', description: 'Break-glass requests' },
        { label: 'Audit logs', href: '/dashboard/admin/audit-logs', description: 'Access change history' },
      ]}
    />
  );
}

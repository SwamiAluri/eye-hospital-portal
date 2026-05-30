'use client';

import { AdminSectionHub } from '@/components/admin/AdminSectionHub';

export default function AdminCompliancePage() {
  return (
    <AdminSectionHub
      title="Compliance & regulatory"
      description="HIPAA, NABH, and hospital quality compliance."
      links={[
        { label: 'Quality & NABH', href: '/dashboard/quality', description: 'Consent, feedback, and quality programs' },
        { label: 'Audit logs', href: '/dashboard/admin/audit-logs', description: 'Compliance audit trail' },
        { label: 'Compliance reports', href: '/dashboard/compliance/adverse-events', description: 'Adverse events and reporting' },
        { label: 'Command center', href: '/dashboard/admin/overview', description: 'Compliance score on overview' },
      ]}
    />
  );
}

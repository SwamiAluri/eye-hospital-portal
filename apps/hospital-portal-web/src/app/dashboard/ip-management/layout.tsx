'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function IpManagementLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute
      requiredAnyPermission={[
        'ward.checklist.edit',
        'ot.safety.sign',
        'ip_management.view',
      ]}
    >
      {children}
    </ProtectedRoute>
  );
}

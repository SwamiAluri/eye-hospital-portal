'use client';

import { AdminSectionHub } from '@/components/admin/AdminSectionHub';

export default function DepartmentAccessPage() {
  return (
    <AdminSectionHub
      title="Department access"
      description="Manage which users can access which departments."
      links={[
        { label: 'Permission matrix', href: '/dashboard/admin/permissions/matrix', description: 'Role and permission grid' },
        { label: 'Users & employees', href: '/dashboard/admin/users', description: 'Assign department access per user' },
        { label: 'Departments', href: '/dashboard/departments', description: 'Department master list' },
        { label: 'Roles', href: '/dashboard/admin/roles', description: 'Role-based access control' },
      ]}
    />
  );
}

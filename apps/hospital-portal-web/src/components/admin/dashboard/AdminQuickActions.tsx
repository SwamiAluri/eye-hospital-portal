'use client';

import Link from 'next/link';
import {
  UserPlus,
  Upload,
  FileText,
  Settings,
  Shield,
  Database,
  Building2,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

const ACTIONS = [
  { label: 'Add user', href: '/dashboard/admin/users', icon: UserPlus, permission: 'user.create' },
  { label: 'Bulk import', href: '/dashboard/admin/bulk-operations', icon: Upload, permission: 'bulk.import' },
  { label: 'Audit logs', href: '/dashboard/admin/audit-logs', icon: FileText, permission: 'audit.view' },
  { label: 'Roles', href: '/dashboard/admin/roles', icon: Shield, permission: 'role.view' },
  { label: 'Organizations', href: '/dashboard/organizations', icon: Building2, permission: 'organization.view' },
  { label: 'System settings', href: '/dashboard/admin/settings', icon: Settings, permission: null },
  { label: 'Master data', href: '/dashboard/master-data/patient', icon: Database, permission: 'master_data.view' },
];

export function AdminQuickActions() {
  const { hasPermission } = usePermissions();

  const visible = ACTIONS.filter(
    (a) => !a.permission || hasPermission(a.permission),
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

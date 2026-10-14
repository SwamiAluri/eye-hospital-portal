'use client';

import { Building2, User } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useBranchContext } from '@/hooks/use-branch-context';

/**
 * Structural LMS context strip — reuses Hospital Portal branch/user/role context.
 * Does not invent laboratory/section selection policy (future product decision).
 */
export function LmsContextStrip() {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const { branchId, branchName, isLoading } = useBranchContext();

  const roleLabel =
    roles?.length > 0 ? roles.slice(0, 2).join(', ') + (roles.length > 2 ? '…' : '') : '—';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.userName ||
    user?.email ||
    '—';
  const siteLabel = isLoading
    ? 'Loading site…'
    : branchName || (branchId ? 'Site selected' : 'No site selected');

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500"
      data-testid="lms-context-strip"
    >
      <span className="inline-flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        <span>
          Site: <span className="font-medium text-gray-700">{siteLabel}</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        <span>
          User: <span className="font-medium text-gray-700">{displayName}</span>
        </span>
      </span>
      <span>
        Role: <span className="font-medium text-gray-700">{roleLabel}</span>
      </span>
      <span className="text-gray-400">
        Laboratory / section context — not configured in L0
      </span>
    </div>
  );
}

'use client';

import { Building2 } from 'lucide-react';
import { useBranchContext } from '@/hooks/use-branch-context';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

export function BranchSwitcher({ className }: { className?: string }) {
  const { branches, branchId, selectBranch, isLoading, branchName } = useBranchContext();

  if (isLoading && !branchId) {
    return (
      <div className={cn('h-8 w-36 bg-gray-100 rounded-lg animate-pulse', className)} />
    );
  }

  if (branches.length <= 1) {
    const label = branches[0]?.branchName ?? branchName ?? 'Branch';
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200',
          className,
        )}
        data-testid={patientLookupTestIds.branchSwitcher}
      >
        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
        <span className="max-w-[140px] truncate">{label}</span>
      </div>
    );
  }

  return (
    <label
      className={cn('inline-flex items-center gap-1.5', className)}
      data-testid={patientLookupTestIds.branchSwitcher}
    >
      <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <select
        value={branchId ?? ''}
        onChange={(e) => selectBranch(e.target.value)}
        className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        aria-label="Select branch"
      >
        {branches.map((b) => (
          <option key={b.branchId} value={b.branchId}>
            {b.branchName}
            {b.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

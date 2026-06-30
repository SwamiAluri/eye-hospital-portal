'use client';

import { preOpStatusToken, type PreOpStatus } from '@/lib/ip-management/preop-status';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface StatusChipProps {
  status: PreOpStatus;
  /** Override the default status label. */
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'soft' | 'outline';
  /** Show the status icon (a11y: status is icon + text + color, never color alone). */
  showIcon?: boolean;
  className?: string;
}

/**
 * Single, consistent status chip for the whole Ward Pre-Op Workspace.
 * Uses the unified vocabulary in `preop-status.ts`.
 */
export function StatusChip({
  status,
  label,
  size = 'md',
  variant = 'soft',
  showIcon = true,
  className = '',
}: StatusChipProps) {
  const token = preOpStatusToken(status);
  const Icon = token.icon;
  const text = label ?? token.label;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const variantClasses =
    variant === 'outline'
      ? `bg-white ${token.text} border ${token.border}`
      : `${token.bg} ${token.text}`;

  return (
    <span
      data-testid={WARD_PREOP_V2_TEST_IDS.statusChip(status)}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClasses} ${variantClasses} ${className}`}
    >
      {showIcon && <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />}
      <span>{text}</span>
    </span>
  );
}

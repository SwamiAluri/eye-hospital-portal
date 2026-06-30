'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusChip } from './StatusChip';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PacAccordionSectionProps {
  sectionKey: string;
  title: string;
  subtitle?: string;
  status?: PreOpStatus;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Single-expand accordion row for the PAC form (Phase 4).
 */
export function PacAccordionSection({
  sectionKey,
  title,
  subtitle,
  status = 'not-started',
  open,
  onToggle,
  children,
}: PacAccordionSectionProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200"
      data-testid={WARD_PREOP_TEST_IDS.pacAccordion(sectionKey)}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <StatusChip status={status} size="sm" />
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-4">{children}</div>}
    </div>
  );
}

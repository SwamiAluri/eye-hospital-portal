'use client';

import type { ReactNode } from 'react';
import { StatusChip } from './StatusChip';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PacClinicalSectionProps {
  sectionKey: string;
  title: string;
  status?: PreOpStatus;
  children: ReactNode;
}

export function PacClinicalSection({
  sectionKey,
  title,
  status = 'not-started',
  children,
}: PacClinicalSectionProps) {
  return (
    <section
      data-testid={WARD_PREOP_TEST_IDS.pacSection(sectionKey)}
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</h4>
        <StatusChip status={status} size="sm" />
      </div>
      {children}
    </section>
  );
}

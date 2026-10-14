'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Beaker,
  ClipboardList,
  FileCheck,
  FlaskConical,
  ListChecks,
  Microscope,
  Package,
  Shield,
} from 'lucide-react';
import { LmsPageShell } from '@/components/lms/LmsPageShell';

const INDICATOR_SECTIONS = [
  {
    id: 'orders-attention',
    label: 'Orders requiring attention',
    href: '/dashboard/lms/orders',
    icon: ClipboardList,
  },
  {
    id: 'collection-queue',
    label: 'Collection queue',
    href: '/dashboard/lms/collection',
    icon: Beaker,
  },
  {
    id: 'specimens-receipt',
    label: 'Specimens awaiting receipt',
    href: '/dashboard/lms/specimens',
    icon: FlaskConical,
  },
  {
    id: 'testing-workload',
    label: 'Testing workload',
    href: '/dashboard/lms/testing',
    icon: Microscope,
  },
  {
    id: 'awaiting-verification',
    label: 'Results awaiting verification',
    href: '/dashboard/lms/results/verification',
    icon: FileCheck,
  },
  {
    id: 'awaiting-authorization',
    label: 'Results awaiting authorization',
    href: '/dashboard/lms/results/authorization',
    icon: Shield,
  },
  {
    id: 'authorized-results',
    label: 'Authorized Results',
    href: '/dashboard/lms/results/authorized',
    icon: ClipboardList,
  },
  {
    id: 'critical-events',
    label: 'Critical-result events',
    href: '/dashboard/lms/results/critical',
    icon: AlertTriangle,
  },
  {
    id: 'referral-exceptions',
    label: 'Referral exceptions',
    href: '/dashboard/lms/referrals',
    icon: Package,
  },
  {
    id: 'quality-exceptions',
    label: 'Quality exceptions',
    href: '/dashboard/lms/quality',
    icon: AlertTriangle,
  },
] as const;

/**
 * LMS Overview shell — structural indicators only.
 * Explicitly refuses fabricated KPI counts.
 */
export function LmsOverviewDashboard() {
  return (
    <LmsPageShell
      title="Overview"
      subtitle="Enterprise Laboratory Management workspace · foundation slice (L0)"
      icon={FlaskConical}
    >
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="lms-overview-honesty-banner">
        <p className="text-sm font-semibold text-amber-900">Foundation workspace</p>
        <p className="mt-0.5 text-xs text-amber-800">
          Operational indicators below are structural placeholders. Live laboratory metrics are
          not implemented in L0. No fabricated counts are shown.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/lms/work-queue"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
        >
          <ListChecks className="h-4 w-4" aria-hidden />
          Open Work Queue
        </Link>
        <span className="text-xs text-gray-400">
          Separate from legacy Pathology Laboratory at{' '}
          <code className="rounded bg-gray-100 px-1">/dashboard/laboratory</code>
        </span>
      </div>

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-testid="lms-overview-indicators"
      >
        {INDICATOR_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              href={section.href}
              data-testid={`lms-indicator-${section.id}`}
              className="rounded-xl border border-gray-200 border-l-4 border-l-gray-300 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {section.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">Not yet implemented</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">No live count · placeholder only</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </LmsPageShell>
  );
}

'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

const ACUITY_CONFIG: Record<
  string,
  { dot: string; label: string; text: string }
> = {
  critical: {
    dot: 'bg-red-500',
    label: 'Critical acuity',
    text: 'Critical',
  },
  high: {
    dot: 'bg-orange-500',
    label: 'High acuity',
    text: 'High',
  },
  medium: {
    dot: 'bg-amber-400',
    label: 'Medium acuity',
    text: 'Medium',
  },
  low: {
    dot: 'bg-gray-300',
    label: 'Low acuity',
    text: 'Low',
  },
};

export function AcuityDot({
  acuity,
  showLabel = false,
  className,
}: {
  acuity: string;
  showLabel?: boolean;
  className?: string;
}) {
  const key = acuity?.toLowerCase() ?? 'low';
  const config = ACUITY_CONFIG[key] ?? ACUITY_CONFIG.low;

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={config.label}
      data-testid={patientLookupTestIds.acuityDot(acuity)}
    >
      <span
        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', config.dot)}
        aria-hidden
      />
      <span className="sr-only">{config.label}</span>
      {showLabel && (
        <span className="text-xs font-medium capitalize text-gray-700">{config.text}</span>
      )}
    </span>
  );
}

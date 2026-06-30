'use client';

import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { PreOpSafetySignals, SafetyStripSegment } from '@/lib/ip-management/preop-safety-signals';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface SafetyStripProps {
  signals: PreOpSafetySignals | null;
  loading?: boolean;
  onNavigateStep?: (step: PreOpStepKey) => void;
}

const TONE_CLASSES: Record<SafetyStripSegment['tone'], string> = {
  neutral: 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white',
  caution: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/80',
  alert: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100/80',
};

function SegmentIcon({ tone }: { tone: SafetyStripSegment['tone'] }) {
  if (tone === 'alert') {
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  if (tone === 'caution') {
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
  return <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
}

function SafetySegment({
  segment,
  onNavigateStep,
}: {
  segment: SafetyStripSegment;
  onNavigateStep?: (step: PreOpStepKey) => void;
}) {
  const testId = WARD_PREOP_TEST_IDS.safetySegment(segment.id);
  const content = (
    <>
      <SegmentIcon tone={segment.tone} />
      <span className="font-medium">{segment.label}:</span>
      <span className="truncate">{segment.detail}</span>
    </>
  );

  const className = [
    'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
    TONE_CLASSES[segment.tone],
    onNavigateStep ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : '',
  ].join(' ');

  if (onNavigateStep) {
    return (
      <button
        type="button"
        data-testid={testId}
        title={`Open ${segment.label} in workspace`}
        onClick={() => onNavigateStep(segment.navigateStep)}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <span data-testid={testId} className={className}>
      {content}
    </span>
  );
}

/**
 * Persistent patient-safety summary (Phase 2). Surfaces allergies, infection
 * precautions, unverified critical labs, and laterality/site marking across
 * every workspace step — single read, deep-link to the owning step on click.
 */
export function SafetyStrip({ signals, loading, onNavigateStep }: SafetyStripProps) {
  if (loading || !signals) {
    return (
      <div
        data-testid={WARD_PREOP_TEST_IDS.safetyStrip}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-slate-50/90 px-3 py-2 text-xs text-gray-500"
        aria-busy="true"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
        Loading safety summary…
      </div>
    );
  }

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.safetyStrip}
      role="region"
      aria-label="Patient safety summary"
      className={[
        'rounded-xl border px-3 py-2',
        signals.allClear
          ? 'border-emerald-100 bg-emerald-50/50'
          : 'border-amber-200 bg-amber-50/40',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Safety
        </span>
        {signals.segments.map(segment => (
          <SafetySegment
            key={segment.id}
            segment={segment}
            onNavigateStep={onNavigateStep}
          />
        ))}
      </div>
    </div>
  );
}

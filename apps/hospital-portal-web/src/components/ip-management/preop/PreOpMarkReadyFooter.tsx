'use client';

import { Ban, Loader2 } from 'lucide-react';
import type { MarkReadyGateResult } from '@/lib/ip-management/preop-mark-ready-gates';
import type { CareTab, PreOpStepKey } from '@/lib/ip-management/preop-steps';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import type { DilationSlice } from '@/lib/ip-management/dilation-readiness';
import { DilationChip } from '@/components/ip-management/preop/DilationChip';

export interface MarkReadyHardBlockListProps {
  gates: MarkReadyGateResult;
  onNavigateStep?: (step: PreOpStepKey, extras?: { careTab?: CareTab }) => void;
}

/** Shared hard-stop list used by the workspace footer and the census rail (IP-010). */
export function MarkReadyHardBlockList({ gates, onNavigateStep }: MarkReadyHardBlockListProps) {
  if (gates.hardBlocks.length === 0) return null;

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.markReadyHardBlocks}
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-red-900">Hard stops before Mark Ready</p>
          <ul className="mt-1 space-y-1 text-xs text-red-800">
            {gates.hardBlocks.map(block => (
              <li key={block.code} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span data-testid={WARD_PREOP_TEST_IDS.markReadyHardBlock(block.code)}>
                  {block.message}
                </span>
                {onNavigateStep && (
                  <button
                    type="button"
                    onClick={() => onNavigateStep(block.navigateStep, { careTab: block.careTab })}
                    className="text-[11px] font-medium text-red-700 underline hover:text-red-900"
                  >
                    Open step
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function MarkReadySoftWarningList({
  gates,
  onNavigateStep,
}: MarkReadyHardBlockListProps) {
  if (gates.softWarnings.length === 0) return null;

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.markReadyReadyNote}
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
      role="status"
    >
      <p className="text-xs font-semibold text-amber-900">Warnings that will be acknowledged</p>
      <ul className="mt-1 space-y-1 text-xs text-amber-900">
        {gates.softWarnings.map(warning => (
          <li key={warning.code} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{warning.message}</span>
            {onNavigateStep && (
              <button
                type="button"
                onClick={() => onNavigateStep(warning.navigateStep, { careTab: warning.careTab })}
                className="text-[11px] font-medium text-amber-800 underline hover:text-amber-950"
              >
                Open step
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface PreOpMarkReadyFooterProps {
  gates: MarkReadyGateResult | null;
  loading?: boolean;
  markingReady?: boolean;
  onMarkReady: () => void;
  onNavigateStep?: (step: PreOpStepKey, extras?: { careTab?: CareTab }) => void;
  dilation?: DilationSlice | null;
}

/**
 * Workspace footer (Phase 6): hard stops for Mark Ready + primary CTA.
 * Soft checklist warnings remain on the gate chip / server acknowledge flow.
 */
export function PreOpMarkReadyFooter({
  gates,
  loading,
  markingReady,
  onMarkReady,
  onNavigateStep,
  dilation,
}: PreOpMarkReadyFooterProps) {
  const blocked = !loading && gates && !gates.canMarkReady;
  const warnCount = gates?.softWarnings.length ?? 0;

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.markReadyFooter} className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {dilation && <DilationChip slice={dilation} />}
        {warnCount > 0 && !blocked && (
          <p className="text-xs text-amber-800">
            <b>{warnCount} warning{warnCount === 1 ? '' : 's'}</b>
            {' · '}
            {gates!.softWarnings.map(w => w.code.split('_').join(' ')).join(' · ')}
          </p>
        )}
      </div>

      {blocked && gates && (
        <MarkReadyHardBlockList gates={gates} onNavigateStep={onNavigateStep} />
      )}
      {!blocked && gates && (
        <MarkReadySoftWarningList gates={gates} onNavigateStep={onNavigateStep} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          data-testid={WARD_PREOP_TEST_IDS.btnMarkReady}
          onClick={onMarkReady}
          disabled={markingReady || loading || !!blocked}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {markingReady ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </span>
          ) : (
            'Save & Mark Ready for Surgery'
          )}
        </button>
      </div>
    </div>
  );
}

'use client';

import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import type { MarkReadyGateResult } from '@/lib/ip-management/preop-mark-ready-gates';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PreOpMarkReadyFooterProps {
  gates: MarkReadyGateResult | null;
  loading?: boolean;
  markingReady?: boolean;
  onMarkReady: () => void;
  onNavigateStep?: (step: PreOpStepKey) => void;
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
}: PreOpMarkReadyFooterProps) {
  const blocked = !loading && gates && !gates.canMarkReady;

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.markReadyFooter} className="space-y-2">
      {blocked && (
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
                {gates!.hardBlocks.map(block => (
                  <li key={block.code} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span data-testid={WARD_PREOP_TEST_IDS.markReadyHardBlock(block.code)}>
                      {block.message}
                    </span>
                    {onNavigateStep && (
                      <button
                        type="button"
                        onClick={() => onNavigateStep(block.navigateStep)}
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
      )}

      {!loading && gates?.canMarkReady && (
        <p
          data-testid={WARD_PREOP_TEST_IDS.markReadyReadyNote}
          className="flex items-center gap-1.5 text-[11px] text-emerald-700"
        >
          <AlertTriangle className="h-3 w-3 text-emerald-600" aria-hidden="true" />
          Surgery hard stops cleared — you can mark ready. Other checklist items may still warn.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          data-testid={WARD_PREOP_TEST_IDS.btnMarkReady}
          onClick={onMarkReady}
          disabled={markingReady || loading || blocked}
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

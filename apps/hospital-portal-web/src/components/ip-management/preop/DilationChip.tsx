'use client';

import { useEffect, useState } from 'react';
import {
  dilationChipLabel,
  formatDilationMmSs,
  remainingSecondsFromSlice,
  type DilationSlice,
} from '@/lib/ip-management/dilation-readiness';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export function DilationChip({ slice }: { slice: DilationSlice | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!slice || slice.status !== 'not_ready') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [slice]);

  if (!slice) return null;

  const remaining = remainingSecondsFromSlice(slice, now);
  const ready = slice.status === 'ready' || (slice.status === 'not_ready' && remaining <= 0);
  const caption = dilationChipLabel(slice, remaining);

  if (slice.status === 'not_recorded') {
    return (
      <span
        data-testid={WARD_PREOP_TEST_IDS.dilationChip}
        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-950"
      >
        {caption}
      </span>
    );
  }

  if (ready) {
    return (
      <span
        data-testid={WARD_PREOP_TEST_IDS.dilationChip}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900"
      >
        {caption}
      </span>
    );
  }

  return (
    <span
      data-testid={WARD_PREOP_TEST_IDS.dilationChip}
      className="inline-flex items-center gap-2.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-amber-950"
    >
      <span className="text-xs font-semibold">Dilation</span>
      <span className="text-xl font-semibold tabular-nums tracking-tight leading-none">
        {formatDilationMmSs(remaining)}
      </span>
      <span className="text-[11px] text-amber-800">{caption}</span>
    </span>
  );
}

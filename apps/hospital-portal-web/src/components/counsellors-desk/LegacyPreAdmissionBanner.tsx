'use client';

import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { usePreAdmissionCompletionBySession } from '@/hooks/use-pre-admission-checklist';

/** Read-only bridge: legacy pre_admission_checklist via counselling session → OT schedule. */
export function LegacyPreAdmissionBanner({ counselingSessionId }: { counselingSessionId?: string | null }) {
  const { data, isLoading } = usePreAdmissionCompletionBySession(counselingSessionId ?? undefined);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoading && data?.completions?.length) setVisible(true);
  }, [isLoading, data?.completions?.length]);

  if (!visible || !data?.completions?.length) return null;

  const done = data.completions.filter(i => i.isComplete).length;
  const total = data.completions.length;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2 mb-3">
      <Archive className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">Legacy pre-admission checklist (read-only)</p>
        <p className="mt-0.5 text-amber-800">
          Historical OT schedule data — {done}/{total} complete.
          Use the Outpatient Safety checklist for new workflows.
        </p>
      </div>
    </div>
  );
}

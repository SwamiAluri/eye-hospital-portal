'use client';

import type { PatientDataQuality } from '@/types/patient-lookup';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PatientDataQualityBanner({
  dataQuality,
  className,
  summary,
}: {
  dataQuality?: PatientDataQuality | null;
  className?: string;
  /** Preview-only lead line. Patient 360 keeps the existing issue list. */
  summary?: string;
}) {
  if (!dataQuality?.isIncomplete && !dataQuality?.hasStaleVitals) return null;

  const messages = [...(dataQuality.issues ?? [])];
  if (dataQuality.hasStaleVitals) {
    messages.push(
      dataQuality.vitalsStaleDays != null
        ? `Vitals are ${dataQuality.vitalsStaleDays} days old — record now?`
        : 'No recent vitals on file',
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm leading-5 text-amber-900',
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          {summary ? <p className="font-medium">{summary}</p> : null}
          <ul className={cn('min-w-0 list-disc space-y-0.5 pl-4', summary && 'mt-0.5')}>
            {messages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

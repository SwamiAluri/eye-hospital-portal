'use client';

import type { PatientDataQuality } from '@/types/patient-lookup';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PatientDataQualityBanner({
  dataQuality,
  className,
}: {
  dataQuality?: PatientDataQuality | null;
  className?: string;
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
        'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900',
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <ul className="list-disc list-inside space-y-0.5">
          {messages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

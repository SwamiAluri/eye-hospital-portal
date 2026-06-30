'use client';

import { PanelLeft, PanelRight } from 'lucide-react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientHubPreviewMode } from '@/lib/patients/patient-hub-preview-mode';
import { cn } from '@/lib/utils';

export function PreviewModeToggle({
  mode,
  onToggle,
  className,
}: {
  mode: PatientHubPreviewMode;
  onToggle: () => void;
  className?: string;
}) {
  const isDocked = mode === 'docked';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDocked}
      aria-label={isDocked ? 'Switch to floating preview' : 'Dock preview panel'}
      title={isDocked ? 'Floating drawer' : 'Dock preview'}
      data-testid={patientLookupTestIds.previewDockToggle}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 hover:text-emerald-800 transition-colors',
        className,
      )}
    >
      {isDocked ? (
        <PanelRight className="h-4 w-4" aria-hidden />
      ) : (
        <PanelLeft className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

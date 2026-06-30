"use client";

import { PatientPreviewPanel } from "@/components/patients/lookup/PatientPreviewPanel";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import type { PatientHubPreviewMode } from "@/lib/patients/patient-hub-preview-mode";
import type { PatientLookupRow } from "@/types/patient-lookup";

export function PatientPreviewSplitPane({
  patient,
  branchId,
  open,
  onClose,
  onOpenProfile,
  previewMode,
  onPreviewModeToggle,
}: {
  patient: PatientLookupRow | null;
  branchId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenProfile?: (patientId: string) => void;
  previewMode: PatientHubPreviewMode;
  onPreviewModeToggle: () => void;
}) {
  if (!open || !patient) return null;

  return (
    <aside
      className="hidden xl:flex h-full min-h-0 w-[42%] max-w-[480px] min-w-[360px] shrink-0 flex-col border-l border-gray-200 bg-white shadow-sm"
      data-testid={patientLookupTestIds.previewSplitPane}
      aria-label="Patient preview"
    >
      <PatientPreviewPanel
        patient={patient}
        branchId={branchId}
        open={open}
        onClose={onClose}
        onOpenProfile={onOpenProfile}
        showDockToggle
        previewMode={previewMode}
        onPreviewModeToggle={onPreviewModeToggle}
      />
    </aside>
  );
}

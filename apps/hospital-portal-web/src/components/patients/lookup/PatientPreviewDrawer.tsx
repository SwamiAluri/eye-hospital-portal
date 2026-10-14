"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PatientPreviewPanel } from "@/components/patients/lookup/PatientPreviewPanel";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import type { PatientHubPreviewMode } from "@/lib/patients/patient-hub-preview-mode";
import type { PatientLookupRow } from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

function useIsMobilePreview() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function PatientPreviewDrawer({
  patient,
  branchId,
  open,
  onClose,
  onOpenProfile,
  showDockToggle = false,
  previewMode = "floating",
  onPreviewModeToggle,
}: {
  patient: PatientLookupRow | null;
  branchId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenProfile?: (patientId: string) => void;
  showDockToggle?: boolean;
  previewMode?: PatientHubPreviewMode;
  onPreviewModeToggle?: () => void;
}) {
  const isMobile = useIsMobilePreview();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        hideCloseButton
        className={cn(
          "flex flex-col p-0",
          isMobile
            ? "h-[100dvh] max-h-none w-full rounded-none"
            : "w-full sm:w-1/2 sm:max-w-none",
        )}
        data-testid={patientLookupTestIds.previewDrawer}
      >
        <PatientPreviewPanel
          patient={patient}
          branchId={branchId}
          open={open}
          onClose={onClose}
          onOpenProfile={onOpenProfile}
          showDockToggle={showDockToggle}
          previewMode={previewMode}
          onPreviewModeToggle={onPreviewModeToggle}
        />
      </SheetContent>
    </Sheet>
  );
}

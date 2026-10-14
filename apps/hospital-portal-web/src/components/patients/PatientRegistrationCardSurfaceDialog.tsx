'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import RegistrationCardPreview from '@/components/patients/RegistrationCardPreview';
import type { RegistrationCardPrintPatient } from '@/lib/patients/registration-card-print';

/**
 * Dedicated Registration Card surface — independent of the Add Patient wizard shell.
 */
export function PatientRegistrationCardSurfaceDialog({
  open,
  patient,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  patient: RegistrationCardPrintPatient | null;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open && Boolean(patient)}
      onOpenChange={(next) => {
        if (!next) onClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent
        size="xl"
        className="counselling-session max-h-[85vh] overflow-y-auto bg-white"
        data-testid="patient-registration-card-dialog"
      >
        <DialogHeader className="text-left">
          <DialogTitle>Registration Card</DialogTitle>
          <DialogDescription>Patient registration card</DialogDescription>
        </DialogHeader>
        {open && patient ? (
          <div data-testid="patient-registration-card">
            <RegistrationCardPreview patient={patient} />
          </div>
        ) : null}
        <div className="mt-3 flex justify-end border-t border-counselling-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            data-testid="registration-card-close"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

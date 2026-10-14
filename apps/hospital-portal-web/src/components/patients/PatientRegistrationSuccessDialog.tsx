'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatRegistrationCardMrnDisplay,
  type RegistrationCardPrintPatient,
} from '@/lib/patients/registration-card-print';

export type RegistrationSuccessPatient = RegistrationCardPrintPatient & {
  id: string;
};

/**
 * Post-create success surface — independent of the Add Patient wizard shell.
 */
export function PatientRegistrationSuccessDialog({
  open,
  patient,
  onOpenChange,
  onPrintRegistrationCard,
  onClose,
}: {
  open: boolean;
  patient: RegistrationSuccessPatient | null;
  onOpenChange: (open: boolean) => void;
  onPrintRegistrationCard: () => void;
  onClose: () => void;
}) {
  const mrn = formatRegistrationCardMrnDisplay(patient?.medicalRecordNumber);

  return (
    <Dialog
      open={open && Boolean(patient?.id)}
      onOpenChange={(next) => {
        if (!next) onClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent
        size="sm"
        className="counselling-session gap-0 p-0 sm:max-w-md"
        data-testid="patient-registration-success-dialog"
      >
        <DialogHeader className="space-y-1 border-b border-counselling-border/60 px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold text-counselling-foreground">
            Patient Registered Successfully
          </DialogTitle>
          <DialogDescription className="text-sm text-counselling-muted-foreground">
            Registration is complete.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-col items-center px-4 py-6 text-center"
          data-testid="patient-registration-success"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-4 text-xs font-medium text-counselling-muted-foreground">
            Medical Record Number
          </p>
          <p
            className="mt-1 text-2xl font-semibold tracking-wide text-counselling-foreground"
            data-testid="patient-registration-mrn"
          >
            {mrn}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onPrintRegistrationCard}
              data-testid="print-registration-card"
            >
              Print Registration Card
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="registration-success-close"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

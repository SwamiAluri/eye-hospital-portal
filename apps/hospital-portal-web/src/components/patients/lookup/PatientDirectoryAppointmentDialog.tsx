'use client';

import { useQueryClient } from '@tanstack/react-query';
import UnifiedAppointmentBooking from '@/components/appointments/UnifiedAppointmentBooking';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { patientLookupKeys } from '@/hooks/use-patient-lookup-queries';

export function PatientDirectoryAppointmentDialog({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="4xl"
        hideCloseButton
        className="max-h-[90vh] gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            Book an appointment for this patient without leaving the directory.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <UnifiedAppointmentBooking
            embedded
            resumePatientId={patientId}
            onClose={() => onOpenChange(false)}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: patientLookupKeys.all });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

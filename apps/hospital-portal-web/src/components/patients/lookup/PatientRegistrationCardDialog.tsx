'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import RegistrationCardPreview from '@/components/patients/RegistrationCardPreview';
import type { PatientLookupRow } from '@/types/patient-lookup';

/**
 * Map Directory lookup row → Registration Card patient.
 * Preserves authoritative photoThumbnailUrl as photoUrl (SoT: patient photo).
 */
export function registrationCardPatient(row: PatientLookupRow) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    medicalRecordNumber: row.mrn,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    contactNumber: row.phone ?? undefined,
    // Directory avatar SoT — do not drop (was the UAT photo defect).
    photoUrl: row.photoThumbnailUrl ?? undefined,
  };
}

/** Directory Registration column: Card only. Print stays inside the card preview. */
export function PatientHubRegistrationCell({ row }: { row: PatientLookupRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-flex min-h-7 items-center text-xs font-medium text-counselling-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
        aria-label="View registration card"
        onClick={() => setOpen(true)}
      >
        Card
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl" className="counselling-session max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader className="text-left">
            <DialogTitle>Registration Card</DialogTitle>
            <DialogDescription>Patient registration card</DialogDescription>
          </DialogHeader>
          {open ? (
            <RegistrationCardPreview patient={registrationCardPatient(row)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import RegistrationCardPreview from '@/components/patients/RegistrationCardPreview';
import { PatientDirectoryAppointmentDialog } from '@/components/patients/lookup/PatientDirectoryAppointmentDialog';
import { registrationCardPatient } from '@/components/patients/lookup/PatientRegistrationCardDialog';
import { useHasPermission } from '@/hooks/use-permissions';
import { buildFrontDeskCheckInHref } from '@/lib/patients/patient-handoff';
import {
  canDirectoryOfferBookAppointment,
  canDirectoryOfferCheckIn,
} from '@/lib/patients/patient-hub-row-display';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

interface PatientHubRowActionsProps {
  row: PatientLookupRow;
}

const actionClass =
  'inline-flex h-7 items-center whitespace-nowrap rounded-md px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40';

/**
 * Direct row actions (PD-DIR-UX Slice B.1A): Check-in · Print Card · Book appointment.
 * No overflow / three-dot menu. Uses existing permission and eligibility helpers.
 */
export function PatientHubRowActions({ row }: PatientHubRowActionsProps) {
  const canBookAppointment =
    useHasPermission('appointment.view') && canDirectoryOfferBookAppointment(row);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const showCheckIn = canDirectoryOfferCheckIn(row);

  const items: ReactNode[] = [];
  if (showCheckIn) {
    items.push(
      <Link
        key="check-in"
        href={buildFrontDeskCheckInHref(row.id)}
        className={cn(
          actionClass,
          'text-counselling-foreground hover:bg-counselling-muted/40',
        )}
        data-testid={patientLookupTestIds.rowCheckIn(row.id)}
      >
        Check-in
      </Link>,
    );
  }
  items.push(
    <button
      key="print"
      type="button"
      className={cn(
        actionClass,
        'text-counselling-primary underline-offset-2 hover:underline',
      )}
      aria-label="Print Card"
      data-testid={patientLookupTestIds.rowPrintCard(row.id)}
      onClick={() => setCardOpen(true)}
    >
      Print Card
    </button>,
  );
  if (canBookAppointment) {
    items.push(
      <button
        key="book"
        type="button"
        className={cn(
          actionClass,
          'text-counselling-foreground hover:bg-counselling-muted/40',
        )}
        data-testid={patientLookupTestIds.rowBook(row.id)}
        onClick={() => setBookingOpen(true)}
      >
        Book appointment
      </button>,
    );
  }

  return (
    <div
      className="inline-flex max-w-full flex-nowrap items-center justify-start gap-x-0.5 overflow-hidden"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      data-testid={patientLookupTestIds.rowActions(row.id)}
    >
      {items.map((item, index) => (
        <span key={index === 0 ? 'lead' : `sep-${index}`} className="contents">
          {index > 0 && (
            <span
              className="mx-0.5 select-none text-counselling-border"
              aria-hidden
            >
              ·
            </span>
          )}
          {item}
        </span>
      ))}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent size="xl" className="counselling-session max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader className="text-left">
            <DialogTitle>Registration Card</DialogTitle>
            <DialogDescription>Patient registration card</DialogDescription>
          </DialogHeader>
          {cardOpen ? (
            <RegistrationCardPreview patient={registrationCardPatient(row)} />
          ) : null}
        </DialogContent>
      </Dialog>
      {canBookAppointment && (
        <PatientDirectoryAppointmentDialog
          patientId={row.id}
          open={bookingOpen}
          onOpenChange={setBookingOpen}
        />
      )}
    </div>
  );
}

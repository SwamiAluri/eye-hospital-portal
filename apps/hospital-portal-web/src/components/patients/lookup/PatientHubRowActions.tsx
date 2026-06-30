'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, LogIn, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import type { PatientLookupRow } from '@/types/patient-lookup';

interface PatientHubRowActionsProps {
  row: PatientLookupRow;
  onPreview: () => void;
}

export function PatientHubRowActions({ row, onPreview }: PatientHubRowActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      data-testid={patientLookupTestIds.rowActions(row.id)}
    >
      <Link
        href={patientProfileUrl(row.id)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md"
        data-testid={patientLookupTestIds.rowView(row.id)}
      >
        <Eye className="w-3.5 h-3.5" />
        View
      </Link>
      <Link
        href={`/dashboard/frontdesk/check-in?patientId=${row.id}`}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-md"
        data-testid={patientLookupTestIds.rowCheckIn(row.id)}
      >
        <LogIn className="w-3.5 h-3.5" />
        Check-in
      </Link>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            data-testid={patientLookupTestIds.rowMenu(row.id)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onPreview}>Quick preview</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={patientProfileUrl(row.id)}>Open full profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/appointments/schedule?patientId=${row.id}`}>
              Book appointment
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

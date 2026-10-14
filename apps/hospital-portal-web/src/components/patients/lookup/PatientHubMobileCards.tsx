"use client";

import Link from "next/link";
import { PatientAvatar } from "@/components/patients/PatientAvatar";
import {
  PatientHubLocationCell,
  PatientHubMobileContextLine,
  PatientHubNextAppointmentCell,
  PatientHubPhoneCell,
  PatientHubProviderCell,
} from "@/components/patients/lookup/PatientHubContextCluster";
import { PatientHubRowActions } from "@/components/patients/lookup/PatientHubRowActions";
import { formatPatientDisplayName } from "@/lib/patients/patient-display-utils";
import { formatPatientHubIdentityLine } from "@/lib/patients/patient-hub-row-display";
import { shouldActivateRowPreview } from "@/lib/patients/patient-hub-row-activation";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { patientProfileUrl } from "@/lib/patients/patient-routes";
import type { PatientLookupRow } from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

export interface PatientHubMobileCardsProps {
  rows: PatientLookupRow[];
  previewId: string | null;
  isLoading: boolean;
  isError: boolean;
  isReady: boolean;
  onRowClick: (row: PatientLookupRow) => void;
  onOpenProfile: (patientId: string) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

export function PatientHubMobileCards({
  rows,
  previewId,
  isLoading,
  isError,
  isReady,
  onRowClick,
  onOpenProfile,
  emptyTitle = "No patients match your filters.",
  emptyHint,
}: PatientHubMobileCardsProps) {
  if (isLoading) {
    return (
      <div
        className="md:hidden px-4 py-12 text-center"
        role="status"
        data-testid={patientLookupTestIds.mobileListState}
      >
        <p className="inline-flex items-center gap-2 text-sm font-medium text-counselling-foreground">
          Loading patients…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="md:hidden px-4 py-12 text-center"
        role="alert"
        data-testid={patientLookupTestIds.mobileListState}
      >
        <p className="text-sm font-medium text-red-800">Could not load patients</p>
        <p className="mt-1 text-xs leading-relaxed text-counselling-muted-foreground">
          Use Refresh to try again.
        </p>
      </div>
    );
  }

  if (isReady && rows.length === 0) {
    return (
      <div
        className="md:hidden px-4 py-12 text-center"
        role="status"
        data-testid={patientLookupTestIds.mobileListState}
      >
        <p className="text-sm font-medium text-counselling-foreground">{emptyTitle}</p>
        {emptyHint && (
          <p className="mt-1 text-xs leading-relaxed text-counselling-muted-foreground">{emptyHint}</p>
        )}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div
      className="space-y-2 p-2 md:hidden"
      role="list"
      aria-label="Patient list"
      data-testid={patientLookupTestIds.mobileCards}
    >
      {rows.map((row) => {
        const identityLine = formatPatientHubIdentityLine(row);
        const isPreview = previewId === row.id;
        return (
          <article
            key={row.id}
            role="listitem"
            tabIndex={0}
            className={cn(
              "staff-worklist-row cursor-pointer rounded-xl border border-counselling-border/70 bg-counselling-card px-3 py-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40",
              isPreview && "counselling-selected-row",
            )}
            data-testid={patientLookupTestIds.mobileCard(row.id)}
            onClick={() => onRowClick(row)}
            onKeyDown={(event) => {
              if (!shouldActivateRowPreview(event)) return;
              event.preventDefault();
              onRowClick(row);
            }}
          >
            <div className="flex items-start gap-3">
              <PatientAvatar
                size="sm"
                firstName={row.firstName}
                lastName={row.lastName}
                photoUrl={row.photoThumbnailUrl}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={patientProfileUrl(row.id)}
                  className="text-sm font-semibold text-counselling-foreground hover:text-counselling-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(row.id);
                  }}
                  data-testid={patientLookupTestIds.patientNameLink(row.id)}
                >
                  {formatPatientDisplayName(row)}
                </Link>
                {identityLine && (
                  <p className="mt-0.5 text-[13px] font-medium leading-4 text-counselling-muted-foreground tabular-nums">{identityLine}</p>
                )}
                <div className="mt-2 space-y-1.5">
                  <PatientHubPhoneCell row={row} />
                  <PatientHubMobileContextLine row={row} />
                  <div className="space-y-0.5">
                    <PatientHubProviderCell row={row} />
                    <PatientHubLocationCell row={row} />
                  </div>
                  <PatientHubNextAppointmentCell row={row} />
                </div>
                <div className="mt-2 flex justify-end">
                  <PatientHubRowActions row={row} />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

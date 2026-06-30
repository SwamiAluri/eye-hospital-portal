"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { PatientAvatar } from "@/components/patients/PatientAvatar";
import { AcuityDot } from "@/components/patients/lookup/AcuityDot";
import { HighlightsPills } from "@/components/patients/lookup/HighlightsPills";
import { IpAdmittedBadge } from "@/components/patients/lookup/IpAdmittedBadge";
import { PatientHubRowActions } from "@/components/patients/lookup/PatientHubRowActions";
import { QueueStationCell } from "@/components/patients/lookup/QueueStationCell";
import { ReasonVisitCell } from "@/components/patients/lookup/ReasonVisitCell";
import {
  formatHubSchedule,
  formatPatientHubIdentityLine,
} from "@/lib/patients/patient-hub-row-display";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { patientProfileUrl } from "@/lib/patients/patient-routes";
import type { PatientLookupRow } from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

export interface PatientHubMobileCardsProps {
  rows: PatientLookupRow[];
  previewId: string | null;
  onRowClick: (row: PatientLookupRow) => void;
  onFavorite: (patientId: string) => void;
  onOpenProfile: (patientId: string) => void;
  onPreview: (row: PatientLookupRow) => void;
}

export function PatientHubMobileCards({
  rows,
  previewId,
  onRowClick,
  onFavorite,
  onOpenProfile,
  onPreview,
}: PatientHubMobileCardsProps) {
  return (
    <div
      className="space-y-3 md:hidden"
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
            className={cn(
              "rounded-xl border bg-white p-4 shadow-sm transition-colors",
              isPreview
                ? "border-emerald-400 ring-2 ring-emerald-100"
                : "border-gray-200",
            )}
            data-testid={patientLookupTestIds.mobileCard(row.id)}
            onClick={() => onRowClick(row)}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label={row.isFavorite ? "Remove favorite" : "Add favorite"}
                className="mt-1 text-gray-400 hover:text-amber-500"
                data-testid={patientLookupTestIds.favoriteButton(row.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(row.id);
                }}
              >
                <Star
                  className={cn(
                    "h-5 w-5",
                    row.isFavorite && "fill-amber-400 text-amber-400",
                  )}
                />
              </button>
              <PatientAvatar
                size="sm"
                firstName={row.firstName}
                lastName={row.lastName}
                photoUrl={row.photoThumbnailUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={patientProfileUrl(row.id)}
                      className="font-semibold text-emerald-800 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(row.id);
                      }}
                    >
                      {row.firstName} {row.lastName}
                    </Link>
                    {identityLine && (
                      <p className="mt-0.5 font-mono text-xs text-gray-600">{identityLine}</p>
                    )}
                    {row.phone && (
                      <p className="mt-0.5 text-xs text-gray-500">{row.phone}</p>
                    )}
                    <IpAdmittedBadge admission={row.ipAdmission} className="mt-2" />
                  </div>
                  <AcuityDot acuity={row.clinicalAcuity} />
                </div>
              </div>
              <PatientHubRowActions row={row} onPreview={() => onPreview(row)} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="col-span-2">
                <dt className="mb-1 text-gray-500">Reason / visit</dt>
                <dd>
                  <ReasonVisitCell row={row} />
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Schedule</dt>
                <dd className="text-gray-800">{formatHubSchedule(row.scheduledAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Queue / station</dt>
                <dd>
                  <QueueStationCell row={row} />
                </dd>
              </div>
              {row.assignedProviderName && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Assigned</dt>
                  <dd className="text-gray-800">
                    {row.assignedProviderName}
                    {row.assignedProviderRole ? ` · ${row.assignedProviderRole}` : ""}
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="mb-1 text-gray-500">Highlights</dt>
                <dd>
                  <HighlightsPills row={row} />
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

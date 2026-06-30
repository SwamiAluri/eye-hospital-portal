"use client";

import type { PatientIpAdmission } from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

export function IpAdmittedBadge({
  admission,
  className,
}: {
  admission?: PatientIpAdmission | null;
  className?: string;
}) {
  if (!admission?.isAdmitted) return null;

  const label = admission.wardName
    ? `IP · ${admission.wardName}`
    : "IP admitted";

  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md",
        "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
        className,
      )}
      title={
        admission.procedureName
          ? `${admission.clinicalState ?? "Admitted"} · ${admission.procedureName}`
          : admission.clinicalState ?? undefined
      }
    >
      {label}
    </span>
  );
}

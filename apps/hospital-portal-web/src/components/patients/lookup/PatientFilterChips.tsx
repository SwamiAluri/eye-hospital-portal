"use client";

import type { PatientLookupUrlState } from "@/lib/patients/patient-lookup-filters";
import {
  CARE_PROGRAM_OPTIONS,
  ENGAGEMENT_TYPE_OPTIONS,
  PATIENT_TYPE_OPTIONS,
} from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 hover:bg-emerald-100 hover:text-emerald-950"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function PatientFilterChips({
  state,
  onChange,
}: {
  state: PatientLookupUrlState;
  onChange: (next: PatientLookupUrlState) => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (state.favoritesOnly) {
    chips.push({
      key: "favorites",
      label: "Favorites",
      clear: () => onChange({ ...state, favoritesOnly: false }),
    });
  }
  if (state.assignedToMe) {
    chips.push({
      key: "assigned",
      label: "Assigned to me",
      clear: () => onChange({ ...state, assignedToMe: false }),
    });
  }
  state.engagementTypes?.forEach((t) => {
    const label =
      ENGAGEMENT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
    chips.push({
      key: `eng-${t}`,
      label: `Engagement: ${label}`,
      clear: () =>
        onChange({
          ...state,
          engagementTypes: state.engagementTypes?.filter((x) => x !== t),
        }),
    });
  });
  state.programCodes?.forEach((c) => {
    const label = CARE_PROGRAM_OPTIONS.find((o) => o.code === c)?.label ?? c;
    chips.push({
      key: `prog-${c}`,
      label: `Program: ${label}`,
      clear: () =>
        onChange({
          ...state,
          programCodes: state.programCodes?.filter((x) => x !== c),
        }),
    });
  });
  state.patientTypes?.forEach((t) => {
    chips.push({
      key: `type-${t}`,
      label: `Type: ${t}`,
      clear: () =>
        onChange({
          ...state,
          patientTypes: state.patientTypes?.filter((x) => x !== t),
        }),
    });
  });
  if (state.gender) {
    chips.push({
      key: "gender",
      label: `Gender: ${state.gender}`,
      clear: () => onChange({ ...state, gender: undefined }),
    });
  }
  if (state.mrn) {
    chips.push({
      key: "mrn",
      label: `MRN: ${state.mrn}`,
      clear: () => onChange({ ...state, mrn: undefined }),
    });
  }
  if (state.phone) {
    chips.push({
      key: "phone",
      label: `Phone: ${state.phone}`,
      clear: () => onChange({ ...state, phone: undefined }),
    });
  }
  if (state.name) {
    chips.push({
      key: "name",
      label: `Name: ${state.name}`,
      clear: () => onChange({ ...state, name: undefined }),
    });
  }
  if (state.diagnosis) {
    chips.push({
      key: "diagnosis",
      label: `Diagnosis: ${state.diagnosis}`,
      clear: () => onChange({ ...state, diagnosis: undefined }),
    });
  }
  if (state.providerId) {
    chips.push({
      key: "provider",
      label: "Provider selected",
      clear: () => onChange({ ...state, providerId: undefined }),
    });
  }
  if (state.departmentId) {
    chips.push({
      key: "department",
      label: "Department selected",
      clear: () =>
        onChange({ ...state, departmentId: undefined, providerId: undefined }),
    });
  }
  if (state.wardName) {
    chips.push({
      key: "ward",
      label: `Ward: ${state.wardName}`,
      clear: () => onChange({ ...state, wardName: undefined }),
    });
  }
  if (state.dobFrom || state.dobTo) {
    chips.push({
      key: "dob",
      label: `DOB: ${state.dobFrom ?? "…"} – ${state.dobTo ?? "…"}`,
      clear: () => onChange({ ...state, dobFrom: undefined, dobTo: undefined }),
    });
  }
  if (state.appointmentFrom || state.appointmentTo) {
    chips.push({
      key: "appointment",
      label: `Appointment: ${state.appointmentFrom ?? "…"} – ${state.appointmentTo ?? "…"}`,
      clear: () =>
        onChange({ ...state, appointmentFrom: undefined, appointmentTo: undefined }),
    });
  }
  if (state.admissionFrom || state.admissionTo) {
    chips.push({
      key: "admission",
      label: `Admission: ${state.admissionFrom ?? "…"} – ${state.admissionTo ?? "…"}`,
      clear: () =>
        onChange({ ...state, admissionFrom: undefined, admissionTo: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap gap-2 px-6 pb-3")}
      data-testid={patientLookupTestIds.filterChips}
    >
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.clear} />
      ))}
    </div>
  );
}

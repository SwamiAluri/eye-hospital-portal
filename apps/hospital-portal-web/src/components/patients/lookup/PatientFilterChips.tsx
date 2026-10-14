"use client";

import type { PatientLookupUrlState } from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { X } from "lucide-react";

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-1 rounded-full bg-counselling-muted px-2.5 py-0.5 text-[11px] font-semibold text-counselling-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 text-counselling-muted-foreground hover:bg-counselling-muted hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Gen-1 Directory chips: Gender + DOB range only.
 * Legacy advanced URL keys remain parseable/server-applied but are not chipped
 * (no UI path to create them). Clear All still wipes all filter keys via parent.
 */
export function PatientFilterChips({
  state,
  onChange,
  onClearAll,
}: {
  state: PatientLookupUrlState;
  onChange: (next: PatientLookupUrlState) => void;
  onClearAll?: () => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (state.gender) {
    const genderLabel =
      state.gender.charAt(0).toUpperCase() + state.gender.slice(1).toLowerCase();
    chips.push({
      key: "gender",
      label: `Gender: ${genderLabel}`,
      clear: () => onChange({ ...state, gender: undefined }),
    });
  }

  if (state.dobFrom || state.dobTo) {
    chips.push({
      key: "dob",
      label: `DOB: ${state.dobFrom ?? "…"} – ${state.dobTo ?? "…"}`,
      clear: () => onChange({ ...state, dobFrom: undefined, dobTo: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-0.5"
      aria-label="Active filters"
      data-testid={patientLookupTestIds.filterChips}
    >
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.clear} />
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-counselling-muted-foreground hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

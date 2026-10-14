"use client";

/**
 * Patient Directory Gen-1 filter surface.
 * Exposed filters only: Gender + DOB range.
 * Search (name/MRN/phone/email) stays in PatientDirectorySearch.
 * Advanced / counselling / clinical / schedule filters are not exposed.
 *
 * Presentation:
 * - variant="inline" — toolbar row expansion (md+)
 * - variant="sheet" — right Sheet (<md)
 */

import { SessionDatePicker } from "@/components/counsellors-desk/session/primitives/SessionDatePicker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { PatientLookupUrlState } from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { useEffect, useState } from "react";

function LabeledField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "min-w-0"}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-counselling-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function PatientAdvancedFilterSheet({
  open,
  onOpenChange,
  state,
  onApply,
  variant = "sheet",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PatientLookupUrlState;
  onApply: (next: PatientLookupUrlState) => void;
  /** Desktop/tablet toolbar expansion vs mobile Sheet. */
  variant?: "sheet" | "inline";
  /** @deprecated Recent patients are not part of Gen-1 Directory filters. */
  onRecentPatientSelect?: unknown;
}) {
  const [draft, setDraft] = useState(state);

  useEffect(() => {
    if (open) setDraft(state);
  }, [open, state]);

  const apply = () => {
    onApply({ ...draft, page: 1 });
    onOpenChange(false);
  };

  /** Wipe Gen-1 + legacy filter keys; preserve branch/census/search/preview. */
  const clear = () => {
    const cleared: PatientLookupUrlState = {
      branchId: state.branchId,
      tab: state.tab,
      q: state.q,
      previewPatientId: state.previewPatientId,
      page: 1,
    };
    setDraft(cleared);
    onApply(cleared);
    onOpenChange(false);
  };

  const selectClass =
    "h-9 w-full rounded-lg border border-counselling-border bg-counselling-card px-2 text-sm text-counselling-foreground focus-visible:border-counselling-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/25";

  const genderSelect = (
    <select
      id="patient-hub-filter-gender"
      className={selectClass}
      value={draft.gender ?? ""}
      onChange={(e) =>
        setDraft({ ...draft, gender: e.target.value || undefined })
      }
      aria-label="Gender"
    >
      <option value="">All genders</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="other">Other</option>
    </select>
  );

  const dobFrom = (
    <SessionDatePicker
      id="patient-hub-filter-dob-from"
      value={draft.dobFrom ?? ""}
      onChange={(dobFrom) =>
        setDraft({ ...draft, dobFrom: dobFrom || undefined })
      }
      placeholder="DOB From"
      variant="scheduling"
      className="h-9 border-counselling-border bg-counselling-card text-sm font-normal text-counselling-foreground"
    />
  );

  const dobTo = (
    <SessionDatePicker
      id="patient-hub-filter-dob-to"
      value={draft.dobTo ?? ""}
      onChange={(dobTo) => setDraft({ ...draft, dobTo: dobTo || undefined })}
      placeholder="DOB To"
      variant="scheduling"
      className="h-9 border-counselling-border bg-counselling-card text-sm font-normal text-counselling-foreground"
    />
  );

  if (variant === "inline") {
    if (!open) return null;
    return (
      <div
        className="flex min-w-0 shrink-0 flex-wrap items-end gap-2"
        data-testid={patientLookupTestIds.filterInline}
        data-filter-surface="directory-gen1"
        role="group"
        aria-label="Filters"
      >
        <LabeledField
          label="Gender"
          htmlFor="patient-hub-filter-gender"
          className="min-w-[7.5rem] w-[7.5rem]"
        >
          {genderSelect}
        </LabeledField>
        <LabeledField
          label="DOB From"
          htmlFor="patient-hub-filter-dob-from"
          className="min-w-[9rem] w-[9rem]"
        >
          {dobFrom}
        </LabeledField>
        <LabeledField
          label="DOB To"
          htmlFor="patient-hub-filter-dob-to"
          className="min-w-[9rem] w-[9rem]"
        >
          {dobTo}
        </LabeledField>
        <div className="flex items-center gap-2 pb-px">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={clear}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-9"
            onClick={apply}
            data-testid={patientLookupTestIds.filterApply}
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        data-testid={patientLookupTestIds.filterSheet}
        data-filter-surface="directory-gen1"
      >
        <SheetHeader className="border-b border-counselling-border/70 px-5 pb-3 pt-5">
          <SheetTitle className="text-base font-semibold text-counselling-foreground">
            Filters
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <LabeledField label="Gender" htmlFor="patient-hub-filter-gender">
            {genderSelect}
          </LabeledField>

          <div>
            <p className="mb-2 text-xs font-medium text-counselling-foreground">
              Date of Birth
            </p>
            <div className="grid grid-cols-2 gap-2">
              <LabeledField label="From" htmlFor="patient-hub-filter-dob-from">
                {dobFrom}
              </LabeledField>
              <LabeledField label="To" htmlFor="patient-hub-filter-dob-to">
                {dobTo}
              </LabeledField>
            </div>
          </div>
        </div>

        <div className="flex flex-row justify-between gap-3 border-t border-counselling-border/70 px-5 py-3">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={clear}>
            Clear
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-9"
            onClick={apply}
            data-testid={patientLookupTestIds.filterApply}
          >
            Apply
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { PatientRecentPatientsSection } from "@/components/patients/lookup/PatientRecentPatientsSection";
import { PatientSavedFiltersSection } from "@/components/patients/lookup/PatientSavedFiltersSection";
import { SessionDatePicker } from "@/components/counsellors-desk/session/primitives/SessionDatePicker";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { departmentsApi, type Department } from "@/lib/api/departments.api";
import { getApi } from "@/lib/api";
import type { PatientLookupUrlState } from "@/lib/patients/patient-lookup-filters";
import {
  CARE_PROGRAM_OPTIONS,
  ENGAGEMENT_TYPE_OPTIONS,
  FILTER_SHEET_SECTIONS,
  PATIENT_TYPE_OPTIONS,
} from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import type { PatientRecentViewEntry } from "@/types/patient-lookup";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Hash,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const fieldClass =
  "w-full border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";

function TogglePill({
  active,
  label,
  onClick,
  rounded = "lg",
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  rounded?: "lg" | "full";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm border transition-colors",
        rounded === "full" ? "rounded-full" : "rounded-lg",
        active
          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
          : "bg-white border-gray-200 text-gray-600 hover:border-emerald-200 hover:text-emerald-800",
      )}
    >
      {label}
    </button>
  );
}

function MultiPills({
  options,
  selected,
  onChange,
  rounded = "lg",
}: {
  options: readonly { value: string; label: string }[] | readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  rounded?: "lg" | "full";
}) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div className="flex flex-wrap gap-2">
      {normalized.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <TogglePill
            key={opt.value}
            label={opt.label}
            active={active}
            rounded={rounded}
            onClick={() =>
              onChange(
                active
                  ? selected.filter((s) => s !== opt.value)
                  : [...selected, opt.value],
              )
            }
          />
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-sm font-medium text-gray-700">{children}</p>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
      />
      {label}
    </label>
  );
}

function IconField({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      {children}
    </div>
  );
}

interface DoctorOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function PatientAdvancedFilterSheet({
  open,
  onOpenChange,
  state,
  onApply,
  onRecentPatientSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PatientLookupUrlState;
  onApply: (next: PatientLookupUrlState) => void;
  onRecentPatientSelect?: (entry: PatientRecentViewEntry) => void;
}) {
  const [draft, setDraft] = useState(state);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (open) setDraft(state);
  }, [open, state]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingDepts(true);
      try {
        const depts = await departmentsApi.getAll();
        if (!cancelled) setDepartments(depts ?? []);
      } catch {
        if (!cancelled) setDepartments([]);
      } finally {
        if (!cancelled) setLoadingDepts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadDoctors = useCallback(async (departmentId: string) => {
    if (!departmentId) {
      setDoctors([]);
      return;
    }
    setLoadingDoctors(true);
    try {
      const { data } = await getApi().get<DoctorOption[]>("/users", {
        params: { departmentId, userType: "Doctor", status: "Active" },
      });
      setDoctors(data ?? []);
    } catch {
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    if (draft.departmentId) loadDoctors(draft.departmentId);
    else setDoctors([]);
  }, [draft.departmentId, loadDoctors]);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const apply = () => {
    onApply({ ...draft, page: 1 });
    onOpenChange(false);
  };

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-lg"
        data-testid={patientLookupTestIds.filterSheet}
      >
        <SheetHeader className="border-b border-gray-100 px-5 pb-3 pt-5">
          <SheetTitle className="text-base font-semibold text-gray-900">
            Filter patients
          </SheetTitle>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 pt-2">
            {FILTER_SHEET_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-emerald-200 hover:text-emerald-800"
              >
                {section.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {onRecentPatientSelect && (
            <PatientRecentPatientsSection
              variant="prominent"
              onSelect={onRecentPatientSelect}
            />
          )}

          <section ref={(el) => { sectionRefs.current.quick = el; }}>
            <SectionLabel>Quick filters</SectionLabel>
            <div className="space-y-2.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
              <FilterCheckbox
                label="Favorites"
                checked={!!draft.favoritesOnly}
                onChange={(favoritesOnly) => setDraft({ ...draft, favoritesOnly })}
              />
              <FilterCheckbox
                label="Assigned to me"
                checked={!!draft.assignedToMe}
                onChange={(assignedToMe) => setDraft({ ...draft, assignedToMe })}
              />
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.identity = el; }}>
            <SectionLabel>Identity</SectionLabel>
            <div className="space-y-2.5">
              <IconField icon={User}>
                <input
                  className={cn(fieldClass, "pl-9 pr-3")}
                  placeholder="Name"
                  value={draft.name ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value || undefined })
                  }
                />
              </IconField>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    DOB from
                  </p>
                  <SessionDatePicker
                    value={draft.dobFrom ?? ""}
                    onChange={(dobFrom) =>
                      setDraft({ ...draft, dobFrom: dobFrom || undefined })
                    }
                    placeholder="From"
                    variant="scheduling"
                  />
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    DOB to
                  </p>
                  <SessionDatePicker
                    value={draft.dobTo ?? ""}
                    onChange={(dobTo) =>
                      setDraft({ ...draft, dobTo: dobTo || undefined })
                    }
                    placeholder="To"
                    variant="scheduling"
                  />
                </div>
              </div>
              <IconField icon={Hash}>
                <input
                  className={cn(fieldClass, "pl-9 pr-3 font-mono text-xs")}
                  placeholder="MRN"
                  value={draft.mrn ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, mrn: e.target.value || undefined })
                  }
                />
              </IconField>
              <IconField icon={Phone}>
                <input
                  className={cn(fieldClass, "pl-9 pr-3")}
                  placeholder="Phone"
                  value={draft.phone ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value || undefined })
                  }
                />
              </IconField>
              <select
                className={cn(fieldClass, "px-3")}
                aria-label="Gender"
                value={draft.gender ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, gender: e.target.value || undefined })
                }
              >
                <option value="">Any gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.clinical = el; }}>
            <SectionLabel>Clinical</SectionLabel>
            <IconField icon={Stethoscope}>
              <input
                className={cn(fieldClass, "pl-9 pr-3")}
                placeholder="Diagnosis search"
                value={draft.diagnosis ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, diagnosis: e.target.value || undefined })
                }
              />
            </IconField>
          </section>

          <section ref={(el) => { sectionRefs.current.schedule = el; }}>
            <SectionLabel>Appointment range</SectionLabel>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <SessionDatePicker
                value={draft.appointmentFrom ?? ""}
                onChange={(appointmentFrom) =>
                  setDraft({ ...draft, appointmentFrom: appointmentFrom || undefined })
                }
                placeholder="From"
              />
              <SessionDatePicker
                value={draft.appointmentTo ?? ""}
                onChange={(appointmentTo) =>
                  setDraft({ ...draft, appointmentTo: appointmentTo || undefined })
                }
                placeholder="To"
              />
            </div>
            <SectionLabel>Admission range</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <SessionDatePicker
                value={draft.admissionFrom ?? ""}
                onChange={(admissionFrom) =>
                  setDraft({ ...draft, admissionFrom: admissionFrom || undefined })
                }
                placeholder="From"
              />
              <SessionDatePicker
                value={draft.admissionTo ?? ""}
                onChange={(admissionTo) =>
                  setDraft({ ...draft, admissionTo: admissionTo || undefined })
                }
                placeholder="To"
              />
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.location = el; }}>
            <SectionLabel>Provider &amp; location</SectionLabel>
            <div className="space-y-2.5">
              <select
                className={cn(fieldClass, "px-3")}
                value={draft.departmentId ?? ""}
                disabled={loadingDepts}
                onChange={(e) => {
                  const departmentId = e.target.value || undefined;
                  setDraft({ ...draft, departmentId, providerId: undefined });
                }}
              >
                <option value="">
                  {loadingDepts ? "Loading departments…" : "Any department"}
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
              <select
                className={cn(fieldClass, "px-3")}
                value={draft.providerId ?? ""}
                disabled={!draft.departmentId || loadingDoctors}
                onChange={(e) =>
                  setDraft({ ...draft, providerId: e.target.value || undefined })
                }
              >
                <option value="">
                  {!draft.departmentId
                    ? "Select department first"
                    : loadingDoctors
                      ? "Loading doctors…"
                      : "Any provider"}
                </option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.firstName} {doc.lastName}
                  </option>
                ))}
              </select>
              <input
                className={cn(fieldClass, "px-3")}
                placeholder="Ward name"
                value={draft.wardName ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, wardName: e.target.value || undefined })
                }
              />
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.care = el; }}>
            <SectionLabel>Care programs</SectionLabel>
            <MultiPills
              rounded="full"
              options={CARE_PROGRAM_OPTIONS.map((o) => ({
                value: o.code,
                label: o.label,
              }))}
              selected={draft.programCodes ?? []}
              onChange={(programCodes) => setDraft({ ...draft, programCodes })}
            />
            <div className="mt-5">
              <SectionLabel>Engagements</SectionLabel>
              <MultiPills
                options={ENGAGEMENT_TYPE_OPTIONS}
                selected={draft.engagementTypes ?? []}
                onChange={(engagementTypes) =>
                  setDraft({ ...draft, engagementTypes })
                }
              />
            </div>
            <div className="mt-5">
              <SectionLabel>Patient type</SectionLabel>
              <MultiPills
                options={PATIENT_TYPE_OPTIONS}
                selected={draft.patientTypes ?? []}
                onChange={(patientTypes) => setDraft({ ...draft, patientTypes })}
              />
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.saved = el; }}>
            <PatientSavedFiltersSection
              draft={draft}
              onApply={(filters) => {
                setDraft(filters);
                onApply(filters);
                onOpenChange(false);
              }}
            />
          </section>
        </div>

        <SheetFooter className="flex-row gap-3 border-t border-gray-100 px-5 py-4 sm:justify-between">
          <button
            type="button"
            onClick={clear}
            className="px-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            data-testid={patientLookupTestIds.filterApply}
          >
            Apply
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

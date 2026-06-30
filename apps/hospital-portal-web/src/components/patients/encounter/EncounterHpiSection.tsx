'use client';

import { useEffect, useState } from 'react';
import { clinicalApi, type HpiTemplateCategory } from '@/lib/api/clinical.api';
import type { EncounterHpiState } from '@/lib/patients/encounter-types';
import { patientEncounterTestIds } from '@/lib/patients/patient-encounter-test-ids';

interface EncounterHpiSectionProps {
  value: EncounterHpiState;
  onChange: (next: EncounterHpiState) => void;
  disabled?: boolean;
}

function togglePill(selected: string[], pill: string): string[] {
  return selected.includes(pill) ? selected.filter((p) => p !== pill) : [...selected, pill];
}

export function EncounterHpiSection({ value, onChange, disabled }: EncounterHpiSectionProps) {
  const [templates, setTemplates] = useState<HpiTemplateCategory[]>([]);

  useEffect(() => {
    clinicalApi.getHpiTemplates().then(setTemplates).catch(console.error);
  }, []);

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={patientEncounterTestIds.hpiSection}
    >
      <h2 className="text-base font-semibold text-slate-900">History of present illness</h2>
      <p className="mt-1 text-sm text-slate-600">Select structured findings, then add narrative detail.</p>

      <div className="mt-4 space-y-4">
        {templates.map((category) => {
          const selected = value.selectedPills[category.category] ?? [];
          return (
            <div key={category.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {category.pills.map((pill) => {
                  const active = selected.includes(pill);
                  return (
                    <button
                      key={pill}
                      type="button"
                      disabled={disabled}
                      data-testid={patientEncounterTestIds.hpiPill(category.category, pill)}
                      onClick={() =>
                        onChange({
                          ...value,
                          selectedPills: {
                            ...value.selectedPills,
                            [category.category]: togglePill(selected, pill),
                          },
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        active
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                      } disabled:opacity-50`}
                    >
                      {pill}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="encounter-hpi-notes">
        Free text
      </label>
      <textarea
        id="encounter-hpi-notes"
        data-testid={patientEncounterTestIds.hpiFreeText}
        disabled={disabled}
        value={value.freeText}
        onChange={(e) => onChange({ ...value, freeText: e.target.value })}
        rows={4}
        placeholder="Additional HPI narrative…"
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
      />
    </section>
  );
}

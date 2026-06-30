'use client';

import { PHYSICAL_EXAM_TEMPLATES, type EncounterPhysicalExamState } from '@/lib/patients/encounter-types';
import { patientEncounterTestIds } from '@/lib/patients/patient-encounter-test-ids';

interface EncounterPhysicalExamSectionProps {
  value: EncounterPhysicalExamState;
  onChange: (next: EncounterPhysicalExamState) => void;
  disabled?: boolean;
}

export function EncounterPhysicalExamSection({
  value,
  onChange,
  disabled,
}: EncounterPhysicalExamSectionProps) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={patientEncounterTestIds.physicalExamSection}
    >
      <h2 className="text-base font-semibold text-slate-900">Physical examination</h2>
      <p className="mt-1 text-sm text-slate-600">Apply a template or document findings in free text.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PHYSICAL_EXAM_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            data-testid={patientEncounterTestIds.peTemplate(template.id)}
            onClick={() =>
              onChange({
                templateId: template.id,
                notes: template.text,
              })
            }
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value.templateId === template.id
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
            } disabled:opacity-50`}
          >
            {template.label}
          </button>
        ))}
      </div>

      <textarea
        data-testid={patientEncounterTestIds.peNotes}
        disabled={disabled}
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        rows={5}
        placeholder="Physical exam findings…"
        className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
      />
    </section>
  );
}

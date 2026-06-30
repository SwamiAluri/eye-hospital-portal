'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { clinicalApi, type MedicationSuggestion } from '@/lib/api/clinical.api';
import type { EncounterMedicationsState } from '@/lib/patients/encounter-types';
import { patientEncounterTestIds } from '@/lib/patients/patient-encounter-test-ids';

interface EncounterMedicationsSectionProps {
  patientId: string;
  diagnosis?: string | null;
  value: EncounterMedicationsState;
  onChange: (next: EncounterMedicationsState) => void;
  disabled?: boolean;
}

export function EncounterMedicationsSection({
  patientId,
  diagnosis,
  value,
  onChange,
  disabled,
}: EncounterMedicationsSectionProps) {
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    clinicalApi
      .getMedicationSuggestions(patientId, diagnosis ?? undefined)
      .then(setSuggestions)
      .catch(console.error);
  }, [patientId, diagnosis]);

  const addMedication = (item: { name: string; dosage?: string; frequency?: string; source?: string }) => {
    if (!item.name.trim()) return;
    if (value.quickAdds.some((m) => m.name.toLowerCase() === item.name.toLowerCase())) return;
    onChange({
      ...value,
      quickAdds: [...value.quickAdds, item],
    });
  };

  const removeMedication = (name: string) => {
    onChange({
      ...value,
      quickAdds: value.quickAdds.filter((m) => m.name !== name),
    });
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={patientEncounterTestIds.medicationsSection}
    >
      <h2 className="text-base font-semibold text-slate-900">Medications</h2>
      <p className="mt-1 text-sm text-slate-600">One-click suggestions from history and common ophthalmology meds.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.source}-${suggestion.name}`}
            type="button"
            disabled={disabled}
            data-testid={patientEncounterTestIds.medSuggestion(suggestion.name)}
            onClick={() =>
              addMedication({
                name: suggestion.name,
                dosage: suggestion.dosage ?? undefined,
                frequency: suggestion.frequency ?? undefined,
                source: suggestion.source,
              })
            }
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:border-emerald-300 disabled:opacity-50"
          >
            {suggestion.name}
            {suggestion.frequency ? ` · ${suggestion.frequency}` : ''}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          data-testid={patientEncounterTestIds.medCustomInput}
          disabled={disabled}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Custom medication"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
        />
        <button
          type="button"
          disabled={disabled || !customName.trim()}
          data-testid={patientEncounterTestIds.medCustomAdd}
          onClick={() => {
            addMedication({ name: customName.trim(), source: 'custom' });
            setCustomName('');
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {value.quickAdds.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid={patientEncounterTestIds.medList}>
          {value.quickAdds.map((med) => (
            <li
              key={med.name}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-slate-900">{med.name}</span>
                {(med.dosage || med.frequency) && (
                  <span className="text-slate-600">
                    {' '}
                    — {[med.dosage, med.frequency].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${med.name}`}
                onClick={() => removeMedication(med.name)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        data-testid={patientEncounterTestIds.medNotes}
        disabled={disabled}
        value={value.notes ?? ''}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        rows={2}
        placeholder="Medication notes / counselling points…"
        className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
      />
    </section>
  );
}

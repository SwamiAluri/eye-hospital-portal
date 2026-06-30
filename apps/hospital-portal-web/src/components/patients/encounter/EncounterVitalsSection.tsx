'use client';

import type { EncounterVitalsState } from '@/lib/patients/encounter-types';
import { patientEncounterTestIds } from '@/lib/patients/patient-encounter-test-ids';

interface EncounterVitalsSectionProps {
  value: EncounterVitalsState;
  onChange: (next: EncounterVitalsState) => void;
  disabled?: boolean;
}

function NumberField({
  label,
  testId,
  value,
  onChange,
  disabled,
  min,
  max,
  step = 1,
}: {
  label: string;
  testId?: string;
  value?: number | null;
  onChange: (next?: number | null) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        data-testid={testId}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
      />
    </label>
  );
}

export function EncounterVitalsSection({ value, onChange, disabled }: EncounterVitalsSectionProps) {
  const patch = (partial: Partial<EncounterVitalsState>) => onChange({ ...value, ...partial });

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={patientEncounterTestIds.vitalsSection}
    >
      <h2 className="text-base font-semibold text-slate-900">Vitals</h2>
      <p className="mt-1 text-sm text-slate-600">General vitals plus ophthalmology-specific measures.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label="Heart rate (bpm)"
          testId={patientEncounterTestIds.vitalsHeartRate}
          value={value.heartRate}
          onChange={(heartRate) => patch({ heartRate })}
          disabled={disabled}
          min={30}
          max={220}
        />
        <NumberField
          label="Temperature (°C)"
          testId={patientEncounterTestIds.vitalsTemperature}
          value={value.temperature}
          onChange={(temperature) => patch({ temperature })}
          disabled={disabled}
          min={34}
          max={42}
          step={0.1}
        />
        <NumberField
          label="BP systolic"
          testId={patientEncounterTestIds.vitalsBpSystolic}
          value={value.bpSystolic}
          onChange={(bpSystolic) => patch({ bpSystolic })}
          disabled={disabled}
          min={60}
          max={260}
        />
        <NumberField
          label="BP diastolic"
          testId={patientEncounterTestIds.vitalsBpDiastolic}
          value={value.bpDiastolic}
          onChange={(bpDiastolic) => patch({ bpDiastolic })}
          disabled={disabled}
          min={30}
          max={160}
        />
        <NumberField
          label="SpO₂ (%)"
          value={value.oxygenSaturation}
          onChange={(oxygenSaturation) => patch({ oxygenSaturation })}
          disabled={disabled}
          min={70}
          max={100}
        />
        <NumberField
          label="IOP OD (mmHg)"
          testId={patientEncounterTestIds.vitalsIopOd}
          value={value.iopOd}
          onChange={(iopOd) => patch({ iopOd })}
          disabled={disabled}
          min={0}
          max={80}
        />
        <NumberField
          label="IOP OS (mmHg)"
          testId={patientEncounterTestIds.vitalsIopOs}
          value={value.iopOs}
          onChange={(iopOs) => patch({ iopOs })}
          disabled={disabled}
          min={0}
          max={80}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Visual acuity OD</span>
          <input
            type="text"
            data-testid={patientEncounterTestIds.vitalsVaOd}
            disabled={disabled}
            value={value.visualAcuityOd ?? ''}
            onChange={(e) => patch({ visualAcuityOd: e.target.value })}
            placeholder="e.g. 6/6"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Visual acuity OS</span>
          <input
            type="text"
            data-testid={patientEncounterTestIds.vitalsVaOs}
            disabled={disabled}
            value={value.visualAcuityOs ?? ''}
            onChange={(e) => patch({ visualAcuityOs: e.target.value })}
            placeholder="e.g. 6/9"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="encounter-vitals-notes">
        Notes
      </label>
      <textarea
        id="encounter-vitals-notes"
        disabled={disabled}
        value={value.notes ?? ''}
        onChange={(e) => patch({ notes: e.target.value })}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
      />
    </section>
  );
}

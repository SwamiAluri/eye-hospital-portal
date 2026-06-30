'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Eye,
  Gauge,
  Heart,
  Ruler,
  Scale,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { PatientSummary } from '@/types/patient-lookup';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

type Vitals = NonNullable<PatientSummary['latestVitals']>;

interface VitalCard {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
}

function formatVisualAcuity(vitals: Vitals): string | null {
  const { visualAcuityOd, visualAcuityOs } = vitals;
  if (visualAcuityOd && visualAcuityOs) return `OD ${visualAcuityOd} · OS ${visualAcuityOs}`;
  if (visualAcuityOd) return `OD ${visualAcuityOd}`;
  if (visualAcuityOs) return `OS ${visualAcuityOs}`;
  return null;
}

function formatIop(vitals: Vitals): string | null {
  const { iopOd, iopOs } = vitals;
  if (iopOd != null && iopOs != null) return `OD ${iopOd} · OS ${iopOs} mmHg`;
  if (iopOd != null) return `OD ${iopOd} mmHg`;
  if (iopOs != null) return `OS ${iopOs} mmHg`;
  return null;
}

function buildVitalCards(vitals: Vitals): VitalCard[] {
  const cards: VitalCard[] = [];

  if (vitals.bloodPressureSystolic != null) {
    cards.push({
      key: 'bp',
      label: 'Blood pressure',
      value: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic ?? '—'} mmHg`,
      icon: Activity,
      iconClass: 'text-rose-600 bg-rose-50',
    });
  }

  if (vitals.heartRate != null) {
    cards.push({
      key: 'hr',
      label: 'Heart rate',
      value: `${vitals.heartRate} bpm`,
      icon: Heart,
      iconClass: 'text-red-600 bg-red-50',
    });
  }

  if (vitals.temperature != null) {
    cards.push({
      key: 'temp',
      label: 'Temperature',
      value: `${vitals.temperature}°C`,
      icon: Thermometer,
      iconClass: 'text-orange-600 bg-orange-50',
    });
  }

  if (vitals.oxygenSaturation != null) {
    cards.push({
      key: 'spo2',
      label: 'SpO₂',
      value: `${vitals.oxygenSaturation}%`,
      icon: Wind,
      iconClass: 'text-sky-600 bg-sky-50',
    });
  }

  const va = formatVisualAcuity(vitals);
  if (va) {
    cards.push({
      key: 'va',
      label: 'Visual acuity',
      value: va,
      icon: Eye,
      iconClass: 'text-violet-600 bg-violet-50',
    });
  }

  const iop = formatIop(vitals);
  if (iop) {
    cards.push({
      key: 'iop',
      label: 'IOP',
      value: iop,
      icon: Gauge,
      iconClass: 'text-indigo-600 bg-indigo-50',
    });
  }

  if (vitals.weightKg != null) {
    cards.push({
      key: 'weight',
      label: 'Weight',
      value: `${vitals.weightKg} kg`,
      icon: Scale,
      iconClass: 'text-emerald-600 bg-emerald-50',
    });
  }

  if (vitals.heightCm != null) {
    cards.push({
      key: 'height',
      label: 'Height',
      value: `${vitals.heightCm} cm`,
      icon: Ruler,
      iconClass: 'text-slate-600 bg-slate-50',
    });
  }

  return cards;
}

export function hasPreviewVitalsData(vitals: Vitals | null | undefined): boolean {
  if (!vitals) return false;
  return buildVitalCards(vitals).length > 0;
}

function VitalMetricCard({ card }: { card: VitalCard }) {
  const Icon = card.icon;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            card.iconClass,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {card.label}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900 leading-snug">{card.value}</p>
        </div>
      </div>
    </div>
  );
}

export function PreviewVitalsGrid({
  vitals,
  className,
  compact = false,
}: {
  vitals: Vitals | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!vitals || !hasPreviewVitalsData(vitals)) {
    return (
      <p
        className="text-sm text-gray-500"
        data-testid={patientLookupTestIds.previewVitalsEmpty}
      >
        No vitals recorded yet.
      </p>
    );
  }

  const cards = buildVitalCards(vitals);

  return (
    <div className={className} data-testid={patientLookupTestIds.previewVitalsGrid}>
      <div className={cn('grid grid-cols-2 gap-2', compact && 'gap-1.5')}>
        {cards.map((card) => (
          <VitalMetricCard key={card.key} card={card} />
        ))}
      </div>
      {vitals.recordedAt && (
        <p className="mt-2 text-xs text-gray-500">
          Last recorded {new Date(vitals.recordedAt).toLocaleString()}
          {vitals.isStale ? ' · may be outdated' : ''}
        </p>
      )}
    </div>
  );
}

export function PreviewVitalsTabEmpty({ vitals }: { vitals: Vitals | null | undefined }) {
  const hasVa = !!(vitals?.visualAcuityOd || vitals?.visualAcuityOs);
  const hasIop = vitals?.iopOd != null || vitals?.iopOs != null;
  const hasGeneral = hasPreviewVitalsData(vitals);

  if (!hasGeneral) {
    return <p className="text-sm text-gray-500">No vitals recorded yet.</p>;
  }

  const lines: string[] = [];
  if (!hasVa) lines.push('No visual acuity on file.');
  if (!hasIop) lines.push('No IOP on file.');

  if (lines.length === 0) {
    return <PreviewVitalsGrid vitals={vitals} compact />;
  }

  return (
    <div className="space-y-3">
      <PreviewVitalsGrid vitals={vitals} compact />
      {lines.map((line) => (
        <p key={line} className="text-sm text-gray-500">
          {line}
        </p>
      ))}
    </div>
  );
}

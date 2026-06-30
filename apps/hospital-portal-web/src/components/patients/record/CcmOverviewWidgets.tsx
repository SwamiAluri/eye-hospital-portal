'use client';

import { Target, BarChart3, Clock } from 'lucide-react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
      <Clock className="w-3 h-3" />
      API pending
    </span>
  );
}

export function CcmGoalsWidget() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4"
      data-testid={patientLookupTestIds.ccmGoalsWidget}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600" />
          Care goals
        </h3>
        <PendingBadge />
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Chronic care management goals will appear here when the care-plan service is connected.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-gray-500">
        <li className="rounded-lg border border-dashed border-gray-200 px-3 py-2">
          IOP target — awaiting care-plan API
        </li>
        <li className="rounded-lg border border-dashed border-gray-200 px-3 py-2">
          Medication adherence — awaiting care-plan API
        </li>
      </ul>
    </div>
  );
}

export function CcmQualityWidget() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4"
      data-testid={patientLookupTestIds.ccmQualityWidget}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          Quality measures
        </h3>
        <PendingBadge />
      </div>
      <p className="mt-3 text-sm text-gray-600">
        HEDIS-style quality measures and gaps in care will sync from CCM when available.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {['Diabetic eye exam', 'Post-op follow-up'].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

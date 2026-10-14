'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  notIntegratedMessage,
  patient360SectionLabel,
  type Patient360SectionKey,
} from '@/lib/patients/patient-360-sections';

const WIRED: Patient360SectionKey[] = [
  'overview',
  'clinical',
  'care',
  'documents',
  'coverage',
  'administration',
  'timeline',
];

export function Patient360SectionBody({ section }: { section: Patient360SectionKey }) {
  if (WIRED.includes(section)) return null;

  const label = patient360SectionLabel(section);
  return (
    <section
      id={`patient-360-panel-${section}`}
      role="tabpanel"
      aria-labelledby={`patient-360-tab-${section}`}
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel(section)}
    >
      <h2 className="text-base font-semibold text-gray-900">{label}</h2>
      <p className="mt-2 text-sm text-gray-700" role="status">
        {notIntegratedMessage(label)}
      </p>
    </section>
  );
}

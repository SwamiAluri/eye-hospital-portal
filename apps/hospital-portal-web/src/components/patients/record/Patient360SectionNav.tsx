'use client';

import type { KeyboardEvent } from 'react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  PATIENT_360_SECTIONS,
  type Patient360SectionKey,
} from '@/lib/patients/patient-360-sections';
import { cn } from '@/lib/utils';

function moveSection(active: Patient360SectionKey, key: string): Patient360SectionKey | null {
  const index = PATIENT_360_SECTIONS.findIndex((section) => section.key === active);
  if (index < 0) return null;
  const last = PATIENT_360_SECTIONS.length - 1;
  if (key === 'ArrowRight') return PATIENT_360_SECTIONS[(index + 1) % PATIENT_360_SECTIONS.length].key;
  if (key === 'ArrowLeft') return PATIENT_360_SECTIONS[(index - 1 + PATIENT_360_SECTIONS.length) % PATIENT_360_SECTIONS.length].key;
  if (key === 'Home') return PATIENT_360_SECTIONS[0].key;
  if (key === 'End') return PATIENT_360_SECTIONS[last].key;
  return null;
}

export function Patient360SectionNav({
  active,
  onSelect,
}: {
  active: Patient360SectionKey;
  onSelect: (section: Patient360SectionKey) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = moveSection(active, event.key);
    if (!next) return;
    event.preventDefault();
    onSelect(next);
    requestAnimationFrame(() => {
      document.getElementById(`patient-360-tab-${next}`)?.focus();
    });
  };

  return (
    <nav aria-label="Patient record" data-testid={patientLookupTestIds.recordSectionNav}>
      <div
        className="flex gap-1 overflow-x-auto px-2 pt-2"
        role="tablist"
        aria-label="Patient record"
        onKeyDown={onKeyDown}
      >
        {PATIENT_360_SECTIONS.map((section) => {
          const selected = section.key === active;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              id={`patient-360-tab-${section.key}`}
              aria-selected={selected}
              aria-current={selected ? 'page' : undefined}
              aria-controls={`patient-360-panel-${section.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(section.key)}
              className={cn(
                'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
                selected
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
              data-testid={patientLookupTestIds.recordSection(section.key)}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

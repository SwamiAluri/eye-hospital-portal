import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PatientLookupRow } from '@/types/patient-lookup';

import { HighlightsPills } from './HighlightsPills';

function row(overrides: Partial<PatientLookupRow> = {}): PatientLookupRow {
  return {
    id: 'patient-2',
    firstName: 'Alex',
    lastName: 'Lee',
    mrn: 'MRN-200',
    dateOfBirth: '1985-06-15',
    gender: 'M',
    isFavorite: false,
    careProgramCodes: [],
    clinicalAcuity: 'medium',
    activeEngagements: [],
    ...overrides,
  };
}

describe('HighlightsPills', () => {
  it('renders em dash when no programs or engagements', () => {
    const html = renderToStaticMarkup(<HighlightsPills row={row()} />);
    expect(html).toContain('—');
  });

  it('renders care program and engagement pills', () => {
    const html = renderToStaticMarkup(
      <HighlightsPills
        row={row({
          careProgramCodes: ['CATARACT'],
          activeEngagements: [{ type: 'opd', label: 'OPD' }],
        })}
      />,
    );
    expect(html).toContain('patient-hub-highlights-patient-2');
    expect(html).toContain('Cataract');
    expect(html).toContain('OPD');
  });

  it('shows +N overflow when more than three pills', () => {
    const html = renderToStaticMarkup(
      <HighlightsPills
        row={row({
          careProgramCodes: ['CATARACT', 'GLAUCOMA', 'RETINA', 'CORNEA'],
        })}
      />,
    );
    expect(html).toContain('+1');
  });
});

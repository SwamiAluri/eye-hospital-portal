import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientIdentificationBanner } from './PatientIdentificationBanner';
import { LATERALITY_MISSING_BLOCKER } from '@/lib/ip-management/operative-eye-display';

const base = {
  patientName: 'Tara Nair',
  uhid: 'UAT-033',
  patientAge: 66,
  patientDob: '1959-09-19',
  patientGender: 'F',
};

describe('PatientIdentificationBanner', () => {
  it('renders the laterality blocker rather than an empty banner slot when eyeOperated is null', () => {
    const html = renderToStaticMarkup(
      <PatientIdentificationBanner journey={{ ...base, eyeOperated: null }} />,
    );
    expect(html).toContain(LATERALITY_MISSING_BLOCKER);
    expect(html).toContain('ip-patient-ident-laterality-blocker');
    expect(html).toContain('Not set');
    expect(html).not.toContain('truncate');
    expect(html).not.toContain('ellipsis');
  });

  it('spells out RIGHT above OD and does not truncate identifiers', () => {
    const html = renderToStaticMarkup(
      <PatientIdentificationBanner journey={{ ...base, patientName: 'Meena Iyer', eyeOperated: 'OD' }} />,
    );
    expect(html).toContain('RIGHT');
    expect(html).toContain('OD');
    expect(html).toContain('Meena Iyer');
    expect(html).toContain('UAT-033');
    expect(html).not.toContain(LATERALITY_MISSING_BLOCKER);
    expect(html).not.toContain('truncate');
  });

  it('omits the alert strip entirely when no patient-level source is wired', () => {
    const html = renderToStaticMarkup(
      <PatientIdentificationBanner journey={{ ...base, eyeOperated: 'OD' }} />,
    );
    expect(html).not.toContain('ip-patient-ident-alerts');
    expect(html).not.toContain('No known allergies');
    expect(html).not.toContain('no known allergies');
  });

  it('renders No known allergies only when a source has cleared the question', () => {
    const html = renderToStaticMarkup(
      <PatientIdentificationBanner
        journey={{ ...base, eyeOperated: 'OD' }}
        clinicalAlerts={{ status: 'cleared' }}
      />,
    );
    expect(html).toContain('ip-patient-ident-alerts');
    expect(html).toContain('No known allergies');
  });

  it('hides the alert strip for the cashier even if alerts are present', () => {
    const html = renderToStaticMarkup(
      <PatientIdentificationBanner
        journey={{ ...base, eyeOperated: 'OD' }}
        hideAlertStrip
        clinicalAlerts={{ status: 'present', items: ['Allergy: Xylocaine'] }}
      />,
    );
    expect(html).not.toContain('Allergy: Xylocaine');
    expect(html).not.toContain('ip-patient-ident-alerts');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WristbandPrintDialog } from './WristbandPrintDialog';
import type { JourneySafetyTokenDto, PatientJourneyRowDto } from '@/lib/api/ip-management.api';

const journey: PatientJourneyRowDto = {
  id: 'j1',
  patientId: 'p1',
  uhid: 'UAT-002',
  patientName: 'Meena Iyer',
  eyeOperated: 'OD',
  procedureName: 'Phaco',
  packageAmount: 0,
  totalPaid: 0,
  balanceDue: 0,
  wardName: 'Day Care',
  bedNumber: 'C-04',
  clinicalState: 'Admitted',
  otState: 'NotSent',
  financialState: 'Draft',
  postOpState: 'NotStarted',
  admittedAt: '2026-08-25T02:30:00Z',
  surgeryScheduledAt: null,
  isLocked: false,
  isBillingLocked: false,
  admissionType: 'DayCare',
  patientGender: 'F',
  patientDob: '1972-03-12',
  patientAge: 54,
  paymentMode: null,
  isEmergencyFc: false,
  emergencyFcReason: null,
  otReturnReason: null,
  counselingSessionId: null,
  otDetailsSaved: false,
};

const token: JourneySafetyTokenDto = {
  id: 't1',
  journeyId: 'j1',
  tokenCode: 'WB-260825-00041',
  barcodeValue: 'WB-260825-00041|UAT-002|OD',
  laterality: 'OD',
  printedAt: '2026-08-25T02:35:00Z',
  createdAt: '2026-08-25T02:35:00Z',
};

describe('WristbandPrintDialog', () => {
  it('spells RIGHT, shows UHID and token, and does not use colour as the only laterality cue', () => {
    const html = renderToStaticMarkup(
      <WristbandPrintDialog journey={journey} token={token} onClose={() => undefined} /> as React.ReactElement,
    );
    expect(html).toContain('Meena Iyer');
    expect(html).toContain('UAT-002');
    expect(html).toContain('RIGHT');
    expect(html).toContain('(OD)');
    expect(html).toContain('WB-260825-00041');
    expect(html).toContain('OPERATING EYE');
    expect(html).toContain('ward-wristband-print-sheet');
  });
});

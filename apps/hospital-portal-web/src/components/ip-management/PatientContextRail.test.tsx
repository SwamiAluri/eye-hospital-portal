import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientContextRail } from './PatientContextRail';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { buildIpRowSituation } from '@/lib/ip-management/ip-row-situation';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { LATERALITY_MISSING_BLOCKER } from '@/lib/ip-management/operative-eye-display';
import { NO_KNOWN_ALLERGIES_LABEL } from '@/lib/ip-management/clinical-alerts';

function journey(partial: Partial<PatientJourneyRowDto> = {}): PatientJourneyRowDto {
  return {
    id: 'j1',
    patientId: 'p1',
    uhid: 'UAT-002',
    patientName: 'Meena Iyer',
    eyeOperated: 'OD',
    procedureName: 'LASIK',
    packageAmount: 120000,
    totalPaid: 30000,
    balanceDue: 90000,
    wardName: 'Day Care',
    bedNumber: 'B-04',
    clinicalState: 'Admitted',
    otState: 'NotSent',
    financialState: 'PartiallyPaid',
    postOpState: 'NotStarted',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'DayCare',
    patientGender: 'F',
    patientDob: '1972-03-14',
    patientAge: 54,
    paymentMode: 'Insurance',
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    ...partial,
  };
}

const noop = () => undefined;
const railHandlers = {
  onClose: noop,
  onPrimary: noop,
  onOpenBilling: noop,
  onOpenRecord: noop,
  onTransferBed: noop,
  onOpenWard: noop,
  onOpenOt: noop,
  onToggleEmergencyFc: noop,
  onEmergencyReasonChange: noop,
  onEmergencyFcSubmit: noop,
  onDischargeOverride: noop,
};

function renderRail(
  persona: 'ward' | 'coordinator' | 'cashier' | 'clinical' | 'admin',
  permissions: string[],
  row: PatientJourneyRowDto = journey(),
  extra: Partial<React.ComponentProps<typeof PatientContextRail>> = {},
) {
  return renderToStaticMarkup(
    <PatientContextRail
      journey={row}
      persona={persona}
      actions={resolveIpRoleActions(permissions)}
      situation={buildIpRowSituation(row)}
      finSummary={{
        billedAmount: 120000,
        totalCollected: 30000,
        balanceDue: 90000,
        patientResponsibility: 90000,
        billNumber: 'IPD-2026-00841',
      }}
      preauth={{
        allowed: true,
        warningLevel: 'none',
        warningMessage: null,
        blockReason: null,
        preAuthNumber: 'PA-1',
        approvedAmount: 80000,
        coverageStatus: 'Approved',
        payerShareAmount: 80000,
      }}
      auditLogs={[]}
      auditLoading={false}
      actionBusy={false}
      actionError=""
      canApplyEmergencyFc={permissions.includes('*') || permissions.includes('ip.emergency_fc.apply')}
      showEmergencyFc={false}
      emergencyReason=""
      emergencySaving={false}
      {...railHandlers}
      {...extra}
    />,
  );
}

function countTestId(html: string, id: string): number {
  return html.split(`data-testid="${id}"`).length - 1;
}

describe('PatientContextRail personas', () => {
  it('ward: one primary, one billing link, no refund/adjust, no jargon', () => {
    const html = renderRail('ward', ['ward.checklist.edit', 'ip.billing.collect']);
    expect(countTestId(html, 'ip-rail-primary')).toBe(1);
    expect(html).toContain('Mark ready for OT');
    expect(html).toContain('Needs pre-op');
    expect(countTestId(html, 'ip-rail-open-billing')).toBe(1);
    expect(html).toContain('Open billing');
    expect(html).toContain('>Ward<');
    expect(html).toContain('>OT<');
    expect(html).toContain('>Record<');
    expect(html).not.toContain('Refund');
    expect(html).not.toContain('Financial adjustment');
    expect(html).not.toContain('OpdBill');
    expect(html).not.toContain('ip.billing');
    expect(html).not.toContain('What is owed');
    expect(html).not.toContain('MiniStepper');
    expect(html).not.toContain('Where is the patient');
    expect(countTestId(html, 'ip-rail-open-full-record')).toBe(1);
  });

  it('cashier: collect primary, no clinical action, no alert strip, no second billing link', () => {
    const html = renderRail('cashier', ['ip.billing.collect', 'bill.update']);
    expect(html).toContain('data-persona="cashier"');
    expect(html).toContain('Collect payment');
    expect(html).not.toContain('Mark ready for OT');
    expect(html).not.toContain('Admit to ward');
    expect(countTestId(html, 'ip-rail-open-billing')).toBe(0);
    expect(countTestId(html, 'ip-rail-primary')).toBe(1);
    expect(html).not.toContain('ip-patient-ident-alerts');
    expect(html).not.toContain(NO_KNOWN_ALLERGIES_LABEL);
  });

  it('clinical: no money, no coverage, no refund, laterality blocker when eye is null', () => {
    const html = renderRail('clinical', ['ot.safety.sign'], journey({ eyeOperated: null }));
    expect(html).toContain(LATERALITY_MISSING_BLOCKER);
    expect(html).not.toContain('Open billing');
    expect(html).not.toContain('Patient due');
    expect(html).not.toContain('Coverage');
    expect(html).not.toContain('Refund');
    expect(countTestId(html, 'ip-rail-primary')).toBe(1);
  });

  it('nurse permissions never surface refund or adjust', () => {
    const html = renderRail('ward', ['ward.checklist.edit', 'ip.admit', 'ip.ot.mark_ready']);
    expect(html).not.toContain('Refund');
    expect(html).not.toContain('Financial adjustment');
    expect(html).not.toContain('Collect payment');
  });

  it('disables Mark Ready and lists unsigned consent with Open step before any click', () => {
    const html = renderRail('ward', ['ward.checklist.edit', 'ip.ot.mark_ready'], journey(), {
      onOpenPreopStep: noop,
      markReadyGates: {
        canMarkReady: false,
        hardBlocks: [{
          code: 'surgical_consent_unsigned',
          message: 'Surgical consent must be signed with the consent PDF on file.',
          severity: 'block',
          navigateStep: 'consent',
        }],
        softWarnings: [],
      },
    });
    expect(html).toContain('Surgical consent must be signed with the consent PDF on file.');
    expect(html).toContain('Open step');
    expect(html).toContain('ward-preop-mark-ready-block-surgical_consent_unsigned');
    expect(html).toMatch(/data-testid="ip-rail-primary"[^>]*disabled/);
    expect(html).not.toContain('Nothing blocking this step');
    expect(html).not.toContain('No listed blockers');
  });

  it('shows Revert ready for OT only with ip.ot.unmark_ready while ReadyForSurgery and not sent', () => {
    const ready = journey({ clinicalState: 'ReadyForSurgery', otState: 'NotSent' });
    const html = renderRail('ward', ['ip.ot.unmark_ready', 'ip.ot.mark_ready'], ready, {
      onUnmarkReady: noop,
    });
    expect(html).toContain('data-testid="ip-rail-unmark-ready"');
    expect(html).toContain('Revert ready for OT');
  });

  it('hides Revert ready for OT for ward-edit-only, cashier, and Admitted', () => {
    const ready = journey({ clinicalState: 'ReadyForSurgery', otState: 'NotSent' });
    const wardOnly = renderRail('ward', ['ward.checklist.edit'], ready, { onUnmarkReady: noop });
    expect(wardOnly).not.toContain('ip-rail-unmark-ready');

    const cashier = renderRail('cashier', ['ip.ot.unmark_ready', 'ip.billing.collect'], ready, {
      onUnmarkReady: noop,
    });
    expect(cashier).not.toContain('ip-rail-unmark-ready');

    const admitted = renderRail('ward', ['ip.ot.unmark_ready'], journey({ clinicalState: 'Admitted' }), {
      onUnmarkReady: noop,
    });
    expect(admitted).not.toContain('ip-rail-unmark-ready');
  });

  it('shows Print wristband only with ip.safety_token.print after admit', () => {
    const withPerm = renderRail('ward', ['ip.safety_token.print', 'ward.checklist.edit']);
    expect(withPerm).toContain('data-testid="ip-rail-print-wristband"');
    expect(withPerm).toContain('Print wristband');

    const noPerm = renderRail('ward', ['ward.checklist.edit', 'ip.admit']);
    expect(noPerm).not.toContain('ip-rail-print-wristband');
    expect(noPerm).toContain('Mark ready for OT');

    const expected = renderRail(
      'ward',
      ['ip.safety_token.print'],
      journey({ clinicalState: 'Expected' }),
    );
    expect(expected).not.toContain('ip-rail-print-wristband');
  });

  it('shows slot label and planned arrival on the location rail', () => {
    const html = renderRail('ward', ['ward.checklist.edit'], journey({
      slotLabel: 'AM-3',
      plannedArrivalAt: '2026-08-25T01:45:00Z',
    }));
    expect(html).toContain('AM-3');
    expect(html).toContain('Arrive');
  });

  it('does not expose CCMS remind from the census rail', () => {
    const html = renderRail('coordinator', ['*'], journey({ paymentMode: 'Insurance' }), {
      preauth: {
        allowed: false,
        warningLevel: 'block',
        warningMessage: 'Waiting',
        blockReason: null,
        preAuthNumber: null,
        approvedAmount: null,
        caseId: 'case-1',
        coverageState: 'WAITING_APPROVAL',
        decision: 'BLOCK',
      },
    });
    expect(html).toContain('coverage-context-block');
    expect(html).not.toContain('coverage-context-remind');
    expect(html).not.toContain('Remind CCMS team');
  });
});

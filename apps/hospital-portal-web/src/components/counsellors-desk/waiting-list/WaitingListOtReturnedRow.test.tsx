import {
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { WAITING_LIST_OT_GRID } from '@/lib/counsellors-desk/waiting-list-layout';

import {
  WaitingListOtReturnedRow,
  type WaitingListOtReturnedRowProps,
} from './WaitingListOtReturnedRow';

function baseRow(
  overrides: Partial<PatientJourneyRowDto> = {},
): PatientJourneyRowDto {
  return {
    id: 'journey-1',
    uhid: 'UHID-9001',
    patientName: 'Ravi Kumar',
    eyeOperated: 'LE',
    procedureName: 'Phaco + IOL',
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: null,
    bedNumber: null,
    clinicalState: 'Admitted',
    otState: 'Returned',
    financialState: 'Open',
    postOpState: 'None',
    admittedAt: null,
    surgeryScheduledAt: '2026-09-10T09:00:00.000Z',
    isLocked: false,
    isBillingLocked: false,
    admissionType: null,
    patientGender: null,
    patientDob: null,
    patientAge: null,
    paymentMode: null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: 'Equipment delay — lens unavailable',
    counselingSessionId: 'session-42',
    otDetailsSaved: false,
    ...overrides,
  };
}

function walkElements(
  node: ReactNode,
  visit: (el: ReactElement) => void,
): void {
  if (node == null || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, visit);
    return;
  }
  if (!isValidElement(node)) return;
  visit(node);
  const { children } = node.props as { children?: ReactNode };
  walkElements(children, visit);
}

function expandRow(props: WaitingListOtReturnedRowProps): ReactElement {
  const Comp = (
    WaitingListOtReturnedRow as unknown as {
      type: (p: WaitingListOtReturnedRowProps) => ReactElement;
    }
  ).type;
  return Comp(props);
}

describe('WaitingListOtReturnedRow', () => {
  it('renders procedure, return reason, OT grid, and Continue Counselling action', () => {
    const html = renderToStaticMarkup(
      <WaitingListOtReturnedRow
        row={baseRow()}
        index={0}
        onNavigate={vi.fn()}
      />,
    );

    expect(html).toContain(WAITING_LIST_OT_GRID);
    expect(html).toContain('Phaco + IOL');
    expect(html).toContain('Equipment delay');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('UHID-9001');
    expect(html).toContain('staff-worklist-row');
    expect(html).toContain('Continue Counselling');
    expect(html).toContain('waiting-list-ot-action-continue-counselling');
    expect(html).not.toContain('Re-plan');
    expect(html).not.toContain('Open journey');
    expect(html).toContain('border-l-2');
    expect(html).toContain('border-l-rose-400/70');
    expect(html).toContain('OT returned:');
  });

  it('navigates via continue href on action click', () => {
    const onNavigate = vi.fn();
    const tree = expandRow({
      row: baseRow({ counselingSessionId: 'session-42' }),
      index: 1,
      onNavigate,
    });

    let clicked = false;
    walkElements(tree, (el) => {
      const props = el.props as {
        'data-testid'?: string;
        onClick?: (e: MouseEvent) => void;
      };
      if (
        props['data-testid'] === 'waiting-list-ot-action-continue-counselling' &&
        props.onClick
      ) {
        props.onClick({} as MouseEvent);
        clicked = true;
      }
    });

    expect(clicked).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(
      '/dashboard/counsellors-desk/session-42?from=waiting-list',
    );
  });

  it('shows Start Counselling when counselingSessionId is missing', () => {
    const html = renderToStaticMarkup(
      <WaitingListOtReturnedRow
        row={baseRow({ counselingSessionId: null })}
        index={0}
        onNavigate={vi.fn()}
        onStartCounselling={vi.fn()}
      />,
    );

    expect(html).toContain('Start Counselling');
    expect(html).toContain('waiting-list-ot-action-start-counselling');
    expect(html).not.toContain('Open journey');
    expect(html).not.toContain('Continue Counselling');
  });

  it('invokes onStartCounselling for no-session rows', () => {
    const onStart = vi.fn();
    const row = baseRow({ counselingSessionId: null });
    const tree = expandRow({
      row,
      index: 0,
      onNavigate: vi.fn(),
      onStartCounselling: onStart,
    });

    walkElements(tree, (el) => {
      const props = el.props as {
        'data-testid'?: string;
        onClick?: (e: MouseEvent) => void;
      };
      if (
        props['data-testid'] === 'waiting-list-ot-action-start-counselling' &&
        props.onClick
      ) {
        props.onClick({} as MouseEvent);
      }
    });

    expect(onStart).toHaveBeenCalledWith(row);
  });

  it('does not change action by otReturnReason when session is present', () => {
    const reasons = [
      'Equipment delay — lens unavailable',
      'BP high',
      'Anaesthesia Contraindication',
    ];
    for (const otReturnReason of reasons) {
      const html = renderToStaticMarkup(
        <WaitingListOtReturnedRow
          row={baseRow({ otReturnReason, counselingSessionId: 'session-42' })}
          index={0}
          onNavigate={vi.fn()}
        />,
      );
      expect(html).toContain('Continue Counselling');
      expect(html).toContain('waiting-list-ot-action-continue-counselling');
    }
  });

  it('does not change action by otReturnReason when session is absent', () => {
    const reasons = ['Equipment delay', 'BP high', 'Uncontrolled Blood Sugar'];
    for (const otReturnReason of reasons) {
      const html = renderToStaticMarkup(
        <WaitingListOtReturnedRow
          row={baseRow({ otReturnReason, counselingSessionId: null })}
          index={0}
          onNavigate={vi.fn()}
          onStartCounselling={vi.fn()}
        />,
      );
      expect(html).toContain('Start Counselling');
      expect(html).toContain('waiting-list-ot-action-start-counselling');
      expect(html).not.toContain('Continue Counselling');
    }
  });
});

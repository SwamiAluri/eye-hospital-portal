import {
  type ReactElement,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { WaitingListPatient } from '@/types/counsellors-desk';
import {
  WaitingListWorkRow,
  type WaitingListWorkRowProps,
} from './WaitingListWorkRow';

function basePatient(
  overrides: Partial<WaitingListPatient> = {},
): WaitingListPatient {
  return {
    id: 'p-1',
    slNo: 3,
    uhid: 'UHID-1001',
    patientName: 'Anita Rao',
    eye: 'RE',
    type: 'Surgery',
    surgeryName: 'Phacoemulsification',
    patientType: 'Cash',
    age: 58,
    gender: 'Female',
    doctor: 'Dr. Mehta',
    time: '10:30',
    remarks: '',
    status: 'Pending',
    counselorId: null,
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<WaitingListWorkRowProps> = {},
): WaitingListWorkRowProps {
  return {
    patient: basePatient(),
    isSelected: false,
    activeTab: 'All',
    hasCcmsCase: false,
    currentUserId: 'amelia',
    onRowClick: vi.fn(),
    onDemographics: vi.fn(),
    onPreAuth: vi.fn(),
    onAssign: vi.fn(),
    onLifecycleAction: vi.fn(),
    canAssign: true,
    ...overrides,
  };
}

function expandRow(props: WaitingListWorkRowProps): ReactElement {
  const Comp = (
    WaitingListWorkRow as unknown as {
      type: (p: WaitingListWorkRowProps) => ReactElement;
    }
  ).type;
  return Comp(props);
}

describe('WaitingListWorkRow lifecycle CTAs (ownership claim)', () => {
  it('Pending + Unassigned shows Assign', () => {
    const html = renderToStaticMarkup(expandRow(baseProps()));
    expect(html).toContain('waiting-list-row-assign');
  });

  it('Done + Unassigned shows Re-evaluate (not Assign)', () => {
    const html = renderToStaticMarkup(
      expandRow(baseProps({ patient: basePatient({ status: 'Done', counselorId: null }) })),
    );
    expect(html).toContain('waiting-list-row-lifecycle-re-evaluate');
    expect(html).not.toContain('waiting-list-row-assign');
  });

  it('Done + other owner shows Re-evaluate (not Assign)', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'Done', counselorId: 'emma' }),
        }),
      ),
    );
    expect(html).toContain('waiting-list-row-lifecycle-re-evaluate');
    expect(html).not.toContain('waiting-list-row-assign');
  });

  it('Repeat + NULL shows Assign (not Start Repeat) when canAssign — PD-B', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'RepeatCounselling', counselorId: null }),
        }),
      ),
    );
    expect(html).toContain('waiting-list-row-assign');
    expect(html).not.toContain('waiting-list-row-lifecycle-start-repeat');
  });

  it('Done + current owner shows Re-evaluate', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'Done', counselorId: 'amelia' }),
        }),
      ),
    );
    expect(html).toContain('waiting-list-row-lifecycle-re-evaluate');
    expect(html).not.toContain('waiting-list-row-assign');
  });

  it('Repeat + current owner shows Start Repeat', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'RepeatCounselling', counselorId: 'amelia' }),
        }),
      ),
    );
    expect(html).toContain('waiting-list-row-lifecycle-start-repeat');
    expect(html).not.toContain('waiting-list-row-assign');
  });

  it('Repeat + other owner shows Start Repeat (not Assign)', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'RepeatCounselling', counselorId: 'emma' }),
        }),
      ),
    );
    expect(html).toContain('waiting-list-row-lifecycle-start-repeat');
    expect(html).not.toContain('waiting-list-row-assign');
  });

  it('Pending + current owner does not show Assign', () => {
    const html = renderToStaticMarkup(
      expandRow(
        baseProps({
          patient: basePatient({ status: 'Pending', counselorId: 'amelia' }),
        }),
      ),
    );
    expect(html).not.toContain('waiting-list-row-assign');
    expect(html).toContain('waiting-list-row-lifecycle-open');
    expect(html).toContain('Start Counseling');
    expect(html).not.toMatch(/>Open</);
  });
});

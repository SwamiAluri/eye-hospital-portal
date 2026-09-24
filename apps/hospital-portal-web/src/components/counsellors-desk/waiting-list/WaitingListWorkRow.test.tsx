import {
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { WAITING_LIST_WORK_GRID } from '@/lib/counsellors-desk/waiting-list-layout';
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
    onRowClick: vi.fn(),
    onDemographics: vi.fn(),
    onPreAuth: vi.fn(),
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

/** Expand memo-wrapped presentational row (no hooks) for prop walks. */
function expandRow(props: WaitingListWorkRowProps): ReactElement {
  const Comp = (
    WaitingListWorkRow as unknown as {
      type: (p: WaitingListWorkRowProps) => ReactElement;
    }
  ).type;
  return Comp(props);
}

function findButtonsByLabel(
  root: ReactNode,
  label: string,
): ReactElement[] {
  const matches: ReactElement[] = [];
  walkElements(root, (el) => {
    const props = el.props as {
      children?: ReactNode;
      'aria-label'?: string;
      onClick?: (e: MouseEvent) => void;
    };
    if (props.children === label || props['aria-label'] === label) {
      matches.push(el);
    }
  });
  return matches;
}

describe('WaitingListWorkRow', () => {
  it('renders patient name and UHID', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow {...baseProps()} />,
    );

    expect(html).toContain('Anita Rao');
    expect(html).toContain('UHID-1001');
    expect(html).toContain(WAITING_LIST_WORK_GRID);
  });

  it('renders age when available', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow {...baseProps()} />,
    );

    expect(html).toContain('58 yrs');
  });

  it('renders procedure primary and eye secondary in Procedure / Eye cell', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow {...baseProps()} />,
    );

    expect(html).toContain('Phacoemulsification');
    expect(html).toContain('>RE<');
    expect(html).not.toContain('Phacoemulsification · RE');
  });

  it('renders Visit cell with type primary and doctor · time secondary', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-row-visit"');
    expect(html).toContain('Surgery');
    expect(html).toContain('Dr. Mehta');
    expect(html).toContain('10:30');
  });

  it('renders Owner column: Unassigned when counselorId is null', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ counselorId: null, counselorName: undefined }),
        })}
      />,
    );

    expect(html).toContain('data-testid="waiting-list-row-owner"');
    expect(html).toContain('Unassigned');
    expect(html).not.toContain('Owner:');
  });

  it('renders Owner column with You for current user', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          currentUserId: 'user-1',
          patient: basePatient({
            counselorId: 'user-1',
            counselorName: 'Amelia Martinez',
          }),
        })}
      />,
    );

    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('>You<');
  });

  it('renders Owner column with other counsellor name without You', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          currentUserId: 'user-1',
          patient: basePatient({
            counselorId: 'user-2',
            counselorName: 'Emma Williams',
          }),
        })}
      />,
    );

    expect(html).toContain('Emma Williams');
    expect(html).not.toContain('>You<');
  });

  it('keeps patient identity free of visit/owner duplication', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({
            counselorId: 'user-2',
            counselorName: 'Emma Williams',
          }),
        })}
      />,
    );

    expect(html).toContain('UHID-1001');
    expect(html).toContain('58 yrs');
    expect(html).not.toContain('Owner: Emma Williams');
  });

  it('shows Processing badge label for Processed status', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ status: 'Processed' }),
        })}
      />,
    );

    expect(html).toContain('Processing');
    // statusPill token is applied; cn() may drop text-[11px] when text-[12px] wins
    expect(html).toMatch(
      /rounded-full[^>]*>Processing</,
    );
    expect(counsellingSessionTokens.statusPill).toContain('rounded-full');
  });

  it('shows Payment / Coverage from patientType and Pre-Auth hint outside Action', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ patientType: 'Insurance' }),
          hasCcmsCase: false,
        })}
      />,
    );

    expect(html).toContain('data-testid="waiting-list-row-payment"');
    expect(html).toContain('Insurance');
    expect(html).toContain('Pre-Auth Required');
    expect(html).toContain('waiting-list-row-preauth');
    expect(html).not.toContain('>Pre-Auth<');
    // Pre-Auth must not sit in the Action cluster as a sibling CTA
    expect(html).not.toMatch(
      /waiting-list-row-action[\s\S]*waiting-list-row-preauth/,
    );
  });

  it('renders Cash in Payment / Coverage without Pre-Auth hint', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ patientType: 'Cash' }),
        })}
      />,
    );

    expect(html).toContain('data-testid="waiting-list-row-payment"');
    expect(html).toContain('Cash');
    expect(html).not.toContain('Pre-Auth Required');
    expect(html).not.toContain('waiting-list-row-preauth');
  });

  it('renders Camp and GovernmentScheme patientType values as-is', () => {
    const camp = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ patientType: 'Camp' }),
        })}
      />,
    );
    expect(camp).toContain('Camp');
    expect(camp).not.toContain('Pre-Auth Required');

    const gov = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ patientType: 'GovernmentScheme' }),
          hasCcmsCase: false,
        })}
      />,
    );
    expect(gov).toContain('GovernmentScheme');
    expect(gov).toContain('Pre-Auth Required');
  });

  it('keeps Pre-Auth as Action primary only on PreAuthQueue tab', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ patientType: 'Insurance', status: 'Pending' }),
          activeTab: 'PreAuthQueue',
          hasCcmsCase: true,
          ccmsState: 'WAITING_APPROVAL',
        })}
      />,
    );
    expect(html).toContain('>Pre-Auth<');
    expect(html).toMatch(
      /waiting-list-row-action[\s\S]*waiting-list-row-preauth/,
    );
    expect(html).not.toMatch(/>View</);
    expect(html).not.toMatch(/>Start</);
  });

  it('does not render View/Open/Start/Continue nav buttons without lifecycle handlers; row remains activatable', () => {
    const pendingHtml = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ status: 'Pending' }),
          activeTab: 'Pending',
        })}
      />,
    );
    expect(pendingHtml).not.toMatch(/>Start</);
    expect(pendingHtml).not.toMatch(/>Continue</);
    expect(pendingHtml).not.toMatch(/>View</);
    expect(pendingHtml).not.toMatch(/>Open</);
    expect(pendingHtml).not.toMatch(/>Start Counseling</);
    expect(pendingHtml).toContain('role="button"');
    expect(pendingHtml).toContain('cursor-pointer');
    expect(pendingHtml).toContain('Activate to open counselling session');
  });

  it('Action for Done + coverage shows Re-evaluate without Pre-Auth CTA clutter', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({
            status: 'Done',
            patientType: 'Insurance',
            counselorId: 'amelia',
          }),
          currentUserId: 'amelia',
          onLifecycleAction: vi.fn(),
          hasCcmsCase: false,
        })}
      />,
    );

    expect(html).toContain('waiting-list-row-lifecycle-re-evaluate');
    expect(html).toContain('Pre-Auth Required');
    expect(html).not.toContain('>Pre-Auth<');
  });

  it('activates onRowClick from the row surface', () => {
    const onRowClick = vi.fn();
    const tree = expandRow(baseProps({ onRowClick }));
    const root = tree;
    expect((root.props as { role?: string }).role).toBe('button');
    (root.props as { onClick: () => void }).onClick();
    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', patientName: 'Anita Rao' }),
    );
  });

  it('activates on Enter and Space keydown', () => {
    const onRowClick = vi.fn();
    const tree = expandRow(baseProps({ onRowClick }));
    const onKeyDown = (tree.props as {
      onKeyDown: (e: { key: string; preventDefault: () => void }) => void;
    }).onKeyDown;
    const preventDefault = vi.fn();
    onKeyDown({ key: 'Enter', preventDefault });
    onKeyDown({ key: ' ', preventDefault });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('makes the Patient cell the context entry point (no Action person icon or chevron)', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow {...baseProps()} />,
    );

    expect(html).toContain('data-testid="waiting-list-row-patient"');
    expect(html).toContain('Open patient context for Anita Rao');
    expect(html).not.toContain('aria-label="Patient details"');
    expect(html).not.toMatch(/lucide-user|data-lucide="user"/i);
    // Action chevron removed — lucide ChevronRight must not appear in row markup
    expect(html).not.toMatch(/lucide-chevron-right|ChevronRight/i);
  });

  it('opens demographics from Patient cell without row navigation or lifecycle mutation', () => {
    const onDemographics = vi.fn();
    const onRowClick = vi.fn();
    const onAssign = vi.fn();
    const onLifecycleAction = vi.fn();
    const onPreAuth = vi.fn();
    const tree = expandRow(
      baseProps({
        onDemographics,
        onRowClick,
        onAssign,
        onLifecycleAction,
        onPreAuth,
        patient: basePatient({ status: 'Pending', counselorId: null }),
      }),
    );

    let patientBtn: ReactElement | null = null;
    walkElements(tree, (el) => {
      if (
        (el.props as { 'data-testid'?: string })['data-testid'] ===
        'waiting-list-row-patient'
      ) {
        patientBtn = el;
      }
    });
    expect(patientBtn).not.toBeNull();

    const stopPropagation = vi.fn();
    const mockEvent = { stopPropagation } as unknown as MouseEvent;
    (patientBtn!.props as { onClick: (e: MouseEvent) => void }).onClick(
      mockEvent,
    );

    expect(onDemographics).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', patientName: 'Anita Rao' }),
    );
    expect(stopPropagation).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onAssign).not.toHaveBeenCalled();
    expect(onLifecycleAction).not.toHaveBeenCalled();
    expect(onPreAuth).not.toHaveBeenCalled();
  });

  it('Patient cell is a keyboard-focusable button with accessible name', () => {
    const tree = expandRow(baseProps());
    let patientBtn: ReactElement | null = null;
    walkElements(tree, (el) => {
      if (
        (el.props as { 'data-testid'?: string })['data-testid'] ===
        'waiting-list-row-patient'
      ) {
        patientBtn = el;
      }
    });
    expect(patientBtn).not.toBeNull();
    const props = patientBtn!.props as {
      type?: string;
      'aria-label'?: string;
    };
    expect(props.type).toBe('button');
    expect(props['aria-label']).toBe('Open patient context for Anita Rao');
  });

  it('Action column is workflow-only (no person or chevron controls)', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ status: 'Done', counselorId: 'amelia' }),
          currentUserId: 'amelia',
          onLifecycleAction: vi.fn(),
        })}
      />,
    );

    expect(html).toContain('waiting-list-row-lifecycle-re-evaluate');
    expect(html).toContain('data-testid="waiting-list-row-action"');
    expect(html).not.toContain('aria-label="Patient details"');
    expect(html).not.toMatch(/ChevronRight|lucide-chevron-right/i);
  });

  it('collapses repeated Dr. prefix via formatWaitingListDoctorDisplay', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ doctor: 'Dr. Dr. Sharma' }),
        })}
      />,
    );

    expect(html).toContain('Dr. Sharma');
    expect(html).not.toContain('Dr. Dr. Sharma');
  });

  it('renders safely when optional fields are missing', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({
            surgeryName: '',
            eye: '',
            doctor: '',
            age: 0,
            time: '',
            slNo: 0,
          }),
        })}
      />,
    );

    expect(html).toContain('Anita Rao');
    expect(html).toContain('UHID-1001');
    expect(html).toContain('—');
    expect(html).not.toContain('0 yrs');
    expect(html).not.toContain('Dr. Dr.');
  });

  it('stops propagation on Payment-column Pre-Auth hint click and calls onPreAuth', () => {
    const onPreAuth = vi.fn();
    const onRowClick = vi.fn();
    const tree = expandRow(
      baseProps({
        patient: basePatient({ patientType: 'Insurance' }),
        activeTab: 'All',
        hasCcmsCase: false,
        onPreAuth,
        onRowClick,
      }),
    );

    const preAuthButtons = findButtonsByLabel(tree, 'Pre-Auth Required').filter(
      (el) =>
        String((el.props as { 'aria-label'?: string })['aria-label'] ?? '').includes(
          'Pre-authorization',
        ),
    );
    expect(preAuthButtons.length).toBe(1);

    const stopPropagation = vi.fn();
    const mockEvent = { stopPropagation } as unknown as MouseEvent;
    (preAuthButtons[0].props as { onClick: (e: MouseEvent) => void }).onClick(
      mockEvent,
    );

    expect(onPreAuth).toHaveBeenCalledWith('p-1');
    expect(stopPropagation).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('uses V2 density without left status accent bar', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        {...baseProps({
          patient: basePatient({ status: 'Pending' }),
        })}
      />,
    );

    expect(html).toContain('staff-worklist-row');
    expect(html).toContain('text-sm font-semibold');
    expect(html).not.toContain('border-l-2');
    expect(html).not.toContain('border-l-amber-400');
  });
});

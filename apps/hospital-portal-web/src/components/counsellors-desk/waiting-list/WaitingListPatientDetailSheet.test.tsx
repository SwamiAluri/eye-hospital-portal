import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { WaitingListPatient } from '@/types/counsellors-desk';

vi.mock('@/components/ui/sheet', () => {
  function passthrough(displayName: string) {
    const Comp = ({
      children,
      className,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => (
      <div data-sheet={displayName} className={className} {...rest}>
        {children}
      </div>
    );
    Comp.displayName = displayName;
    return Comp;
  }

  return {
    Sheet: ({
      children,
      open,
    }: {
      children?: ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (open ? <div data-sheet="Sheet">{children}</div> : null),
    SheetContent: ({
      children,
      className,
      hideCloseButton,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      hideCloseButton?: boolean;
      [key: string]: unknown;
    }) => {
      const {
        side: _side,
        overlayClassName: _overlay,
        overlayTestId: _otid,
        ...dom
      } = rest;
      return (
        <div data-sheet="SheetContent" className={className} {...dom}>
          {!hideCloseButton ? (
            <button type="button" data-sheet="SheetClose">
              <span className="sr-only">Close</span>
            </button>
          ) : null}
          {children}
        </div>
      );
    },
    SheetHeader: passthrough('SheetHeader'),
    SheetTitle: passthrough('SheetTitle'),
    SheetDescription: passthrough('SheetDescription'),
    SheetClose: passthrough('SheetClose'),
  };
});

vi.mock('@/components/patients/PatientAvatar', () => ({
  PatientAvatar: ({
    displayName,
  }: {
    displayName?: string | null;
  }) => {
    const parts =
      displayName
        ?.trim()
        .split(/\s+/)
        .filter(Boolean) ?? [];
    const initials =
      parts.length >= 2
        ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
        : (parts[0]?.slice(0, 2).toUpperCase() ?? '');
    return <div data-testid="patient-avatar-initials">{initials}</div>;
  },
}));

import { WaitingListPatientDetailSheet } from './WaitingListPatientDetailSheet';

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
    gender: 'F',
    doctor: 'Dr. Dr. Mehta',
    time: '10:30',
    remarks: '',
    status: 'Processed',
    ...overrides,
  };
}

describe('WaitingListPatientDetailSheet', () => {
  it('renders name and UHID when open with a patient', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient()}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Anita Rao');
    expect(html).toContain('UHID-1001');
  });

  it('renders compact Patient / Visit / Counselling / Clinical sections', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({
          counselorId: 'amelia',
          counselorName: 'Amelia Martinez',
        })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('>Patient<');
    expect(html).toContain('>Visit<');
    expect(html).toContain('>Counselling<');
    expect(html).toContain('>Clinical / Surgery<');
    expect(html).toContain('Amelia Martinez');
  });

  it('renders age when present', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ age: 58 })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('58 yrs');
  });

  it('renders human-readable sex via formatPatientSex', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ gender: 'F' })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Female');
    expect(html).not.toMatch(/>\s*F\s*</);
  });

  it('renders procedure and eye when present', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({
          surgeryName: 'Phacoemulsification',
          eye: 'RE',
        })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Phacoemulsification');
    expect(html).toContain('RE');
  });

  it('formats doctor without repeated Dr. prefix', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ doctor: 'Dr. Dr. Mehta' })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Dr. Mehta');
    expect(html).not.toContain('Dr. Dr. Mehta');
  });

  it('omits empty optional contact/emergency noise from compact sheet', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({
          contactNumber: undefined,
          bloodGroup: undefined,
          address: undefined,
          remarks: '',
        })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).not.toContain('Contact Number');
    expect(html).not.toContain('Address');
    expect(html).not.toContain('Emergency Contact');
    expect(html).not.toContain('Blood Group');
  });

  it('shows Owner as Unassigned when counselorId is null', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ counselorId: null, counselorName: undefined })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Unassigned');
  });

  it('renders follow-up when present', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({
          followUpDate: '2026-04-15',
          followUpReason: 'Post-op review',
        })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Post-op review');
    expect(html).toMatch(/15\s*Apr\s*2026|Apr\s*15,?\s*2026/i);
  });

  it('shows Processing label for Processed status', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ status: 'Processed' })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('Processing');
    expect(html).not.toContain('>Processed<');
  });

  it('has no Save or Edit button text', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient()}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).not.toMatch(/\bSave\b/);
    expect(html).not.toMatch(/\bEdit\b/);
  });

  it('includes SheetTitle and close affordance', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient()}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('data-sheet="SheetTitle"');
    expect(html).toContain('Anita Rao');
    expect(html).toMatch(/Close|data-sheet="SheetClose"/);
  });

  it('renders initials avatar from name when photo field is absent', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient({ patientName: 'Anita Rao' })}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('AR');
    expect(html).not.toMatch(/<img\b/i);
  });

  it('is minimal when patient is null or open is false', () => {
    const closed = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient()}
        open={false}
        onClose={vi.fn()}
      />,
    );
    const nullPatient = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={null}
        open
        onClose={vi.fn()}
      />,
    );
    expect(closed).toBe('');
    expect(nullPatient).toBe('');
  });

  it('declares read-only context in SheetDescription (no ownership mutation)', () => {
    const html = renderToStaticMarkup(
      <WaitingListPatientDetailSheet
        patient={basePatient()}
        open
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('does not assign or claim ownership');
  });
});

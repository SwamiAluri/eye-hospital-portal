import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SessionsEyeLine,
  SessionsMrnLine,
  cgx1WorklistHeaderClass,
  formatSessionListStatus,
  nonEmptyListText,
  sessionsOwnerLabel,
} from './sessions-list-presentation';

describe('CGX-1 Sessions list presentation', () => {
  it('renders MRN with the exact label when PatientMrn is present', () => {
    const html = renderToStaticMarkup(<SessionsMrnLine mrn="123456" />);
    expect(html).toContain('data-testid="sessions-row-mrn"');
    expect(html).toContain('>MRN<');
    expect(html).toContain('123456');
    expect(html).not.toMatch(/UHID/i);
  });

  it('omits the MRN line when the value is absent or whitespace', () => {
    expect(renderToStaticMarkup(<SessionsMrnLine mrn={null} />)).toBe('');
    expect(renderToStaticMarkup(<SessionsMrnLine mrn={undefined} />)).toBe('');
    expect(renderToStaticMarkup(<SessionsMrnLine mrn="" />)).toBe('');
    expect(renderToStaticMarkup(<SessionsMrnLine mrn="   " />)).toBe('');
    expect(nonEmptyListText('  ')).toBeNull();
  });

  it('does not invent an identifier or relabel MRN as UHID', () => {
    const html = renderToStaticMarkup(<SessionsMrnLine mrn="MR-100" />);
    expect(html).toContain('MR-100');
    expect(html).not.toMatch(/UHID/i);
    expect(html).not.toContain('HealthId');
  });

  it('renders Eye under the surgery secondary line when populated', () => {
    const html = renderToStaticMarkup(<SessionsEyeLine eye="RE" />);
    expect(html).toContain('data-testid="sessions-row-eye"');
    expect(html).toContain('>Eye<');
    expect(html).toContain('RE');
  });

  it('omits the Eye line when SurgeryTentativeEye is blank', () => {
    expect(renderToStaticMarkup(<SessionsEyeLine eye={null} />)).toBe('');
    expect(renderToStaticMarkup(<SessionsEyeLine eye="" />)).toBe('');
    expect(renderToStaticMarkup(<SessionsEyeLine eye="  " />)).toBe('');
  });

  it('uses readable title-case header type, not 10px uppercase', () => {
    expect(cgx1WorklistHeaderClass).toContain('text-sm');
    expect(cgx1WorklistHeaderClass).toContain('tracking-normal');
    expect(cgx1WorklistHeaderClass).not.toContain('uppercase');
    expect(cgx1WorklistHeaderClass).not.toContain('text-[10px]');
  });

  it('labels a missing owner as Unassigned and keeps the existing status words', () => {
    expect(sessionsOwnerLabel(null, 'Amelia')).toBe('Unassigned');
    expect(sessionsOwnerLabel('c1', 'Amelia Martinez')).toBe('Amelia Martinez');
    expect(sessionsOwnerLabel('c1', '  ')).toBe('Assigned');
    expect(formatSessionListStatus('InProgress')).toBe('In Progress');
    expect(formatSessionListStatus('NoShow')).toBe('NoShow');
    expect(formatSessionListStatus('Scheduled')).toBe('Scheduled');
    expect(formatSessionListStatus(null)).toBeNull();
  });
});

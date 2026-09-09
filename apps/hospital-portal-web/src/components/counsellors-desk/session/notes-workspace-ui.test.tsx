import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CounsellingWrapupPhase } from '@/components/counsellors-desk/session/CounsellingWrapupPhase';
import { counsellingTestIds, counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingPhaseValidationContext } from '@/lib/counsellors-desk/counselling-progress';

const completeContext: CounsellingPhaseValidationContext = {
  selectedVariantId: 'variant-1',
  hasActiveTemplate: false,
  selectedIolId: null,
  variantSubOption: null,
  iolOptionCount: 0,
  paymentType: 'Cash',
  insuranceCompany: '',
  decision: 'NotInterested',
  schedule: null,
  followUpReason: 'Financial Planning',
  followUpDate: '2026-09-15',
  counsellorNotes: '',
  patientRemarks: '',
  wantToSeeDoctor: false,
  interestedToUpgrade: false,
  notRequiredPreAuth: false,
  procedureVariants: [],
};

const incompleteContext: CounsellingPhaseValidationContext = {
  ...completeContext,
  decision: '',
  followUpReason: '',
  followUpDate: '',
};

function renderNotes(overrides: Partial<CounsellingPhaseValidationContext> = {}, readOnly = false) {
  return renderToStaticMarkup(
    <CounsellingWrapupPhase
      counselingSessionId="sess-1"
      counsellorNotes="Discussed options"
      setCounsellorNotes={vi.fn()}
      patientRemarks=""
      setPatientRemarks={vi.fn()}
      doctorNotes=""
      setDoctorNotes={vi.fn()}
      wantToSeeDoctor={false}
      setWantToSeeDoctor={vi.fn()}
      interestedToUpgrade={false}
      setInterestedToUpgrade={vi.fn()}
      notRequiredPreAuth={false}
      setNotRequiredPreAuth={vi.fn()}
      isReadOnly={readOnly}
      markDirty={vi.fn()}
      phaseValidationContext={{ ...completeContext, ...overrides }}
    />,
  );
}

describe('Notes workspace UI (Wave 2E-5R)', () => {
  it('uses distinct workspace test id (not phase nav id)', () => {
    const html = renderNotes();
    expect(html).toContain(`data-testid="${counsellingTestIds.notesWorkspace}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.phase('wrapup')}"`);
  });

  it('does not mount pre-admission lab panel', () => {
    const html = renderNotes();
    expect(html).not.toMatch(/Pre-admission lab values|Pre-op investigations/i);
  });

  it('renders Notes as a full-height stretch widget', () => {
    const html = renderNotes();
    expect(html).toContain('h-full');
    expect(html).toContain('flex-col');
    expect(html).toContain('rounded-xl');
  });

  it('does not render readiness strip or duplicated Notes headings', () => {
    const html = renderNotes();
    expect(html).not.toContain(`data-testid="${counsellingTestIds.notesReadinessStrip}"`);
    expect(html).not.toContain('Counselling notes');
    expect(html).not.toContain('Session readiness');
    expect(html).not.toContain(`data-testid="${counsellingTestIds.notesWorkspaceHeader}"`);
    expect(html).toContain('>Notes<');
    expect(html).toContain('rounded-xl');
  });

  it('shows upstream blocker without Complete/Required pill when incomplete', () => {
    const html = renderNotes(incompleteContext);
    expect(html).toContain(`data-testid="${counsellingTestIds.notesInlineBlocker}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.notesWorkspaceStatus}"`);
  });

  it('renders counsellor, patient and doctor fields with compact labels', () => {
    const html = renderNotes();
    expect(html).toContain(`data-testid="${counsellingTestIds.notesCounsellorField}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.notesPatientField}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.notesDoctorField}"`);
    expect(html).toContain('>Counsellor<');
    expect(html).toContain('>Patient<');
    expect(html).toContain('>Doctor<');
  });

  it('renders additional options checklist with all three options pinned', () => {
    const html = renderNotes();
    expect(html).toContain(`data-testid="${counsellingTestIds.notesAdditionalOptions}"`);
    expect(html).toContain('Want to see doctor again');
    expect(html).toContain('Interested to upgrade');
    expect(html).toContain('Not required pre-authorization');
    expect(html).toContain(counsellingSessionTokens.sessionAdditionalOptionsLabel);
    expect(html).toContain('shrink-0 space-y-1.5 border-t');
    expect(html).toContain('min-h-0 flex-1 space-y-2');
    expect(html).not.toContain('overflow-y-auto');
    expect(html).not.toContain('uppercase');
  });

  it('avoids nested card chrome and uses compact textarea mins', () => {
    const html = renderNotes();
    expect(html).not.toContain('rounded-2xl border border-border/60 bg-card shadow-sm');
    expect(html).not.toContain('min-h-[5rem]');
    expect(html).not.toContain('min-h-[6rem]');
    expect(html).not.toContain('min-h-[4.5rem]');
    expect(html).toContain('min-h-[3.25rem]');
    expect(html).toContain('min-h-[2.75rem]');
    expect(html).toContain('resize-none');
  });

  it('marks fields read-only when session is locked', () => {
    const html = renderNotes({}, true);
    expect(html).toContain('disabled=""');
  });
});

describe('Counselling workspace test id audit', () => {
  it('keeps phase nav and workspace ids distinct', () => {
    expect(counsellingTestIds.notesWorkspace).toBe('counselling-notes-workspace');
    expect(counsellingTestIds.phase('wrapup')).toBe('counselling-phase-wrapup');
    expect(counsellingTestIds.decisionWorkspace).toBe('counselling-decision-workspace');
    expect(counsellingTestIds.quoteWorkspace).toBe('counselling-quote-workspace');
  });
});

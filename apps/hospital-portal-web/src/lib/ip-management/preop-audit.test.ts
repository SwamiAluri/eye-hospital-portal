import { describe, expect, it } from 'vitest';
import { buildPreOpAuditTimeline } from './preop-audit';

describe('preop-audit', () => {
  it('merges completions, sections, and journey logs newest-first', () => {
    const events = buildPreOpAuditTimeline({
      completions: [
        {
          id: 'c1',
          clearanceId: 'cl1',
          itemId: 'i1',
          itemKey: 'fasting_confirmed',
          itemLabel: 'Fasting confirmed',
          category: 'Compliance',
          isBlocking: false,
          requiresDocument: false,
          isCompleted: true,
          isBypassed: false,
          bypassReason: null,
          notes: null,
          documentId: null,
          completedByUserId: null,
          completedAt: '2026-06-30T10:00:00Z',
          updatedAt: '2026-06-30T10:00:00Z',
          source: 'derived',
          completedByRole: 'system',
        },
      ],
      sectionClearances: [
        {
          id: 's1',
          clearanceId: 'cl1',
          journeyId: 'j1',
          sectionCategory: 'Pharmacy Preparation',
          responsibleDepartmentCode: 'PHARM',
          status: 'WardConfirmed',
          requestedByUserId: null,
          requestedAt: '2026-06-30T09:00:00Z',
          respondedByUserId: null,
          respondedAt: null,
          responseNotes: null,
          isExternalResponder: false,
          externalResponderName: null,
          externalResponderContact: null,
          confirmedByUserId: null,
          confirmedAt: '2026-06-30T11:00:00Z',
          confirmationNotes: 'OK',
          createdAt: '2026-06-30T08:00:00Z',
          updatedAt: '2026-06-30T11:00:00Z',
        },
      ],
      journeyAudit: [
        {
          id: 'a1',
          journeyId: 'j1',
          fieldChanged: 'ClinicalState',
          oldValue: 'Admitted',
          newValue: 'ReadyForSurgery',
          changedAt: '2026-06-30T12:00:00Z',
          changedByUserId: 'u1',
        },
      ],
    });

    expect(events[0].title).toBe('ClinicalState');
    expect(events.some(e => e.title.includes('Pharmacy Preparation'))).toBe(true);
    expect(events.some(e => e.title.includes('Fasting confirmed'))).toBe(true);
  });
});

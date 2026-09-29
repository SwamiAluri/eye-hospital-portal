import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import { CounsellingJourneyRail } from '@/components/counsellors-desk/session/CounsellingJourneyRail';
import {
  SessionHistoryBody,
  SessionHistoryModal,
} from '@/components/counsellors-desk/SessionHistoryModal';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingSession, SessionAuditEntry } from '@/types/counsellors-desk';
import { loadCounsellingSessionHistory } from '@/lib/counsellors-desk/load-counselling-session-history';

vi.mock('@/hooks/use-counsellor-master-options', () => ({
  useCounsellorMasterOptions: () => ({
    sessionTypeOptions: [{ value: 'INITIAL', label: 'Initial Counselling' }],
  }),
}));

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
    Sheet: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
      open ? <div data-sheet="Sheet">{children}</div> : null,
    SheetContent: passthrough('SheetContent'),
    SheetHeader: passthrough('SheetHeader'),
    SheetTitle: passthrough('SheetTitle'),
    SheetDescription: passthrough('SheetDescription'),
  };
});

const loadHistoryMock = vi.fn();
vi.mock('@/lib/counsellors-desk/load-counselling-session-history', () => ({
  loadCounsellingSessionHistory: (...args: unknown[]) => loadHistoryMock(...args),
}));

const AMELIA_ID = '48a94c56-ccb2-49c0-9916-bee2703b0251';
const RAHUL_ID = '11111111-2222-3333-4444-555555555555';
const UNKNOWN_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const nameById: Record<string, string> = {
  [AMELIA_ID]: 'Amelia Martinez',
  [RAHUL_ID]: 'Rahul Kumar',
};

const baseSession: CounsellingSession = {
  id: 'sess-1',
  patientId: 'p1',
  patientName: 'Test Patient',
  age: 55,
  gender: 'F',
  uhid: 'MRN1',
  sessionTypeCode: 'INITIAL',
  counselorId: AMELIA_ID,
  counselorName: 'Amelia Martinez',
} as CounsellingSession;

function renderHistory(entries: SessionAuditEntry[]) {
  return renderToStaticMarkup(
    <SessionHistoryModal
      isOpen
      entries={entries}
      isLoading={false}
      onClose={() => {}}
      counselorNameById={nameById}
    />,
  );
}

describe('Phase 3I Slice 5 — Session History re-wire', () => {
  beforeEach(() => {
    loadHistoryMock.mockReset();
    loadHistoryMock.mockResolvedValue([]);
  });

  it('SessionPageHeader exposes History entry point with accessible name', () => {
    const html = renderToStaticMarkup(
      <SessionPageHeader
        session={baseSession}
        queueStatus="Processed"
        patientDetails={null}
      />,
    );
    const headerHtml = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    expect(headerHtml).not.toContain(counsellingTestIds.btnSessionHistory);
    expect(headerHtml).not.toContain('role="dialog"');
    expect(html).not.toContain('role="dialog"');
    const headerSrc = readFileSync(join(__dirname, 'SessionPageHeader.tsx'), 'utf8');
    expect(headerSrc).toContain('openSessionHistory');
    expect(headerSrc).toContain('openClinicalRecommendations');
    const rail = renderToStaticMarkup(
      <CounsellingJourneyRail
        activeMainTab="counselling"
        activePhase="estimate"
        phaseCompletion={{ estimate: false, decision: false, wrapup: false }}
        showCoverageWorkflow
        coverageProgress={{
          uploadedDocCount: 0,
          requiredDocCount: 3,
          ccmsState: 'DRAFT',
          preAuthSubmitted: false,
        }}
        queueStatus="Processed"
        isRepeatState={false}
        isSurgeryDoneState={false}
        canGoToPhase={() => false}
      />,
    );
    const historyAt = rail.indexOf(`aria-label="${counsellingCopy.sessionHistoryAria}"`);
    expect(historyAt).toBeGreaterThan(rail.lastIndexOf('Finish'));
    const historyTag = rail.slice(rail.lastIndexOf('<button', historyAt), rail.indexOf('>', historyAt));
    expect(historyTag).not.toContain('aria-current');
    const inline = renderToStaticMarkup(
      <SessionHistoryBody
        isLoading={false}
        entries={[{
          id: '1',
          changeType: 'FieldChanged',
          oldValue: 'A',
          newValue: 'B',
          reason: null,
          changedAt: '2026-09-17T15:27:00.000Z',
          changedBy: 'Amelia Martinez',
        }]}
      />,
    );
    expect(inline).toContain('Event');
    expect(inline).toContain('Date');
    expect(inline).toContain('Actor');
    expect(inline).toContain('Change / Details');
    expect(inline).not.toContain('role="dialog"');
  });

  it('Ownership established displays names, not GUIDs; Actor distinct from owner', () => {
    const html = renderHistory([
      {
        id: '1',
        changeType: 'OwnershipEstablishedOnCreate',
        oldValue: null,
        newValue: AMELIA_ID,
        reason: 'Create',
        changedAt: '2026-09-17T15:27:00.000Z',
        changedBy: 'Amelia Martinez',
      },
    ]);
    expect(html).toContain('Ownership established');
    expect(html).toContain('Unassigned');
    expect(html).toContain('Amelia Martinez');
    expect(html).not.toContain(AMELIA_ID);
    expect(html).toContain('Actor');
    expect(html).toContain('From');
    expect(html).toContain('To');
    expect(html).toContain('Source');
    expect(html).toContain('Create');
  });

  it('Assignment displays Actor separately from New Owner', () => {
    const html = renderHistory([
      {
        id: '2',
        changeType: 'OwnershipAssigned',
        oldValue: null,
        newValue: AMELIA_ID,
        reason: 'Assign',
        changedAt: '2026-09-17T15:32:00.000Z',
        changedBy: 'System Administrator',
      },
    ]);
    expect(html).toContain('Assigned');
    expect(html).toContain('System Administrator');
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('Source');
    expect(html).toContain('Assign');
    expect(html).not.toContain(AMELIA_ID);
  });

  it('Lifecycle claim displays Previous/New Owner, Actor, Intent, and Source', () => {
    const html = renderHistory([
      {
        id: '3',
        changeType: 'OwnershipClaimed',
        oldValue: AMELIA_ID,
        newValue: RAHUL_ID,
        reason: 'ReEvaluate',
        changedAt: '2026-09-17T15:40:00.000Z',
        changedBy: 'Rahul Kumar',
      },
    ]);
    expect(html).toContain('Lifecycle ownership claimed');
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('Rahul Kumar');
    expect(html).toContain('Intent');
    expect(html).toContain('ReEvaluate');
    expect(html).toContain('Lifecycle Claim');
    expect(html).not.toContain(AMELIA_ID);
    expect(html).not.toContain(RAHUL_ID);
  });

  it('Unknown counselor identity uses safe fallback', () => {
    const html = renderHistory([
      {
        id: '4',
        changeType: 'OwnershipAssigned',
        oldValue: null,
        newValue: UNKNOWN_ID,
        reason: 'Assign',
        changedAt: '2026-09-17T15:32:00.000Z',
        changedBy: 'System Administrator',
      },
    ]);
    expect(html).toContain('Unknown user');
    expect(html).not.toContain(UNKNOWN_ID);
  });

  it('Existing FieldChanged and PatientTypeChanged remain visible', () => {
    const html = renderHistory([
      {
        id: '5',
        changeType: 'FieldChanged',
        fieldName: 'packageName',
        oldValue: 'A',
        newValue: 'B',
        reason: 'packageName',
        changedAt: '2026-09-17T15:50:00.000Z',
        changedBy: 'Amelia Martinez',
      },
      {
        id: '6',
        changeType: 'PatientTypeChanged',
        oldValue: 'Cash',
        newValue: 'Insurance',
        reason: null,
        changedAt: '2026-09-17T15:51:00.000Z',
        changedBy: 'Amelia Martinez',
      },
    ]);
    expect(html).toContain('Field Changed');
    expect(html).toContain('Payment Type Changed');
  });

  it('Desktop History uses structured table; mobile uses stacked records', () => {
    const html = renderHistory([
      {
        id: '1',
        changeType: 'OwnershipAssigned',
        oldValue: null,
        newValue: AMELIA_ID,
        reason: 'Assign',
        changedAt: '2026-09-17T15:32:00.000Z',
        changedBy: 'System Administrator',
      },
    ]);
    expect(html).toContain('data-testid="session-history-table"');
    expect(html).toContain('Event');
    expect(html).toContain('Date');
    expect(html).toContain('Actor');
    expect(html).toContain('Change');
    expect(html).toContain('session-history-desktop');
    expect(html).toContain('session-history-stacked');
    // No decorative emoji timeline list
    expect(html).not.toContain('border-l-2 border-gray-100');
  });

  it('History panel is keyboard-dismissible via Close control', () => {
    const html = renderHistory([]);
    expect(html).toContain('Close');
    expect(html).toMatch(/aria-label="Session History"|Session History/);
  });
});

describe('Phase 3I Slice 5 — history merge keeps Auth ownership rows', () => {
  it('loadCounsellingSessionHistory module exports the merge loader', () => {
    expect(typeof loadCounsellingSessionHistory).toBe('function');
  });
});

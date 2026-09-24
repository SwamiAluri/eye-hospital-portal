import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { SessionHistoryModal } from '@/components/counsellors-desk/SessionHistoryModal';
import type { SessionAuditEntry } from '@/types/counsellors-desk';
import { resolveWaitingListLifecycleAction } from '@/lib/counsellors-desk/waiting-list-lifecycle-action';
import { isWaitingListEligibleForInitialAssign } from '@/lib/counsellors-desk/counselling-auth';

const post = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ post, get }),
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

const FOLLOWUP_PAGE = join(
  process.cwd(),
  'src/app/dashboard/counsellors-desk/surgery-followup/page.tsx',
);

const AMELIA_ID = '48a94c56-ccb2-49c0-9916-bee2703b0251';

function readFollowupPage(): string {
  return readFileSync(FOLLOWUP_PAGE, 'utf8');
}

describe('Phase 3I Slice 8 — ReQueue FE contract', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('ReQueueModal requires a non-empty trimmed reason and blocks whitespace-only submit', () => {
    const src = readFollowupPage();
    expect(src).toContain('reason.trim().length > 0');
    expect(src).toContain("setFormError('Reason is required.')");
    expect(src).toContain('data-testid="followup-requeue-reason"');
    expect(src).toMatch(/disabled=\{!canSubmit\}/);
  });

  it('ReQueueModal still supports optional sessionType', () => {
    const src = readFollowupPage();
    expect(src).toContain("defaultSessionTypeCode('requeue')");
    expect(src).toContain('sessionTypeCodeToDb');
    expect(src).toContain('sessionType ? sessionTypeCodeToDb(sessionType) : undefined');
  });

  it('ReQueueModal sends current Version and expectedCounselorId (null when unowned)', () => {
    const src = readFollowupPage();
    expect(src).toContain('version: sessionVersion');
    expect(src).toContain('expectedCounselorId: counselorId');
    expect(src).toContain('getSession(sessionId, { skipCatalogFallback: true })');
    expect(src).toContain('counselorId: row.counselorId ?? null');
  });

  it('ReQueueModal uses session-concurrency helper on 409 and does not auto-retry', () => {
    const src = readFollowupPage();
    expect(src).toContain('isSessionConcurrencyConflict(err)');
    expect(src).toContain('getSessionConcurrencyMessage(err)');
    expect(src).toMatch(/isSessionConcurrencyConflict\(err\)[\s\S]{0,200}loadSessionVersion\(\)/);
    expect(src).not.toMatch(/isSessionConcurrencyConflict\(err\)[\s\S]{0,400}reQueueSession\(/);
  });

  it('successful ReQueue invalidates followups and waiting list', () => {
    const src = readFollowupPage();
    expect(src).toContain('invalidateWaitingList');
    expect(src).toMatch(/invalidateFollowups\(\);\s*\n\s*void invalidateWaitingList\(\)/);
  });

  it('reQueueSession API sends Version/CAS/reason with skipForbiddenRedirect', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        tokenNumber: 'FU-1',
        queueItemId: 'q1',
        message: 'ok',
        counselorId: null,
        version: 5,
      },
    });

    const result = await counsellorsDeskApi.reQueueSession('sess-1', {
      version: 4,
      expectedCounselorId: AMELIA_ID,
      reason: 'Patient callback',
      sessionType: 'Followup',
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/re-queue',
      {
        version: 4,
        expectedCounselorId: AMELIA_ID,
        reason: 'Patient callback',
        sessionType: 'Followup',
      },
      { skipForbiddenRedirect: true },
    );
    expect(result.version).toBe(5);
    expect(result.counselorId).toBeNull();
  });

  it('reQueueSession sends null expectedCounselorId for unowned sessions', async () => {
    post.mockResolvedValue({
      data: { success: true, tokenNumber: 'FU-2', queueItemId: 'q2', message: 'ok', version: 2 },
    });

    await counsellorsDeskApi.reQueueSession('sess-2', {
      version: 1,
      expectedCounselorId: null,
      reason: 'Still needs follow-up',
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-2/re-queue',
      {
        version: 1,
        expectedCounselorId: null,
        reason: 'Still needs follow-up',
      },
      { skipForbiddenRedirect: true },
    );
  });
});

describe('Phase 3I Slice 8 — Waiting List CTA after ReQueue→NULL', () => {
  it('Pending + NULL owner resolves to Assign', () => {
    expect(
      isWaitingListEligibleForInitialAssign({
        counselorId: null,
        status: 'Pending',
      }),
    ).toBe(true);
    expect(
      resolveWaitingListLifecycleAction({
        status: 'Pending',
        counselorId: null,
        currentUserId: AMELIA_ID,
        activeTab: 'All',
        canAssign: true,
      }).kind,
    ).toBe('assign');
  });
});

describe('Phase 3I Slice 8 — History OwnershipRequeued', () => {
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

  it('displays OwnershipRequeued as Re-queued with Reason and Requeued by (not raw type)', () => {
    const entry: SessionAuditEntry = {
      id: 'rq-1',
      changeType: 'OwnershipRequeued',
      oldValue: AMELIA_ID,
      newValue: null,
      reason: 'Patient requested callback',
      changedAt: '2026-09-18T10:00:00.000Z',
      changedBy: 'Admin User',
    };
    const html = renderToStaticMarkup(
      <SessionHistoryModal
        isOpen
        entries={[entry]}
        isLoading={false}
        onClose={() => {}}
        counselorNameById={{ [AMELIA_ID]: 'Amelia Martinez' }}
      />,
    );
    expect(html).toContain('Re-queued');
    expect(html).not.toContain('Ownership requeued');
    expect(html).not.toContain('OwnershipRequeued');
    expect(html).toContain('Admin User');
    expect(html).toContain('Requeued by');
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('Unassigned');
    expect(html).toContain('Patient requested callback');
    expect(html).toContain('Reason');
    expect(html).not.toContain(AMELIA_ID);
    expect(html).not.toContain('[Re-queue');
  });

  it('renders multiple OwnershipRequeued events independently', () => {
    const entries: SessionAuditEntry[] = [
      {
        id: 'rq-1',
        changeType: 'OwnershipRequeued',
        oldValue: AMELIA_ID,
        newValue: null,
        reason: 'First requeue',
        changedAt: '2026-09-01T08:00:00.000Z',
        changedBy: 'Admin User',
      },
      {
        id: 'rq-2',
        changeType: 'OwnershipRequeued',
        oldValue: null,
        newValue: null,
        reason: 'Test',
        changedAt: '2026-09-21T10:12:00.000Z',
        changedBy: 'Counsellor One',
      },
    ];
    const html = renderToStaticMarkup(
      <SessionHistoryModal
        isOpen
        entries={entries}
        isLoading={false}
        onClose={() => {}}
        counselorNameById={{ [AMELIA_ID]: 'Amelia Martinez' }}
      />,
    );
    expect(html.match(/Re-queued/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('First requeue');
    expect(html).toContain('Test');
    expect(html).toContain('Counsellor One');
  });
});

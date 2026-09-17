import { describe, expect, it } from 'vitest';
import type { WaitingListStatus } from '@/types/counsellors-desk';
import { resolveWaitingListLifecycleAction } from './waiting-list-lifecycle-action';

describe('resolveWaitingListLifecycleAction — ownership claim matrix', () => {
  const me = 'amelia';
  const peer = 'emma';

  const cases: Array<{
    status: WaitingListStatus;
    counselorId: string | null;
    label: string;
    kind: string;
  }> = [
    { status: 'Pending', counselorId: null, label: 'Assign', kind: 'assign' },
    { status: 'Pending', counselorId: me, label: 'Start Counseling', kind: 'open' },
    { status: 'Pending', counselorId: peer, label: 'View', kind: 'view' },
    { status: 'Processed', counselorId: me, label: 'Continue', kind: 'continue' },
    { status: 'Processed', counselorId: peer, label: 'View', kind: 'view' },
    { status: 'Processed', counselorId: null, label: 'View', kind: 'view' },
    { status: 'Done', counselorId: me, label: 'Re-evaluate', kind: 're-evaluate' },
    { status: 'Done', counselorId: null, label: 'Re-evaluate', kind: 're-evaluate' },
    { status: 'Done', counselorId: peer, label: 'Re-evaluate', kind: 're-evaluate' },
    { status: 'RepeatCounselling', counselorId: me, label: 'Start Repeat', kind: 'start-repeat' },
    { status: 'RepeatCounselling', counselorId: null, label: 'Start Repeat', kind: 'start-repeat' },
    { status: 'RepeatCounselling', counselorId: peer, label: 'Start Repeat', kind: 'start-repeat' },
    { status: 'AddOnSurgery', counselorId: me, label: 'View', kind: 'view' },
    { status: 'SurgeryDone', counselorId: me, label: 'View', kind: 'view' },
  ];

  it.each(cases)(
    '$status + owner=$counselorId → $label',
    ({ status, counselorId, label, kind }) => {
      expect(
        resolveWaitingListLifecycleAction({
          status,
          counselorId,
          currentUserId: me,
          activeTab: 'All',
          canAssign: true,
        }),
      ).toEqual({ label, kind });
    },
  );

  it('never shows Assign on Done / Repeat', () => {
    for (const status of ['Done', 'RepeatCounselling'] as WaitingListStatus[]) {
      expect(
        resolveWaitingListLifecycleAction({
          status,
          counselorId: null,
          currentUserId: me,
          activeTab: 'All',
          canAssign: true,
        }).kind,
      ).not.toBe('assign');
    }
  });
});

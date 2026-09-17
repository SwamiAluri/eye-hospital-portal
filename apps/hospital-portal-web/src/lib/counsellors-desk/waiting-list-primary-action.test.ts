import { describe, expect, it } from 'vitest';
import type { WaitingListStatus } from '@/types/counsellors-desk';
import { resolveWaitingListPrimaryAction } from './waiting-list-primary-action';

describe('resolveWaitingListPrimaryAction (compat wrapper)', () => {
  it('returns Pre-Auth / preauth on PreAuthQueue + Insurance', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Pending',
        activeTab: 'PreAuthQueue',
        patientType: 'Insurance',
      }),
    ).toEqual({ label: 'Pre-Auth', kind: 'preauth' });
  });

  it('falls through to lifecycle label on PreAuthQueue + Cash', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Pending' as WaitingListStatus,
        activeTab: 'PreAuthQueue',
        patientType: 'Cash',
        counselorId: null,
        currentUserId: 'u1',
        canAssign: true,
      }),
    ).toEqual({ label: 'Assign', kind: 'row-navigate' });
  });

  it('maps owner-aware Done current to Re-evaluate label', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Done',
        activeTab: 'All',
        counselorId: 'u1',
        currentUserId: 'u1',
      }),
    ).toEqual({ label: 'Re-evaluate', kind: 'row-navigate' });
  });
});

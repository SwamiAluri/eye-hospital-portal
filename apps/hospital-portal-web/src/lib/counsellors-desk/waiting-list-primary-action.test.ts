import { describe, expect, it } from 'vitest';
import type { WaitingListStatus } from '@/types/counsellors-desk';
import { resolveWaitingListPrimaryAction } from './waiting-list-primary-action';

describe('resolveWaitingListPrimaryAction', () => {
  const statusCases: Array<{
    status: WaitingListStatus;
    label: string;
  }> = [
    { status: 'Pending', label: 'Start' },
    { status: 'Processed', label: 'Continue' },
    { status: 'Done', label: 'View' },
    { status: 'RepeatCounselling', label: 'Open' },
    { status: 'AddOnSurgery', label: 'Open' },
    { status: 'SurgeryDone', label: 'View' },
  ];

  it.each(statusCases)(
    'returns $label / row-navigate for status $status',
    ({ status, label }) => {
      expect(
        resolveWaitingListPrimaryAction({
          status,
          activeTab: 'All',
        }),
      ).toEqual({ label, kind: 'row-navigate' });
    },
  );

  it('returns Pre-Auth / preauth on PreAuthQueue + Insurance', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Pending',
        activeTab: 'PreAuthQueue',
        patientType: 'Insurance',
      }),
    ).toEqual({ label: 'Pre-Auth', kind: 'preauth' });
  });

  it('falls through to status label on PreAuthQueue + Cash', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Pending',
        activeTab: 'PreAuthQueue',
        patientType: 'Cash',
      }),
    ).toEqual({ label: 'Start', kind: 'row-navigate' });
  });

  it('ignores preauth override on non-PreAuthQueue tab even for Insurance', () => {
    expect(
      resolveWaitingListPrimaryAction({
        status: 'Pending',
        activeTab: 'All',
        patientType: 'Insurance',
      }),
    ).toEqual({ label: 'Start', kind: 'row-navigate' });
  });
});

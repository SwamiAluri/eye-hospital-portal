import { describe, expect, it } from 'vitest';
import { counselorAnalyticsKeys } from '@/hooks/use-counselor-analytics';
import { counsellorsDeskKeys } from '@/lib/counsellors-desk/counsellors-desk-query-keys';

describe('Phase 2F query keys', () => {
  it('separates follow-up lists and stats by filter dimensions', () => {
    const a = counsellorsDeskKeys.activeFollowups({
      branchId: 'b1',
      q: 'jane',
      intention: 'Undecided',
      page: 1,
      pageSize: 20,
    });
    const b = counsellorsDeskKeys.activeFollowups({
      branchId: 'b1',
      q: 'jane',
      intention: 'Undecided',
      page: 2,
      pageSize: 20,
    });
    const stats = counsellorsDeskKeys.followupStats({
      branchId: 'b1',
      q: 'jane',
      intention: 'Undecided',
    });
    expect(a).not.toEqual(b);
    expect(a.slice(0, 3)).toEqual(['counsellors-desk', 'followups', 'active']);
    expect(stats).toEqual(['counsellors-desk', 'followups', 'stats', 'b1', 'jane', 'Undecided']);
  });

  it('keeps summary/trends/aging keys distinct', () => {
    const filters = { branchId: 'b1', period: 30 };
    expect(counselorAnalyticsKeys.summary(filters)[1]).toBe('summary');
    expect(counselorAnalyticsKeys.trends(filters)[1]).toBe('trends');
    expect(counselorAnalyticsKeys.aging({ branchId: 'b1' })[1]).toBe('aging');
    expect(counselorAnalyticsKeys.summary(filters)).not.toEqual(
      counselorAnalyticsKeys.trends(filters),
    );
  });
});

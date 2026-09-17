import { describe, expect, it } from 'vitest';
import {
  agingBucketSessionDates,
  analyticsWindowToSessionDates,
  buildAgingBucketSessionsHref,
  buildAgingPendingSessionsHref,
  buildAgreedSessionsHref,
  buildConversionSessionsHref,
  buildDeclinedSessionsHref,
  buildFollowupCenterHref,
  buildPendingDecisionSessionsHref,
  buildSessionListHref,
  buildTotalSessionsHref,
} from './analytics-drilldown';

describe('analytics-drilldown', () => {
  it('converts analytics half-open window to inclusive session dates', () => {
    expect(analyticsWindowToSessionDates('2026-09-01', '2026-10-01')).toEqual({
      sessionDateFrom: '2026-09-01',
      sessionDateTo: '2026-09-30',
    });
  });

  it('builds pending decision session list — never surgery-followup', () => {
    const href = buildPendingDecisionSessionsHref({
      branchId: 'b1',
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    });
    expect(href).toContain('/dashboard/counsellors-desk/sessions');
    expect(href).toContain('pendingDecision=true');
    expect(href).not.toContain('surgery-followup');
  });

  it('buildFollowupCenterHref routes to surgery-followup only', () => {
    expect(buildFollowupCenterHref()).toBe('/dashboard/counsellors-desk/surgery-followup');
  });

  it('aging bucket URLs require pendingDecision=true', () => {
    const href = buildAgingBucketSessionsHref(
      {
        branchId: 'b1',
        agingFrom: '2025-09-01',
        agingToExclusive: '2026-10-01',
      },
      'bucket_0_3',
    );
    expect(href).toBeTruthy();
    expect(href!).toContain('pendingDecision=true');
    expect(href!).toContain('agingBucket=bucket_0_3');
    expect(href!).not.toContain('surgery-followup');
  });

  it('aging pending list uses sessions route with pendingDecision', () => {
    const href = buildAgingPendingSessionsHref({
      branchId: 'b1',
      agingFrom: '2025-09-01',
      agingToExclusive: '2026-10-01',
    });
    expect(href).toContain('pendingDecision=true');
    expect(href).not.toContain('surgery-followup');
  });

  it('declined drill-down excludes pending decision', () => {
    const href = buildDeclinedSessionsHref({
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    });
    expect(href).toContain('patientAgreedToSurgery=false');
    expect(href).toContain('pendingDecision=false');
  });

  it('agreed drill-down excludes Pending+Agreed (pendingDecision=false)', () => {
    const href = buildAgreedSessionsHref({
      from: '2026-09-01',
      toExclusive: '2026-10-01',
      counselorId: 'c1',
    });
    expect(href).toContain('patientAgreedToSurgery=true');
    expect(href).toContain('pendingDecision=false');
    expect(href).toContain('counselorId=c1');
    expect(href).not.toContain('surgery-followup');
  });

  it('conversion drill-down matches Agreed partition', () => {
    const href = buildConversionSessionsHref({
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    });
    expect(href).toContain('patientAgreedToSurgery=true');
    expect(href).toContain('pendingDecision=false');
    expect(href).toContain('analyticsOutcome=Conversion');
  });

  it('pending drill-down uses pendingDecision=true', () => {
    const href = buildPendingDecisionSessionsHref({
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    });
    expect(href).toContain('pendingDecision=true');
  });

  it('total sessions drill-down includes date window', () => {
    const href = buildTotalSessionsHref({
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    });
    expect(href).toContain('sessionDateFrom=2026-09-01');
    expect(href).toContain('sessionDateTo=2026-09-30');
  });

  it('aging bucket 15+ intersects with aging window floor', () => {
    const today = '2026-09-12';
    const dates = agingBucketSessionDates(
      'bucket_15_plus',
      '2026-06-01',
      '2026-10-01',
      today,
    );
    expect(dates).toEqual({
      sessionDateFrom: '2026-06-01',
      sessionDateTo: '2026-08-28',
    });
  });

  it('buildSessionListHref omits empty filters', () => {
    expect(buildSessionListHref({})).toBe('/dashboard/counsellors-desk/sessions');
  });
});

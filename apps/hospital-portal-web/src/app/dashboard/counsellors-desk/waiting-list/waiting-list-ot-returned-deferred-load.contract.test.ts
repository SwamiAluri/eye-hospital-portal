import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

function otReturnedLoadEffect(src: string): string {
  const start = src.indexOf('const loadOtReturned = async');
  expect(start).toBeGreaterThan(-1);
  const effectStart = src.lastIndexOf('useEffect(', start);
  expect(effectStart).toBeGreaterThan(-1);
  const nextEffect = src.indexOf('const refetchWaitingList', start);
  expect(nextEffect).toBeGreaterThan(start);
  return src.slice(effectStart, nextEffect);
}

describe('PERF-02 Waiting List OT Returned deferred load', () => {
  const effect = otReturnedLoadEffect(pageSrc);

  it('does not request OT-return journeys or sessions until the OT Returned tab is selected', () => {
    const gate = effect.indexOf("if (activeTab !== 'OtReturned') return;");
    const loadCall = effect.indexOf('void loadOtReturned();');
    const journeys = effect.indexOf('ipManagementApi.listJourneys');
    const sessions = effect.indexOf('counselingSessionsApi.getPatientSessions');
    expect(gate).toBeGreaterThan(-1);
    expect(loadCall).toBeGreaterThan(gate);
    expect(journeys).toBeGreaterThan(gate);
    expect(sessions).toBeGreaterThan(gate);
    expect(effect).toContain("clinicalState: 'ReadyForSurgery'");
    expect(effect).toContain('activeTab');
  });

  it('keeps the existing loading, membership, and error path inside loadOtReturned', () => {
    expect(effect).toContain('setOtReturnedLoading(true)');
    expect(effect).toContain('filterOtReturnedOperationalRows');
    expect(effect).toContain("toast.error('Failed to load OT-returned patients')");
    expect(effect).toContain('setOtReturnedRows([])');
  });

  it('gates the visibility reload of loadOtReturned and leaves the waiting-list refetch separate', () => {
    const gate = effect.indexOf("if (activeTab !== 'OtReturned') return;");
    const visibleReload = effect.indexOf("document.visibilityState === 'visible'");
    expect(gate).toBeGreaterThan(-1);
    expect(visibleReload).toBeGreaterThan(gate);
    expect(effect).toContain('void loadOtReturned()');
    expect(effect).not.toContain('refetchWaitingList');

    const waitingListRefetch = pageSrc.indexOf('void refetchWaitingList()');
    expect(waitingListRefetch).toBeGreaterThan(-1);
    const waitingListEffect = pageSrc.slice(
      pageSrc.lastIndexOf('useEffect(', waitingListRefetch),
      pageSrc.indexOf('useEffect(', waitingListRefetch + 1),
    );
    expect(waitingListEffect).toContain('void refetchWaitingList()');
    expect(waitingListEffect).not.toContain('listJourneys');
    expect(waitingListEffect).not.toContain('getPatientSessions');
    expect(pageSrc).toContain('useWaitingListQuery');
  });
});

describe('PD-LD-02 OT Returned summary pending presentation', () => {
  it('does not treat an in-flight OT Returned count as a resolved zero', () => {
    expect(pageSrc).toContain('setOtReturnedReady(true)');
    expect(pageSrc).toContain('countsPending={isLoading}');
    expect(pageSrc).toContain("isOtTab && !otReturnedReady ? ['OtReturned'] : undefined");
    expect(pageSrc).toContain('otReturnedLoading || !otReturnedReady');
    expect(pageSrc).toContain("if (activeTab !== 'OtReturned') return;");
    expect(pageSrc).toContain('ipManagementApi.listJourneys');
  });
});

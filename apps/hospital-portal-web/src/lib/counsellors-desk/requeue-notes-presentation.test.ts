import { describe, expect, it } from 'vitest';
import {
  composeCounsellorAdditionalNotes,
  formatRequeueEventDate,
  parseCounsellorAdditionalNotes,
  requeueHistoryEntriesFromAdditionalNotes,
} from './requeue-notes-presentation';

describe('requeue-notes-presentation', () => {
  it('parses system ReQueue lines apart from counsellor working notes', () => {
    const parsed = parseCounsellorAdditionalNotes(
      '\n[Re-queue 2026-09-21] Test\nDiscussed package options\n',
    );
    expect(parsed.requeueEvents).toEqual([
      {
        date: '2026-09-21',
        reason: 'Test',
        raw: '[Re-queue 2026-09-21] Test',
      },
    ]);
    expect(parsed.workingNotes).toBe('Discussed package options');
  });

  it('keeps multiple historical ReQueue lines (never deletes history)', () => {
    const raw =
      '[Re-queue 2026-09-01] First\n[Re-queue 2026-09-21] Test\nFollow-up notes';
    const parsed = parseCounsellorAdditionalNotes(raw);
    expect(parsed.requeueEvents).toHaveLength(2);
    expect(parsed.workingNotes).toBe('Follow-up notes');
    expect(composeCounsellorAdditionalNotes(parsed.requeueEvents, parsed.workingNotes)).toBe(raw);
  });

  it('round-trips when working notes are edited without touching ReQueue lines', () => {
    const parsed = parseCounsellorAdditionalNotes('[Re-queue 2026-09-21] Test\nOld note');
    const next = composeCounsellorAdditionalNotes(parsed.requeueEvents, 'New counsellor note');
    expect(next).toBe('[Re-queue 2026-09-21] Test\nNew counsellor note');
    expect(parseCounsellorAdditionalNotes(next).requeueEvents[0]?.reason).toBe('Test');
  });

  it('formats ReQueue dates for read-only presentation', () => {
    expect(formatRequeueEventDate('2026-09-21')).toBe('21 Sep 2026');
  });

  it('treats notes without ReQueue prefixes as fully editable working notes', () => {
    const parsed = parseCounsellorAdditionalNotes('Ordinary note');
    expect(parsed.requeueEvents).toEqual([]);
    expect(parsed.workingNotes).toBe('Ordinary note');
  });

  it('builds History fallback entries from AdditionalNotes when OwnershipRequeued is absent', () => {
    const entries = requeueHistoryEntriesFromAdditionalNotes(
      '[Re-queue 2026-09-21] Test\nWorking note',
      new Set(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.changeType).toBe('OwnershipRequeued');
    expect(entries[0]?.reason).toBe('Test');
    expect(entries[0]?.changedBy).toBe('');
    expect(entries[0]?.changedAt).toBe('2026-09-21T12:00:00.000Z');
  });

  it('does not duplicate AdditionalNotes markers when OwnershipRequeued already has the reason', () => {
    const entries = requeueHistoryEntriesFromAdditionalNotes(
      '[Re-queue 2026-09-21] Test',
      new Set(['test']),
    );
    expect(entries).toEqual([]);
  });
});

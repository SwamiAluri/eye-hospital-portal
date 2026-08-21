import { describe, expect, it } from 'vitest';
import { mapPreOpReadinessFromApi, parsePreOpReadinessApiDto } from './preop-readiness-api';

describe('preop-readiness-api', () => {
  it('maps backend DTO to workspace readiness', () => {
    const readiness = mapPreOpReadinessFromApi({
      steps: [
        {
          key: 'investigations',
          completed: 2,
          total: 3,
          blocking: 1,
          status: 'in-progress',
          locked: false,
          hasCount: true,
        },
        {
          key: 'evaluation',
          completed: 0,
          total: 0,
          blocking: 0,
          status: 'not-started',
          locked: true,
          hasCount: false,
        },
      ],
      readySteps: 0,
      countableSteps: 1,
      blockers: 1,
    });

    expect(readiness.readySteps).toBe(0);
    expect(readiness.countableSteps).toBe(1);
    expect(readiness.byKey.investigations.blocking).toBe(1);
    expect(readiness.byKey.evaluation.locked).toBe(true);
  });

  it('parses PascalCase backend payloads', () => {
    const parsed = parsePreOpReadinessApiDto({
      Steps: [
        {
          Key: 'consent',
          Completed: 1,
          Total: 1,
          Blocking: 0,
          Status: 'completed',
          Locked: false,
          HasCount: true,
        },
      ],
      ReadySteps: 1,
      CountableSteps: 1,
      Blockers: 0,
    });

    expect(parsed?.steps[0].key).toBe('consent');
    expect(parsed?.readySteps).toBe(1);
  });

  it('rejects journey summary payloads without steps', () => {
    expect(parsePreOpReadinessApiDto({ readinessCompleted: 2, readinessTotal: 5 })).toBeNull();
    expect(parsePreOpReadinessApiDto(null)).toBeNull();
    expect(parsePreOpReadinessApiDto({ steps: [] })).toBeNull();
  });
});

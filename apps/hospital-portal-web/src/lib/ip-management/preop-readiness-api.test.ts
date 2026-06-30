import { describe, expect, it } from 'vitest';
import { mapPreOpReadinessFromApi } from './preop-readiness-api';

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
});

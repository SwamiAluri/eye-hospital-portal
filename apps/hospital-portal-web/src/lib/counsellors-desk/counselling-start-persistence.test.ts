import { describe, expect, it } from 'vitest';
import { assertCounsellingStartReachedProcessing } from './counselling-start-persistence';

describe('assertCounsellingStartReachedProcessing', () => {
  it('accepts Processed (Waiting List / header Processing)', () => {
    expect(() => assertCounsellingStartReachedProcessing('Processed')).not.toThrow();
  });

  it('rejects Pending — Start did not move Auth queue Waiting → InProgress', () => {
    expect(() => assertCounsellingStartReachedProcessing('Pending')).toThrow(
      /did not persist Processing/,
    );
  });

  it('rejects Done / Repeat / null', () => {
    expect(() => assertCounsellingStartReachedProcessing('Done')).toThrow();
    expect(() => assertCounsellingStartReachedProcessing('RepeatCounselling')).toThrow();
    expect(() => assertCounsellingStartReachedProcessing(null)).toThrow();
  });
});

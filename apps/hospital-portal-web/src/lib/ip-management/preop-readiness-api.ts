import type { PreOpReadinessApiDto } from '@/lib/api/ip-management.api';
import type { PreOpReadiness, StepReadiness } from '@/lib/ip-management/preop-readiness';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';

function asStepKey(key: string): PreOpStepKey {
  return key as PreOpStepKey;
}

function asStatus(status: string): PreOpStatus {
  return status as PreOpStatus;
}

/** Map the Phase 8 backend rollup into the workspace UI model. */
export function mapPreOpReadinessFromApi(dto: PreOpReadinessApiDto): PreOpReadiness {
  const steps: StepReadiness[] = dto.steps.map(s => ({
    key: asStepKey(s.key),
    completed: s.completed,
    total: s.total,
    blocking: s.blocking,
    status: asStatus(s.status),
    locked: s.locked,
    hasCount: s.hasCount,
  }));

  const byKey = Object.fromEntries(steps.map(s => [s.key, s])) as Record<PreOpStepKey, StepReadiness>;

  return {
    steps,
    byKey,
    readySteps: dto.readySteps,
    countableSteps: dto.countableSteps,
    blockers: dto.blockers,
  };
}

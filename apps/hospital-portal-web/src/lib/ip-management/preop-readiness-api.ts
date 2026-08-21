import type { PreOpReadinessApiDto, StepReadinessApiDto } from '@/lib/api/ip-management.api';
import type { PreOpReadiness, StepReadiness } from '@/lib/ip-management/preop-readiness';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';

function asStepKey(key: string): PreOpStepKey {
  return key as PreOpStepKey;
}

function asStatus(status: string): PreOpStatus {
  return status as PreOpStatus;
}

function readField<T>(raw: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  const value = raw[camel] ?? raw[pascal];
  return value as T | undefined;
}

function normalizeStepApiDto(raw: unknown): StepReadinessApiDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const key = readField<string>(s, 'key', 'Key');
  if (!key) return null;
  return {
    key,
    completed: Number(readField<number>(s, 'completed', 'Completed') ?? 0),
    total: Number(readField<number>(s, 'total', 'Total') ?? 0),
    blocking: Number(readField<number>(s, 'blocking', 'Blocking') ?? 0),
    status: String(readField<string>(s, 'status', 'Status') ?? 'not-started'),
    locked: Boolean(readField<boolean>(s, 'locked', 'Locked')),
    hasCount: Boolean(readField<boolean>(s, 'hasCount', 'HasCount')),
  };
}

/** Accept camelCase or PascalCase payloads from GET …/pre-op/readiness. */
export function parsePreOpReadinessApiDto(dto: unknown): PreOpReadinessApiDto | null {
  if (!dto || typeof dto !== 'object') return null;
  const raw = dto as Record<string, unknown>;
  const stepsRaw = readField<unknown[]>(raw, 'steps', 'Steps');
  if (!Array.isArray(stepsRaw)) return null;

  const steps = stepsRaw
    .map(normalizeStepApiDto)
    .filter((s): s is StepReadinessApiDto => s !== null);
  if (steps.length === 0) return null;

  return {
    steps,
    readySteps: Number(readField<number>(raw, 'readySteps', 'ReadySteps') ?? 0),
    countableSteps: Number(readField<number>(raw, 'countableSteps', 'CountableSteps') ?? 0),
    blockers: Number(readField<number>(raw, 'blockers', 'Blockers') ?? 0),
  };
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

import { optometrySegmentApi } from '@/lib/api/optometry-segment.api';
import type { OptometrySegmentKey } from './optometry-segment-keys';

/**
 * Upsert a visit segment bundle (canonical per-visit store).
 * Used by Record section, MH Save, and Save exam (Phase 2+).
 */
export async function persistSegmentBundle(
  visitId: string,
  patientId: string,
  segmentKey: OptometrySegmentKey | string,
  data: unknown,
): Promise<void> {
  await optometrySegmentApi.upsertSegment(visitId, segmentKey, {
    patientId,
    data,
  });
}

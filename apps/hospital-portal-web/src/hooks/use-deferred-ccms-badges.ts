'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WaitingListPatient } from '@/types/counsellors-desk';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';

const MAX_BATCH = 40;

/** Per-session CCMS badge resolution for Waiting List. */
export type DeferredCcmsBadge =
  | { status: 'pending' }
  | { status: 'none' }
  | { status: 'ready'; state: string };

/**
 * Loads CCMS pre-auth badge states after idle for coverage patientType rows.
 * Uses Waiting List `patientType` (API contract) — not a separate paymentType field.
 *
 * `none` = fetch completed, no coverage case for session (not Pre-Auth Queue).
 * `ready` = case exists with currentState.
 */
export function useDeferredCcmsBadges(visiblePatients: WaitingListPatient[]) {
  const [badges, setBadges] = useState<Record<string, DeferredCcmsBadge>>({});
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const pendingIdsKey = useMemo(() => {
    const ids = visiblePatients
      .filter((p) => isCoveragePaymentTypeValue(p.patientType) && p.id)
      .map((p) => p.id)
      .filter((id) => !loadedIdsRef.current.has(id))
      .slice(0, MAX_BATCH)
      .sort();
    return ids.join(',');
  }, [visiblePatients]);

  useEffect(() => {
    if (!pendingIdsKey) return;

    const sessionIds = pendingIdsKey.split(',').filter(Boolean);
    if (sessionIds.length === 0) return;

    let cancelled = false;

    const fetchBadges = async () => {
      try {
        const { getCasesBySessionIds } = await import('@/lib/api/ccms/ccms-coverage-cases.api');
        const cases = await getCasesBySessionIds(sessionIds);
        if (cancelled) return;

        const map: Record<string, DeferredCcmsBadge> = {};
        sessionIds.forEach((id) => {
          map[id] = { status: 'none' };
        });
        cases.forEach((c) => {
          const sid =
            (c as unknown as { sessionId?: string }).sessionId ??
            (c as unknown as { counselingSessionId?: string }).counselingSessionId;
          if (sid && c.currentState) {
            map[String(sid)] = { status: 'ready', state: c.currentState };
          }
        });

        sessionIds.forEach((id) => loadedIdsRef.current.add(id));
        setBadges((prev) => ({ ...prev, ...map }));
      } catch {
        // CCMS offline — leave unresolved so UI does not invent Pre-Auth Queue membership
      }
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      void fetchBadges();
    };

    if (typeof requestIdleCallback !== 'undefined') {
      idleId = requestIdleCallback(schedule, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(schedule, 400);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [pendingIdsKey]);

  return badges;
}

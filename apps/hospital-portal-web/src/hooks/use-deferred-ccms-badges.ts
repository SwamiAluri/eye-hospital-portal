'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WaitingListPatient } from '@/types/counsellors-desk';

const INSURANCE_PAYMENT_TYPES = new Set([
  'Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme',
]);

const MAX_BATCH = 40;

/** Loads CCMS pre-auth badge states after idle, only for visible insurance rows not yet fetched. */
export function useDeferredCcmsBadges(visiblePatients: WaitingListPatient[]) {
  const [ccmsStates, setCcmsStates] = useState<Record<string, string>>({});
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const pendingIdsKey = useMemo(() => {
    const ids = visiblePatients
      .filter(p => INSURANCE_PAYMENT_TYPES.has(p.paymentType as string) && p.id)
      .map(p => p.id)
      .filter(id => !loadedIdsRef.current.has(id))
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

        const map: Record<string, string> = {};
        cases.forEach(c => {
          const sid = (c as unknown as { sessionId?: string }).sessionId
            ?? (c as unknown as { counselingSessionId?: string }).counselingSessionId;
          if (sid) map[String(sid)] = c.currentState;
        });

        sessionIds.forEach(id => loadedIdsRef.current.add(id));
        setCcmsStates(prev => ({ ...prev, ...map }));
      } catch {
        // CCMS offline — badges simply won't show
      }
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => { void fetchBadges(); };

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

  return ccmsStates;
}

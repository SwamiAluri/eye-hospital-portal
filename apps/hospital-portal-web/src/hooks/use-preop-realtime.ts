'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  acquireNotificationConnection,
  releaseNotificationConnection,
  startNotificationConnection,
  isSignalRAbortError,
} from '@/lib/signalr/notification-hub';

const PREOP_EVENT_TYPES = new Set([
  'WardJourneyChanged',
  'PreOpSectionRequest',
  'PreOpSectionResponse',
  'PreOpSectionOnHold',
  'PreOpSectionRejected',
  'PreOpSectionNeedsInfo',
  'PreOpSectionEscalated',
  'PreOpMarkReady',
]);

function journeyIdFromDetails(details: string | undefined, fallbackJourneyId: string): boolean {
  if (!details) return false;
  if (details.includes(fallbackJourneyId)) return true;
  try {
    const parsed = JSON.parse(details) as { journeyId?: string };
    return parsed.journeyId === fallbackJourneyId;
  } catch {
    return false;
  }
}

/**
 * Quietly refreshes an open pre-op workspace when a relevant SignalR event arrives
 * for the same journey (Phase 9). Reuses the shared notification hub connection.
 */
export function usePreOpRealtime(journeyId: string, onChange: () => void): void {
  const token = useAuthStore(s => s.token);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!token || !journeyId) return;

    let mounted = true;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const connection = acquireNotificationConnection(token);

    const handler = (type: string, _message: string, details?: string) => {
      if (!PREOP_EVENT_TYPES.has(type)) return;
      if (!journeyIdFromDetails(details, journeyId)) return;

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (mounted) onChangeRef.current();
      }, 800);
    };

    connection.on('ReceiveNotification', handler);
    startNotificationConnection(connection).catch(err => {
      if (!isSignalRAbortError(err) && process.env.NODE_ENV === 'development') {
        console.warn('[preop-realtime] hub connect failed', err);
      }
    });

    return () => {
      mounted = false;
      if (debounce) clearTimeout(debounce);
      connection.off('ReceiveNotification', handler);
      releaseNotificationConnection();
    };
  }, [token, journeyId]);
}

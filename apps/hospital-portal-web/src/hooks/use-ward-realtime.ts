'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  acquireNotificationConnection,
  releaseNotificationConnection,
  startNotificationConnection,
  isSignalRAbortError,
} from '@/lib/signalr/notification-hub';

// Cross-service notification types (pushed by ip-management → auth-service hub) that
// mean the ward board should refresh.
const WARD_EVENT_TYPES = new Set([
  'WardJourneyChanged',
  'PatientReceivedFromOt',
  'SurgeryCancelledRebook',
  'PreOpSectionRequest',
  'PreOpSectionResponse',
  'PreOpSectionOnHold',
  'PreOpSectionRejected',
  'PreOpMarkReady',
]);

/**
 * Subscribes the Ward Command Center to the shared `/notificationHub` connection and
 * invokes `onChange` (debounced) when a ward-relevant event arrives. Reuses the
 * app-wide SignalR connection (ref-counted), so it is safe to mount alongside
 * `useNotifications`. The 45s quiet poll on the ward page remains as a fallback.
 */
export function useWardRealtime(onChange: () => void): void {
  const token = useAuthStore(s => s.token);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const connection = acquireNotificationConnection(token);

    const handler = (type: string, _message: string, _details?: string) => {
      if (!WARD_EVENT_TYPES.has(type)) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (mounted) onChangeRef.current();
      }, 1500);
    };

    connection.on('ReceiveNotification', handler);
    startNotificationConnection(connection).catch(err => {
      // Non-fatal — the ward page's quiet poll covers us if the hub is unavailable.
      if (!isSignalRAbortError(err) && process.env.NODE_ENV === 'development') {
        console.warn('[ward-realtime] hub connect failed', err);
      }
    });

    return () => {
      mounted = false;
      if (debounce) clearTimeout(debounce);
      connection.off('ReceiveNotification', handler);
      releaseNotificationConnection();
    };
  }, [token]);
}

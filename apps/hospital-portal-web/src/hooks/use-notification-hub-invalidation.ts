'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  acquireNotificationConnection,
  isSignalRAbortError,
  releaseNotificationConnection,
  startNotificationConnection,
} from '@/lib/signalr/notification-hub';

/**
 * Shared `/notificationHub` listener. Debounces then runs `onMatch`.
 * Does not apply payload fields to UI — callers invalidate React Query.
 */
export function useNotificationHubInvalidation(
  shouldHandle: (type: string) => boolean,
  onMatch: () => void,
): void {
  const token = useAuthStore(s => s.token);
  const onMatchRef = useRef(onMatch);
  const shouldHandleRef = useRef(shouldHandle);
  onMatchRef.current = onMatch;
  shouldHandleRef.current = shouldHandle;

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const connection = acquireNotificationConnection(token);

    const handler = (type: string, _message?: string, _details?: string) => {
      if (!shouldHandleRef.current(type)) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (mounted) onMatchRef.current();
      }, 1500);
    };

    connection.on('ReceiveNotification', handler);
    startNotificationConnection(connection).catch(err => {
      if (!isSignalRAbortError(err) && process.env.NODE_ENV === 'development') {
        console.warn('[notification-hub-invalidation] connect failed', err);
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

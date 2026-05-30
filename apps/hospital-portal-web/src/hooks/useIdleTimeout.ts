'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { logoutEverywhere } from '@/lib/logout-everywhere';
import { refreshAccessToken } from '@/lib/token-refresh';
import {
  ACTIVITY_THROTTLE_MS,
  IDLE_TIMEOUT_MS,
  WARNING_MS,
} from '@/lib/session-idle-config';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'pointerdown',
  'touchstart',
  'click',
] as const;

export function useIdleTimeout() {
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname();
  const lastActivityRef = useRef(Date.now());
  const showWarningRef = useRef(false);

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_MS / 1000));

  const isAuthRoute = pathname?.startsWith('/auth') ?? false;
  const enabled = !!token && !isAuthRoute;

  showWarningRef.current = showWarning;

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsLeft(Math.ceil(WARNING_MS / 1000));
  }, []);

  // Track user activity (per-tab only; throttled)
  useEffect(() => {
    if (!enabled) return;

    let lastThrottle = 0;
    const onActivity = () => {
      if (showWarningRef.current) return;
      const now = Date.now();
      if (now - lastThrottle < ACTIVITY_THROTTLE_MS) return;
      lastThrottle = now;
      lastActivityRef.current = now;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity();
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  // Poll for idle threshold
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (showWarningRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        setShowWarning(true);
        setSecondsLeft(Math.ceil(WARNING_MS / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Countdown while warning is visible
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void logoutEverywhere('idle-timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning]);

  const staySignedIn = useCallback(async () => {
    resetIdle();
    await refreshAccessToken().catch(() => undefined);
  }, [resetIdle]);

  const signOut = useCallback(() => {
    void logoutEverywhere('user');
  }, []);

  return {
    enabled,
    showWarning,
    secondsLeft,
    staySignedIn,
    signOut,
  };
}

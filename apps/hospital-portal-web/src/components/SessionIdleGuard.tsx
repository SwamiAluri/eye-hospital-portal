'use client';

import { useCallback } from 'react';
import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { WARNING_MS } from '@/lib/session-idle-config';

const WARNING_TOTAL_SECONDS = Math.ceil(WARNING_MS / 1000);

/**
 * Per-tab idle timeout with warning modal.
 * Cross-tab logout is handled in AuthProvider via subscribeLogoutBroadcast.
 */
export function SessionIdleGuard() {
  const { enabled, showWarning, secondsLeft, staySignedIn, signOut } = useIdleTimeout();

  const handleStaySignedIn = useCallback(() => {
    void staySignedIn();
  }, [staySignedIn]);

  if (!enabled || !showWarning) return null;

  return (
    <SessionTimeoutModal
      open
      secondsLeft={secondsLeft}
      warningTotalSeconds={WARNING_TOTAL_SECONDS}
      onStaySignedIn={handleStaySignedIn}
      onSignOut={signOut}
    />
  );
}

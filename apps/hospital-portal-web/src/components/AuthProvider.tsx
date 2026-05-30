'use client';

import { useEffect } from 'react';
import { hydrateAuthFromStorage } from '@/lib/auth-store';
import { initializeApi } from '@/lib/api';
import { initCcmsApi } from '@/lib/api/ccms/ccms-base';
import { SessionIdleGuard } from '@/components/SessionIdleGuard';
import { subscribeLogoutBroadcast, logoutEverywhere } from '@/lib/logout-everywhere';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrateAuthFromStorage();
    initializeApi();
    initCcmsApi();

    return subscribeLogoutBroadcast((reason) => {
      void logoutEverywhere(reason, { broadcast: false });
    });
  }, []);

  return (
    <>
      {children}
      <SessionIdleGuard />
    </>
  );
}

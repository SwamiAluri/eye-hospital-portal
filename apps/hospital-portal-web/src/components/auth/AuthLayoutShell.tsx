'use client';

import type { ReactNode } from 'react';
import { AuthTenantProvider } from './AuthTenantContext';
import { AuthHeroSlideshow } from './AuthHeroSlideshow';
import { AuthStatusFooter } from './AuthStatusFooter';
import { AuthBodyLock } from './AuthBodyLock';

export function AuthLayoutShell({ children }: { children: ReactNode }) {
  return (
    <AuthTenantProvider>
      <AuthBodyLock />
      <div className="auth-oc auth-shell h-dvh max-h-dvh min-h-0 flex overflow-hidden bg-oc-background">
        <AuthHeroSlideshow />

        <main className="auth-main w-full lg:w-1/2 h-full min-h-0 grid grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-oc-surface-container-low">
          <div className="auth-main-body min-h-0 overflow-hidden flex flex-col auth-shell-pad">
            <div
              className="auth-content-column mx-auto w-full min-h-0 flex flex-col auth-panel-gap"
              id="main-content"
            >
              {children}
            </div>
          </div>
          <AuthStatusFooter />
        </main>
      </div>
    </AuthTenantProvider>
  );
}

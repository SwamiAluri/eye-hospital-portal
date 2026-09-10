'use client';

import { useAuthStore } from '@/lib/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLoadingSkeleton } from '@/components/DashboardLoadingSkeleton';
import { Toaster } from 'react-hot-toast';
import { useDensityBandAttribute } from '@/lib/layout/use-density-band';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore(s => s.token);
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useDensityBandAttribute();

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Immersive routes hide TopNav/sidebar for full-bleed kiosk views only
  const immersiveRoutes = ['/dashboard/frontdesk/queue-display'];
  const isImmersive = immersiveRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  // No-pad routes: keep TopNav but render children directly (no padding wrapper, no outer scroll)
  const noPadRoutes = [
    '/dashboard/counselor/analytics',
    '/dashboard/optometrist/exam',
    '/dashboard/counsellors-desk/waiting-list',
    '/dashboard/counsellors-desk/finalize-surgery',
  ];
  const isCounsellingSessionPage =
    /^\/dashboard\/counsellors-desk\/[^/]+$/.test(pathname) &&
    pathname !== '/dashboard/counsellors-desk/waiting-list' &&
    pathname !== '/dashboard/counsellors-desk/finalize-surgery' &&
    pathname !== '/dashboard/counsellors-desk/surgery-followup';
  /** Counsellor ops worklists share the grey counselling canvas (no white padded shell). */
  const isCounsellingOpsCanvas =
    pathname === '/dashboard/counsellors-desk/waiting-list' ||
    pathname === '/dashboard/counsellors-desk/finalize-surgery';
  const isNoPad =
    noPadRoutes.some((r) => pathname.startsWith(r)) || isCounsellingSessionPage;

  useEffect(() => {
    setIsClient(true);
    setIsInIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    if (isClient && !token) {
      router.push('/auth/login');
    }
  }, [isClient, token, router]);

  if (!isClient || !token) {
    return <DashboardLoadingSkeleton />;
  }

  if (isInIframe || isImmersive) {
    return (
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {/* Phase 3: Toast notifications for real-time updates */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            duration: 6000,
          },
        }}
      />
      
      {/* Mobile/tablet drawer — mount only while open to avoid duplicate nav state/effects */}
      {sidebarOpen && (
        <Sidebar isMobileOpen onClose={closeSidebar} drawerOnly />
      )}

      <div
        data-testid="app-shell"
        className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-gray-100 p-[var(--shell-pad)] gap-[var(--shell-gap)]"
      >
        {/* Nav Sidebar card — desktop only (hidden below lg / 1024px) */}
        <div className="hidden lg:flex flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
          <Sidebar />
        </div>

        {/* Right column: TopNav + main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--shell-gap)] overflow-hidden">
          {!isImmersive && (
            <div className="rounded-2xl overflow-hidden shadow-md flex-shrink-0">
              <TopNav onMenuClick={openSidebar} />
            </div>
          )}
          <main
            id="main-content"
            tabIndex={-1}
            className={`min-h-0 flex-1 rounded-2xl shadow-sm outline-none ${
              isCounsellingSessionPage || isCounsellingOpsCanvas
                ? 'flex flex-col overflow-hidden bg-gray-100'
                : isNoPad
                  ? 'flex flex-col overflow-hidden bg-white'
                  : 'overflow-auto bg-white'
            }`}
            role="main"
            aria-label="Main content"
          >
            {isNoPad
              ? children
              : <div className={isImmersive ? '' : 'p-4'}>{children}</div>
            }
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

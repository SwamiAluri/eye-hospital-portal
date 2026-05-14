'use client';

import { useAuthStore } from '@/lib/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Immersive routes hide TopNav and remove wrapper padding for full-bleed dashboards
  const immersiveRoutes = ['/dashboard/optometrist', '/dashboard/optometrist/exam'];
  const isImmersive = immersiveRoutes.some(r => pathname === r);

  // No-pad routes: keep TopNav but render children directly (no padding wrapper, no outer scroll)
  const noPadRoutes = ['/dashboard/counselor/sessions', '/dashboard/counselor'];
  const isNoPad = noPadRoutes.some(r => pathname.startsWith(r));
  
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
    return null; // loading.tsx skeleton is shown by Next.js Suspense
  }

  // If in iframe, render only children without dashboard layout
  if (isInIframe) {
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
      
      {/* Mobile/tablet drawer — fixed position, rendered outside the layout flow */}
      <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} drawerOnly />

      <div className="flex h-screen bg-gray-100 p-3 gap-3 overflow-hidden">
        {/* Nav Sidebar card — desktop only (hidden below lg / 1024px) */}
        <div className="hidden lg:flex flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
          <Sidebar />
        </div>

        {/* Right column: TopNav + main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 gap-3">
          {!isImmersive && (
            <div className="rounded-2xl overflow-hidden shadow-md flex-shrink-0">
              <TopNav onMenuClick={() => setSidebarOpen(true)} />
            </div>
          )}
          <main id="main-content" className={`flex-1 min-h-0 rounded-2xl bg-white shadow-sm ${isNoPad ? 'overflow-hidden' : 'overflow-auto'}`} role="main" aria-label="Main content">
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

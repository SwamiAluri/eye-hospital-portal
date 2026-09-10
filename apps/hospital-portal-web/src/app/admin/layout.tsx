'use client';

import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useDensityBandAttribute } from '@/lib/layout/use-density-band';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [isClient, setIsClient] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useDensityBandAttribute();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !token) {
      router.push('/auth/login');
    }
  }, [isClient, token, router]);

  if (!isClient || !token) {
    return null; // loading.tsx skeleton shown by Next.js
  }

  return (
    <ProtectedRoute>
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
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' }, duration: 6000 },
        }}
      />

      {/* Mobile/tablet drawer */}
      <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} drawerOnly />

      <div
        data-testid="app-shell"
        className="flex h-screen min-h-0 min-w-0 overflow-hidden bg-gray-100 p-[var(--shell-pad)] gap-[var(--shell-gap)]"
      >
        {/* Sidebar card — desktop only */}
        <div className="hidden lg:flex flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
          <Sidebar />
        </div>

        {/* Right column: TopNav + main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--shell-gap)] overflow-hidden">
          <div className="rounded-2xl overflow-hidden shadow-md flex-shrink-0">
            <TopNav onMenuClick={() => setSidebarOpen(true)} />
          </div>
          <main
            id="main-content"
            className="flex-1 min-h-0 overflow-auto rounded-2xl bg-white shadow-sm"
            role="main"
            aria-label="Main content"
          >
            <div className="p-4">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

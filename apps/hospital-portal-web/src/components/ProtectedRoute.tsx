'use client';

import { useCachedAuthStore } from '@/lib/permission-cache';
import { useAuthStore } from '@/lib/auth-store';
import { DashboardLoadingSkeleton } from '@/components/DashboardLoadingSkeleton';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredAnyPermission,
  requiredRole,
  fallbackPath = '/dashboard/unauthorized'
}: {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  requiredRole?: string;
  fallbackPath?: string;
}) {
  const router = useRouter();
  const { token } = useCachedAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Only perform checks after hydration
    if (!isHydrated) return;

    const { hasPermission: checkPermission, hasRole: checkRole } = useAuthStore.getState();

    if (!token) {
      console.warn('🔒 ProtectedRoute: No token - redirecting to login');
      // Show session expired message if user was previously logged in
      const wasLoggedIn = typeof window !== 'undefined' && localStorage.getItem('user');
      if (wasLoggedIn) {
        setShowSessionExpired(prev => (prev ? prev : true));
        // Clear any stale data
        localStorage.clear();
      }
      
      // Redirect to login after showing message
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
      return;
    }

    if (requiredPermission && !checkPermission(requiredPermission)) {
      console.warn('🔒 ProtectedRoute: Missing permission:', requiredPermission);
      router.push(fallbackPath);
      return;
    }

    if (requiredAnyPermission?.length
        && !requiredAnyPermission.some(p => checkPermission(p))) {
      console.warn('🔒 ProtectedRoute: Missing any of permissions:', requiredAnyPermission.join(', '));
      router.push(fallbackPath);
      return;
    }

    if (requiredRole && !checkRole(requiredRole)) {
      console.warn('🔒 ProtectedRoute: Missing role:', requiredRole);
      router.push(fallbackPath);
      return;
    }
  }, [isHydrated, token, requiredPermission, requiredAnyPermission, requiredRole, router, fallbackPath]);

  // Show session expired message
  if (showSessionExpired) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-gray-600 mb-4">Your session has expired. Please log in again.</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Allow render when token is already in store; only block while hydrating with no token
  if (!isHydrated) {
    return token ? <>{children}</> : <DashboardLoadingSkeleton />;
  }

  if (!token) {
    return <DashboardLoadingSkeleton />;
  }

  return <>{children}</>;
}

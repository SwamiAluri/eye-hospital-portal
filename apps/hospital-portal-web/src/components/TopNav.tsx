'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/auth-store';
import { logoutEverywhere } from '@/lib/logout-everywhere';
import { BranchSwitcher } from '@/components/patients/lookup/BranchSwitcher';
import { Bell, LogOut, Menu } from 'lucide-react';

const LiveActivityFeed = dynamic(() => import('@/components/LiveActivityFeed'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      className="relative p-2 text-gray-600 rounded-full"
      aria-label="Activity Feed"
      disabled
    >
      <Bell className="w-6 h-6" />
    </button>
  ),
});

interface TopNavProps {
  onMenuClick?: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const user = useAuthStore(s => s.user);

  const initials = user
    ? `${(user.firstName?.[0] ?? '').toUpperCase()}${(user.lastName?.[0] ?? '').toUpperCase()}`
    : '?';

  return (
    <div className="h-14 px-5 flex items-center justify-between bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        {user && <BranchSwitcher />}
      </div>

      <div className="flex items-center gap-4">
        <LiveActivityFeed />

        {user && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-semibold select-none flex-shrink-0"
              style={{ backgroundColor: '#0f1e3c' }}
              title={`${user.firstName} ${user.lastName}`}
            >
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
          </div>
        )}

        <button
          onClick={() => void logoutEverywhere('user')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
          title="Logout"
        >
          <LogOut size={16} />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    </div>
  );
}

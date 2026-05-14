'use client';

import { useAuthStore } from '@/lib/auth-store';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

const LiveActivityFeed = dynamic(() => import('@/components/LiveActivityFeed'), {
  ssr: false,
  loading: () => <span className="w-8 h-8" />,
});
import { AudioRecorderPanel } from '@/components/counselor/AudioRecorderPanel';
import { Menu } from 'lucide-react';

interface TopNavProps {
  onMenuClick?: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();

  // Detect counselor session page and extract sessionId
  const sessionMatch = pathname?.match(/\/dashboard\/counselor\/sessions\/([^/]+)/);
  const counselorSessionId = sessionMatch?.[1] ?? null;

  // Build user initials for avatar
  const initials = user
    ? `${(user.firstName?.[0] ?? '').toUpperCase()}${(user.lastName?.[0] ?? '').toUpperCase()}`
    : '?';

  return (
    <div className="h-14 px-5 flex items-center justify-between bg-white">
      {/* Left: hamburger (mobile) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right: activity feed, user info, logout */}
      <div className="flex items-center gap-4">
        {/* Counselor session audio recorder */}
        {counselorSessionId && (
          <AudioRecorderPanel sessionId={counselorSessionId} autoStart={true} />
        )}

        {/* Live Activity Feed */}
        <LiveActivityFeed />

        {/* User avatar + name */}
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

        {/* Logout */}
        <button
          onClick={() => logout()}
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

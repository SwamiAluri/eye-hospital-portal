'use client';

import { useNotifications, NotificationEvent } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Bell, X, CheckCircle, AlertTriangle, Info, Shield } from 'lucide-react';
import { useState } from 'react';

/**
 * Live activity bell. SignalR connects only after the first open so dashboard
 * routes do not pay hub cost on every page mount.
 */
export default function LiveActivityFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const { notifications, clearNotifications, isConnected } = useNotifications({
    enabled: hasOpened,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_user_created':
      case 'user_deactivated':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'emergency_access':
      case 'breach_detected':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'license_expiring':
      case 'contract_expiring':
        return <Info className="w-5 h-5 text-yellow-600" />;
      case 'appointment_updated':
      case 'appointment_reminder':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'emergency_access':
      case 'breach_detected':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'license_expiring':
      case 'contract_expiring':
      case 'audit_threshold':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'new_user_created':
      case 'appointment_updated':
        return 'border-l-4 border-green-500 bg-green-50';
      case 'system_alert':
        return 'border-l-4 border-orange-500 bg-orange-50';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  };

  function toggleOpen() {
    if (!hasOpened) setHasOpened(true);
    setIsOpen(prev => !prev);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        title="Activity Feed"
      >
        <Bell className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
        {hasOpened && !isConnected && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" title="Disconnected"></span>
        )}
        {hasOpened && isConnected && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Connected"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

          <div className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">Live Activity Feed</h3>
                {isConnected && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                    title="Clear all"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[550px]">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">No notifications yet</p>
                  <p className="text-xs mt-1">You'll see live updates here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification: NotificationEvent, index: number) => (
                    <div
                      key={index}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors ${getNotificationColor(notification.type)}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {notification.message}
                          </p>
                          {notification.details && (
                            <p className="text-xs text-gray-600 mt-1 break-words">
                              {notification.details}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-2 text-center">
                <p className="text-xs text-gray-600">
                  Showing last {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

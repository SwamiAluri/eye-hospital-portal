'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/lib/auth-store';
import toast from 'react-hot-toast';
import {
  acquireNotificationConnection,
  releaseNotificationConnection,
  startNotificationConnection,
  isSignalRAbortError,
} from '@/lib/signalr/notification-hub';

export interface NotificationEvent {
  type: string;
  message: string;
  details?: string;
  timestamp: Date;
}

export function useNotifications(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const token = useAuthStore(s => s.token);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const handlersForConnection = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;

    let mounted = true;
    const newConnection = acquireNotificationConnection(token);

    if (handlersForConnection.current !== newConnection) {
      handlersForConnection.current = newConnection;

      newConnection.onreconnecting((error) => {
        setIsConnected(false);
        if (process.env.NODE_ENV === 'development') {
          console.warn('SignalR reconnecting...', error);
        }
        toast.loading('Reconnecting to live updates...', { id: 'signalr-reconnect' });
      });

      newConnection.onreconnected(() => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        toast.success('Reconnected to live updates', { id: 'signalr-reconnect' });
      });

      newConnection.onclose((error) => {
        setIsConnected(false);
        if (error && !isSignalRAbortError(error)) {
          toast.error('Connection to live updates lost');
        }
      });

    // Generic notification handler
    newConnection.on('ReceiveNotification', (type: string, message: string, details: string) => {
      const notification: NotificationEvent = {
        type,
        message,
        details,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep last 50
      toast(message, { icon: '📢', duration: 4000 });
    });

    // Phase 3: Enhanced notification handlers
    newConnection.on('NewUserCreated', (userId: string, userName: string) => {
      const notification: NotificationEvent = {
        type: 'new_user_created',
        message: `New user created: ${userName}`,
        details: `User ID: ${userId}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.success(`👤 New user: ${userName}`, { duration: 5000 });
    });

    newConnection.on('UserDeactivated', (userId: string, userName: string, reason: string) => {
      const notification: NotificationEvent = {
        type: 'user_deactivated',
        message: `User deactivated: ${userName}`,
        details: `Reason: ${reason}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.error(`⛔ User deactivated: ${userName}\n${reason}`, { duration: 6000 });
    });

    newConnection.on('EmergencyAccessGranted', (accessId: string, userId: string, resource: string) => {
      const notification: NotificationEvent = {
        type: 'emergency_access',
        message: `Emergency access granted to ${resource}`,
        details: `Access ID: ${accessId}, User ID: ${userId}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.error(`🚨 EMERGENCY ACCESS: ${resource}`, {
        duration: 10000,
        style: { background: '#fee', border: '2px solid #f00' },
      });
    });

    newConnection.on('LicenseExpiring', (licenseId: string, licenseName: string, expiryDate: Date) => {
      const notification: NotificationEvent = {
        type: 'license_expiring',
        message: `License expiring soon: ${licenseName}`,
        details: `Expires: ${new Date(expiryDate).toLocaleDateString()}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast(`⚠️ License expiring: ${licenseName}\nExpires: ${new Date(expiryDate).toLocaleDateString()}`, {
        icon: '📅',
        duration: 8000,
      });
    });

    newConnection.on('ContractExpiring', (contractId: string, employeeName: string, expiryDate: Date) => {
      const notification: NotificationEvent = {
        type: 'contract_expiring',
        message: `Contract expiring: ${employeeName}`,
        details: `Expires: ${new Date(expiryDate).toLocaleDateString()}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast(`⚠️ Contract expiring: ${employeeName}\nExpires: ${new Date(expiryDate).toLocaleDateString()}`, {
        icon: '📄',
        duration: 8000,
      });
    });

    newConnection.on('AuditThresholdExceeded', (metric: string, threshold: number, currentValue: number) => {
      const notification: NotificationEvent = {
        type: 'audit_threshold',
        message: `Audit threshold exceeded: ${metric}`,
        details: `${currentValue} / ${threshold}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.error(`📊 Audit Alert: ${metric}\n${currentValue} exceeds threshold of ${threshold}`, {
        duration: 8000,
      });
    });

    newConnection.on('SystemAlert', (alertType: string, severity: string, message: string) => {
      const notification: NotificationEvent = {
        type: 'system_alert',
        message: `${severity.toUpperCase()}: ${message}`,
        details: `Type: ${alertType}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));

      const toastOptions = {
        duration: severity === 'critical' ? 15000 : severity === 'high' ? 10000 : 6000,
        style: severity === 'critical' ? { background: '#fee', border: '2px solid #f00' } : undefined,
      };
      
      if (severity === 'critical') {
        toast.error(`🔴 CRITICAL: ${message}`, toastOptions);
      } else if (severity === 'high') {
        toast.error(`⚠️ ${message}`, toastOptions);
      } else {
        toast(`ℹ️ ${message}`, toastOptions);
      }
    });

    newConnection.on('BreachDetected', (eventType: string, severity: string, description: string) => {
      const notification: NotificationEvent = {
        type: 'breach_detected',
        message: `Security breach detected: ${eventType}`,
        details: description,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.error(`🚨 SECURITY BREACH: ${eventType}\n${description}`, {
        duration: 15000,
        style: { background: '#fee', border: '3px solid #f00', fontWeight: 'bold' },
      });
    });

    newConnection.on('MfaRequired', (userId: string, reason: string) => {
      const notification: NotificationEvent = {
        type: 'mfa_required',
        message: 'Multi-factor authentication required',
        details: reason,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast(`🔐 MFA Required: ${reason}`, { icon: '🔒', duration: 8000 });
    });

    newConnection.on('DeviceApprovalRequired', (deviceId: string, deviceName: string, location: string) => {
      const notification: NotificationEvent = {
        type: 'device_approval',
        message: `Device approval required: ${deviceName}`,
        details: `Location: ${location}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast(`📱 New device needs approval\n${deviceName} from ${location}`, {
        icon: '🔒',
        duration: 10000,
      });
    });

    // Appointment notifications (existing)
    newConnection.on('AppointmentUpdated', (appointmentId: string, status: string) => {
      const notification: NotificationEvent = {
        type: 'appointment_updated',
        message: `Appointment ${appointmentId} updated`,
        details: `New status: ${status}`,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast.success(`📅 Appointment updated: ${status}`);
    });

    newConnection.on('AppointmentReminder', (appointmentId: string, details: string) => {
      const notification: NotificationEvent = {
        type: 'appointment_reminder',
        message: 'Upcoming appointment reminder',
        details,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      toast(`🔔 Appointment Reminder\n${details}`, { icon: '📅', duration: 8000 });
    });

    // ── Surgery Confirmed ─────────────────────────────────────────────────────
    // Fired by OTBookingSystemService.ConfirmBookingAsync → notifies counselor role
    newConnection.on('ReceiveNotification', (type: string, message: string, details: string) => {
      if (type === 'SurgeryConfirmed') {
        let scheduleId: string | undefined;
        let patientName: string | undefined;
        try {
          const parsed = JSON.parse(details || '{}');
          scheduleId = parsed.scheduleId;
          patientName = parsed.patientName;
        } catch { /* ignore */ }

        const notification: NotificationEvent = {
          type: 'surgery_confirmed',
          message,
          details,
          timestamp: new Date(),
        };
        setNotifications((prev) => [notification, ...prev].slice(0, 50));

        toast.success(
          patientName ? `🔪 Surgery confirmed: ${patientName}` : '🔪 Surgery confirmed',
          {
            duration: 8000,
            ...(scheduleId && {
              onClick: () => {
                window.location.href = `/dashboard/counsellors-desk/finalize-surgery${scheduleId ? `?scheduleId=${scheduleId}` : ''}`;
              },
            }),
          }
        );
        return; // handled — don't fall through to generic handler below
      }

      // ── Dept Coord Response ───────────────────────────────────────────────
      // Fired by DeptCoordinationService.RespondToRequestAsync → notifies counselor
      if (type === 'DeptCoordResponse') {
        let scheduleId: string | undefined;
        let department: string | undefined;
        let status: string | undefined;
        try {
          const parsed = JSON.parse(details || '{}');
          scheduleId = parsed.scheduleId;
          department = parsed.department;
          status = parsed.status;
        } catch { /* ignore */ }

        const notification: NotificationEvent = {
          type: 'dept_coord_response',
          message,
          details,
          timestamp: new Date(),
        };
        setNotifications((prev) => [notification, ...prev].slice(0, 50));

        const label = department ? `${department} responded` : 'Department responded';
        const statusLabel = status ? ` — ${status}` : '';
        toast(
          `🏥 ${label}${statusLabel}`,
          {
            icon: '📋',
            duration: 8000,
            ...(scheduleId && {
              onClick: () => {
                window.location.href = `/dashboard/counsellors-desk/finalize-surgery${scheduleId ? `?scheduleId=${scheduleId}` : ''}`;
              },
            }),
          }
        );
      }
    });

    }

    // Start connection
    startNotificationConnection(newConnection)
      .then(() => {
        if (!mounted) return;
        setIsConnected(true);
        setConnection(newConnection);
        toast.success('Connected to live updates', { duration: 2000 });
      })
      .catch((err: Error) => {
        if (!mounted || isSignalRAbortError(err)) return;
        const msg = err?.message ?? '';
        if (msg.includes('404') || msg.includes('Not Found')) return;
        console.error('SignalR Connection Error:', err);
        reconnectAttempts.current++;
        if (reconnectAttempts.current < maxReconnectAttempts) {
          toast.error('Failed to connect to live updates. Retrying...');
        }
      });

    return () => {
      mounted = false;
      releaseNotificationConnection();
    };
  }, [enabled, token]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    connection,
    isConnected,
    notifications,
    clearNotifications,
  };
}

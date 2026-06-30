'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/lib/auth-store';
import { patientLookupKeys } from '@/hooks/use-patient-lookup-queries';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5073/api';

function queueHubUrl(): string {
  return API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '') + '/hubs/queue';
}

/**
 * Invalidate patient hub lookup queries when queue / visit events fire on SignalR.
 */
export function usePatientHubRealtime(branchId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const tenantId = useAuthStore((s) => s.tenantId);

  useEffect(() => {
    if (!enabled || !branchId || !token || !tenantId) return;

    const hubUrl = queueHubUrl();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .build();

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: patientLookupKeys.all });
    };

    connection.on('QueueUpdated', invalidate);
    connection.on('PatientStatusChanged', invalidate);
    connection.on('PatientCalled', invalidate);

    let cancelled = false;

    void connection
      .start()
      .then(() => {
        if (cancelled) return;
        return connection.invoke('SubscribeToQueue', branchId, null, 'all');
      })
      .catch(() => {
        // Hub may be unavailable in local dev — polling still applies via staleTime
      });

    return () => {
      cancelled = true;
      void connection.stop();
    };
  }, [enabled, branchId, token, tenantId, queryClient]);
}

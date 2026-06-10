'use client';

import { useMemo } from 'react';
import { useMasterValues, type MasterOption } from '@/hooks/use-master-values';

export interface StationOption {
  value: string;
  label: string;
}

export interface RoutingReasonOption {
  code: string;
  label: string;
}

export interface ServiceRoomOption {
  code: string;
  label: string;
  roomCode: string;
  branchId?: string;
  station?: string;
}

/** Fallback when station metadata is absent. */
const FRONTDESK_ROUTING_CODES = new Set(['optometrist', 'doctor', 'counselor']);

function isRoutableFromFrontdesk(option: MasterOption): boolean {
  const flag = option.metadata?.routableFromFrontdesk;
  if (typeof flag === 'boolean') return flag;
  return FRONTDESK_ROUTING_CODES.has(option.value.toLowerCase());
}

function mapStations(options: MasterOption[]): StationOption[] {
  return options.map((o) => ({ value: o.value, label: o.label }));
}

function parseServiceRooms(options: MasterOption[]): ServiceRoomOption[] {
  return options.map((o) => {
    const meta = o.metadata ?? {};
    return {
      code: o.value,
      label: o.label,
      roomCode: String(meta.roomCode ?? o.value),
      branchId: meta.branchId ? String(meta.branchId) : undefined,
      station: meta.station ? String(meta.station) : undefined,
    };
  });
}

export function useOperationsStations() {
  const { options, loading, error, refetch } = useMasterValues('operations.station');
  return { stations: mapStations(options), loading, error, refetch };
}

export function useFrontdeskRoutingStations() {
  const { options, loading, error, refetch } = useMasterValues('operations.station');
  const stations = useMemo(
    () => mapStations(options.filter(isRoutableFromFrontdesk)),
    [options],
  );
  return { stations, loading, error, refetch };
}

export function useRoutingReasons() {
  const { options, loading, error, refetch } = useMasterValues('operations.routing_reason');
  const reasons = useMemo<RoutingReasonOption[]>(
    () => options.map((o) => ({ code: o.value, label: o.label })),
    [options],
  );
  return { reasons, loading, error, refetch };
}

export function useServiceRoomsFromMaster(branchId?: string, station?: string) {
  const { options, loading, error, refetch } = useMasterValues('operations.service_room');
  const rooms = useMemo(() => {
    let list = parseServiceRooms(options);
    if (station) {
      list = list.filter((r) => r.station === station);
    }
    if (branchId) {
      list = list.filter((r) => !r.branchId || r.branchId === branchId);
    }
    return list;
  }, [options, branchId, station]);
  return { rooms, loading, error, refetch };
}

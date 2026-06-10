import { getApi } from '../api';

export interface QueueDisplayPatient {
  visitId?: string;
  patientId?: string;
  tokenNumber: string;
  patientName: string;
  gender: string;
  ageCategory: string;
  urgency: string;
  isReturnVisit: boolean;
  passNumber: number;
  reasonLabel?: string;
}

export interface QueueDisplayRoomSlide {
  station: string;
  stationLabel: string;
  stationLabelTe?: string;
  roomCode: string;
  displayLabel: string;
  displayLabelTe?: string;
  nowServing: QueueDisplayPatient | null;
  nextQueue: QueueDisplayPatient[];
  staffName?: string;
}

export interface QueueDisplayTickerMessage {
  en: string;
  te: string;
}

export interface QueueDisplayBranchPayload {
  branchId: string;
  branchName: string;
  mode: string;
  rotationSeconds: number;
  generatedAt: string;
  tickerMessages: QueueDisplayTickerMessage[];
  slides: QueueDisplayRoomSlide[];
}

function mapPatient(raw: Record<string, unknown>): QueueDisplayPatient {
  return {
    visitId: raw.visitId != null ? String(raw.visitId) : raw.VisitId != null ? String(raw.VisitId) : undefined,
    patientId: raw.patientId != null ? String(raw.patientId) : raw.PatientId != null ? String(raw.PatientId) : undefined,
    tokenNumber: String(raw.tokenNumber ?? raw.TokenNumber ?? ''),
    patientName: String(raw.patientName ?? raw.PatientName ?? ''),
    gender: String(raw.gender ?? raw.Gender ?? '—'),
    ageCategory: String(raw.ageCategory ?? raw.AgeCategory ?? 'Adult'),
    urgency: String(raw.urgency ?? raw.Urgency ?? 'Routine'),
    isReturnVisit: Boolean(raw.isReturnVisit ?? raw.IsReturnVisit),
    passNumber: Number(raw.passNumber ?? raw.PassNumber ?? 1),
    reasonLabel: raw.reasonLabel != null ? String(raw.reasonLabel) : raw.ReasonLabel != null ? String(raw.ReasonLabel) : undefined,
  };
}

function mapSlide(raw: Record<string, unknown>): QueueDisplayRoomSlide {
  const nextRaw = (raw.nextQueue ?? raw.NextQueue ?? []) as Record<string, unknown>[];
  const nowRaw = raw.nowServing ?? raw.NowServing;

  return {
    station: String(raw.station ?? raw.Station ?? ''),
    stationLabel: String(raw.stationLabel ?? raw.StationLabel ?? ''),
    stationLabelTe: raw.stationLabelTe != null ? String(raw.stationLabelTe) : raw.StationLabelTe != null ? String(raw.StationLabelTe) : undefined,
    roomCode: String(raw.roomCode ?? raw.RoomCode ?? ''),
    displayLabel: String(raw.displayLabel ?? raw.DisplayLabel ?? ''),
    displayLabelTe: raw.displayLabelTe != null ? String(raw.displayLabelTe) : raw.DisplayLabelTe != null ? String(raw.DisplayLabelTe) : undefined,
    nowServing: nowRaw ? mapPatient(nowRaw as Record<string, unknown>) : null,
    nextQueue: Array.isArray(nextRaw) ? nextRaw.map(mapPatient) : [],
    staffName: raw.staffName != null ? String(raw.staffName) : raw.StaffName != null ? String(raw.StaffName) : undefined,
  };
}

export function mapBranchDisplayPayload(data: Record<string, unknown>): QueueDisplayBranchPayload {
  const slidesRaw = (data.slides ?? data.Slides ?? []) as Record<string, unknown>[];
  const tickerRaw = (data.tickerMessages ?? data.TickerMessages ?? []) as Record<string, unknown>[];

  return {
    branchId: String(data.branchId ?? data.BranchId ?? ''),
    branchName: String(data.branchName ?? data.BranchName ?? 'Hospital'),
    mode: String(data.mode ?? data.Mode ?? 'branch'),
    rotationSeconds: Number(data.rotationSeconds ?? data.RotationSeconds ?? 10),
    generatedAt: String(data.generatedAt ?? data.GeneratedAt ?? new Date().toISOString()),
    tickerMessages: Array.isArray(tickerRaw)
      ? tickerRaw.map((t) => ({
          en: String(t.en ?? t.En ?? ''),
          te: String(t.te ?? t.Te ?? ''),
        }))
      : [],
    slides: Array.isArray(slidesRaw) ? slidesRaw.map(mapSlide) : [],
  };
}

export interface QueueDisplayParams {
  branchId: string;
  mode?: 'branch' | 'station' | 'room';
  station?: string;
  roomCode?: string;
  interval?: number;
}

export const queueDisplayApi = {
  getBranchDisplay: async (params: QueueDisplayParams): Promise<QueueDisplayBranchPayload> => {
    const response = await getApi().get('/queue/display/branch', {
      params: {
        branchId: params.branchId,
        mode: params.mode ?? 'branch',
        station: params.station,
        roomCode: params.roomCode,
        interval: params.interval ?? 10,
      },
    });
    return mapBranchDisplayPayload(response.data ?? {});
  },
};

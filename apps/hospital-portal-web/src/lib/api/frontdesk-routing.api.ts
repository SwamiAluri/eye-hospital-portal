import { getApi } from '../api';

import { normalizeStationId } from '../frontdesk/station-ids';



export interface SendToRequest {

  visitId?: string;

  station: string;

  assignToUserId?: string;

  reason?: string;

  reasonCode?: string;

}



function withNormalizedStation<T extends { station: string }>(req: T): T {

  return { ...req, station: normalizeStationId(req.station) };

}



export const frontdeskRoutingApi = {

  sendToVisit: async (req: SendToRequest) =>

    getApi().post('/visits/send-to', withNormalizedStation(req)),

  sendToAppointment: async (appointmentId: string, req: Omit<SendToRequest, 'visitId'>) =>

    getApi().post(`/visits/send-to-appointment/${appointmentId}`, withNormalizedStation(req)),

};



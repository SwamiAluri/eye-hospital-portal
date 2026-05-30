import { getCcmsApi } from './ccms-base';



export interface CcmsCommunicationLog {

  id: string;

  coverageCase_Id?: string;

  coverageCaseId?: string;

  communicationType: string;

  direction: string;

  recipientType: string;

  recipientAddress?: string;

  subject?: string;

  bodySummary?: string;

  sentAt: string;

  deliveryStatus?: string;

  externalMessageId?: string;

  metadataJson?: string | Record<string, unknown>;

  createdAt?: string;

}



export interface CommunicationTemplate {

  id: string;

  templateCode: string;

  templateName?: string;

  communicationType: string;

  subjectTemplate?: string;

  bodyTemplate: string;

}



export interface SendCommunicationPayload {

  channel: 'email' | 'sms' | 'whatsapp' | 'portal' | 'phone' | 'in_person';

  recipientType: 'tpa' | 'insurance' | 'patient' | 'internal';

  recipientRef?: string;

  subject?: string;

  body?: string;

  templateCode?: string;

  direction?: 'inbound' | 'outbound';

}



export interface SendCommunicationResult {

  log?: CcmsCommunicationLog;

  success: boolean;

  messageId?: string;

  error?: string;

}



export async function listCommunications(caseId: string): Promise<CcmsCommunicationLog[]> {

  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/communications`);

  return Array.isArray(data) ? data : [];

}



/**

 * Send + log outbound comm. Returns success:false when notification dispatch fails

 * but the comm log was still created (HTTP 200 from CCMS).

 */

export async function sendCommunication(

  caseId: string,

  payload: SendCommunicationPayload,

): Promise<SendCommunicationResult> {

  try {

    const { data } = await getCcmsApi().post(

      `/ccms/coverage-cases/${caseId}/communications/send`,

      payload,

    );

    return {

      log: data?.log,

      success: data?.success ?? true,

      messageId: data?.messageId,

      error: data?.error,

    };

  } catch (err: unknown) {

    const resp = err && typeof err === 'object' && 'response' in err

      ? (err as { response?: { status?: number; data?: SendCommunicationResult } }).response

      : undefined;



    // Legacy CCMS builds returned 502 — still parse body if present

    if (resp?.data && typeof resp.data === 'object') {

      return {

        log: resp.data.log,

        success: resp.data.success ?? false,

        messageId: resp.data.messageId,

        error: resp.data.error ?? `Notification dispatch failed (${resp.status})`,

      };

    }



    const status = resp?.status;

    if (status === 404) {

      return {

        success: false,

        error: 'Communications send endpoint not found — restart CCMS service (port 7075).',

      };

    }



    throw err;

  }

}



export async function getCommunicationTemplates(channel?: string): Promise<CommunicationTemplate[]> {

  const { data } = await getCcmsApi().get('/ccms/communication-templates', {

    params: channel ? { channel } : undefined,

  });

  return Array.isArray(data) ? data : [];

}


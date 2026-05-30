import type { TpaInboundParseDraft, TpaSuggestedDecision } from './tpa-email-parse';

export interface TpaResponsePrefill {
  decision?: TpaSuggestedDecision;
  approvedAmount?: number;
  preAuthNumber?: string;
  tpaRef?: string;
  rejectReason?: string;
  clarNotes?: string;
  source?: 'manual' | 'email_parse';
  communicationLogId?: string;
}

export function prefillFromParseDraft(
  draft: TpaInboundParseDraft,
  communicationLogId?: string,
): TpaResponsePrefill {
  const decision = draft.suggestedDecision?.toUpperCase() as TpaSuggestedDecision | undefined;
  const base: TpaResponsePrefill = {
    source: 'email_parse',
    communicationLogId,
  };

  if (decision === 'APPROVED' || decision === 'PARTIAL') {
    return {
      ...base,
      decision,
      approvedAmount: draft.approvedAmount ?? undefined,
      preAuthNumber: draft.preAuthNumber ?? undefined,
    };
  }
  if (decision === 'REJECTED') {
    return {
      ...base,
      decision,
      rejectReason: draft.excerpt ?? undefined,
    };
  }
  if (decision === 'CLARIFICATION') {
    return {
      ...base,
      decision,
      clarNotes: draft.excerpt ?? undefined,
    };
  }
  return base;
}

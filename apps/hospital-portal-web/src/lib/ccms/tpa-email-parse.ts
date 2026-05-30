/** Parsed inbound TPA email draft (matches CCMS metadata_json.parseDraft). */

export type TpaSuggestedDecision = 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CLARIFICATION';

export interface TpaInboundParseDraft {
  suggestedDecision?: TpaSuggestedDecision | string | null;
  confidence?: number;
  approvedAmount?: number | null;
  preAuthNumber?: string | null;
  caseNumber?: string | null;
  excerpt?: string | null;
  fromAddress?: string | null;
}

export interface CommMetadata {
  parseDraft?: TpaInboundParseDraft;
  reviewStatus?: 'draft_ready' | 'needs_review' | 'applied';
}

export function parseCommMetadata(raw: unknown): CommMetadata | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CommMetadata;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as CommMetadata;
  return null;
}

export function hasParseDraftReady(meta: CommMetadata | null): boolean {
  return meta?.reviewStatus === 'draft_ready'
    && Boolean(meta.parseDraft?.suggestedDecision);
}

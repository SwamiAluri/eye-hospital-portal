/**
 * CCMS Communications — Smart Template Engine
 *
 * Provides context assembly and context-aware draft generation for all
 * 30 CcmsState values across every channel and recipient combination.
 *
 * Usage:
 *   const ctx = buildCommsContext(case_, draft, comms, recipientType);
 *   const { subject, body } = generateSmartDraft(state, channel, recipientType, ctx);
 */

import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { CcmsCommunicationLog } from '@/lib/api/ccms/ccms-communications.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import { getStateLabel } from '@/lib/api/ccms/ccms-state-labels';

// ── Context ───────────────────────────────────────────────────────────────────

export interface CommsContext {
  caseNumber: string;
  patientName: string;
  insurerName: string;
  policyNumber: string;
  membershipNumber: string;
  tpaContactPerson: string;
  preAuthNumber: string;
  approvedAmount: string;
  surgeryDate: string;
  diagnosisCode: string;
  procedureCode: string;
  urgencyLevel: string;
  sumInsured: string;
  hospitalName: string;
  stateLabel: string;
  /** Last inbound message from TPA / insurer for this case (for reply threading) */
  lastInboundComm?: { subject?: string; bodySummary?: string; sentAt: string };
  /** True when no prior outbound message has been sent to this recipient type */
  isFirstContactToRecipient: boolean;
  /** Days since last outbound comm to any recipient (null = never) */
  daysSinceLastOutbound: number | null;
}

// ── Context builder ───────────────────────────────────────────────────────────

export function buildCommsContext(
  case_: CoverageCase,
  draft: CounsellorDraftSnapshot | null | undefined,
  comms: CcmsCommunicationLog[],
  recipientType: string,
): CommsContext {
  const sorted = [...comms].sort(
    (a, b) => new Date(b.sentAt ?? b.createdAt ?? 0).getTime() - new Date(a.sentAt ?? a.createdAt ?? 0).getTime(),
  );

  const lastInboundComm = sorted.find(
    c => c.direction === 'inbound' && (c.recipientType === 'tpa' || c.recipientType === 'insurance'),
  );

  const outboundToRecipient = sorted.filter(
    c => c.direction === 'outbound' && c.recipientType === recipientType,
  );

  const lastOutbound = sorted.find(c => c.direction === 'outbound');
  let daysSinceLastOutbound: number | null = null;
  if (lastOutbound?.sentAt) {
    const ms = Date.now() - new Date(lastOutbound.sentAt).getTime();
    daysSinceLastOutbound = Math.floor(ms / 86_400_000);
  }

  const fmtMoney = (v?: number | string | null) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isNaN(n) ? '' : `₹${n.toLocaleString('en-IN')}`;
  };

  const fmtDate = (v?: string | null) => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return v; }
  };

  return {
    caseNumber:       case_.caseNumber ?? '',
    patientName:      case_.patientName?.trim() || draft?.insuredName?.trim() || 'Patient',
    insurerName:      case_.insurerName?.trim() || draft?.insurerName?.trim() || 'Insurer',
    policyNumber:     draft?.policyNumber ?? '',
    membershipNumber: draft?.membershipNumber ?? '',
    tpaContactPerson: draft?.tpaContactPerson ?? '',
    preAuthNumber:    case_.preAuthNumber ?? '',
    approvedAmount:   fmtMoney(case_.approvedAmount),
    surgeryDate:      fmtDate(draft?.surgeryDate),
    diagnosisCode:    draft?.diagnosisCode ?? '',
    procedureCode:    draft?.procedureCode ?? '',
    urgencyLevel:     draft?.urgencyLevel ?? '',
    sumInsured:       fmtMoney(draft?.sumInsured),
    hospitalName:     'Apollo Hospital',   // TODO: wire from branch/tenant config
    stateLabel:       getStateLabel(case_.currentState),
    lastInboundComm:  lastInboundComm
      ? { subject: lastInboundComm.subject, bodySummary: lastInboundComm.bodySummary, sentAt: lastInboundComm.sentAt ?? lastInboundComm.createdAt ?? '' }
      : undefined,
    isFirstContactToRecipient: outboundToRecipient.length === 0,
    daysSinceLastOutbound,
  };
}

// ── Short helpers ─────────────────────────────────────────────────────────────

function greeting(ctx: CommsContext) {
  return ctx.tpaContactPerson ? `Dear ${ctx.tpaContactPerson},` : 'Dear Sir / Madam,';
}

function caseRef(ctx: CommsContext) {
  const parts = [`Case No.: ${ctx.caseNumber}`];
  if (ctx.patientName) parts.push(`Patient: ${ctx.patientName}`);
  if (ctx.policyNumber) parts.push(`Policy No.: ${ctx.policyNumber}`);
  if (ctx.membershipNumber) parts.push(`Membership No.: ${ctx.membershipNumber}`);
  return parts.join(' | ');
}

function replyPrefix(ctx: CommsContext): string {
  if (!ctx.lastInboundComm) return '';
  const dt = ctx.lastInboundComm.sentAt
    ? new Date(ctx.lastInboundComm.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const ref = ctx.lastInboundComm.subject ? `"${ctx.lastInboundComm.subject}"` : 'your message';
  return `Thank you for your response dated ${dt} regarding ${ref}.\n\n`;
}

function signature() {
  return `\n\nWarm regards,\n[Counsellor Name]\n[Hospital Name] — CCMS Team\n[Phone] | [Email]`;
}

function smsLine(msg: string, ctx: CommsContext): string {
  return msg.replace(/{{patientName}}/g, ctx.patientName)
            .replace(/{{caseNumber}}/g, ctx.caseNumber)
            .replace(/{{insurerName}}/g, ctx.insurerName)
            .replace(/{{preAuthNumber}}/g, ctx.preAuthNumber || 'N/A')
            .replace(/{{approvedAmount}}/g, ctx.approvedAmount || 'N/A')
            .replace(/{{hospitalName}}/g, ctx.hospitalName);
}

// ── Draft generator ───────────────────────────────────────────────────────────

type Channel = 'email' | 'sms' | 'whatsapp' | 'phone' | 'in_person';

export function generateSmartDraft(
  state: string,
  channel: Channel,
  recipientType: string,
  ctx: CommsContext,
): { subject: string; body: string } {
  if (channel === 'phone' || channel === 'in_person') {
    return buildInteractionLog(state, channel, recipientType, ctx);
  }
  if (channel === 'sms' || channel === 'whatsapp') {
    return buildShortMessage(state, recipientType, ctx);
  }
  return buildEmailDraft(state, recipientType, ctx);
}

// ── Phone / In-person interaction log ────────────────────────────────────────

function buildInteractionLog(
  state: string,
  channel: Channel,
  recipientType: string,
  ctx: CommsContext,
): { subject: string; body: string } {
  const medium = channel === 'phone' ? 'phone call' : 'in-person meeting';
  const with_ = recipientType === 'patient' ? ctx.patientName : `TPA / Insurer (${ctx.insurerName})`;
  return {
    subject: '',
    body: `Interaction log — ${medium} with ${with_}\n`
      + `Date/Time: [fill date & time]\n`
      + `Case: ${ctx.caseNumber} | State: ${ctx.stateLabel}\n\n`
      + `Discussion points:\n`
      + `- \n`
      + `- \n\n`
      + `Action items / next steps:\n`
      + `- \n\n`
      + `Logged by: [Your name]`,
  };
}

// ── SMS / WhatsApp short messages ─────────────────────────────────────────────

function buildShortMessage(
  state: string,
  recipientType: string,
  ctx: CommsContext,
): { subject: string; body: string } {
  const templates: Record<string, string> = {
    ELIGIBILITY_PENDING:    `Hi {{patientName}}, your insurance eligibility check is in progress for case {{caseNumber}}. We'll keep you updated. – {{hospitalName}}`,
    ELIGIBILITY_VERIFIED:   `Hi {{patientName}}, your insurance eligibility has been verified. Next step: pre-auth. – {{hospitalName}}`,
    POLICY_CAPTURED:        `Hi {{patientName}}, your policy details have been recorded for case {{caseNumber}}. – {{hospitalName}}`,
    AUTHORIZATION_REQUIRED: `Hi {{patientName}}, your case {{caseNumber}} requires insurance authorization. We're processing it. – {{hospitalName}}`,
    PREAUTH_GENERATED:      `Hi {{patientName}}, pre-authorization for your case {{caseNumber}} has been prepared and will be sent to {{insurerName}}. – {{hospitalName}}`,
    PREAUTH_SENT:           `Hi {{patientName}}, pre-auth request for case {{caseNumber}} has been sent to {{insurerName}}. We'll notify you upon approval. – {{hospitalName}}`,
    WAITING_APPROVAL:       `Hi {{patientName}}, your pre-auth (case {{caseNumber}}) is under review by {{insurerName}}. We'll update you shortly. – {{hospitalName}}`,
    CLARIFICATION_REQUIRED: `Hi {{patientName}}, {{insurerName}} has requested additional info for case {{caseNumber}}. Our team is working on it. – {{hospitalName}}`,
    RESUBMITTED:            `Hi {{patientName}}, your pre-auth for case {{caseNumber}} has been resubmitted to {{insurerName}}. – {{hospitalName}}`,
    APPROVED:               `Congratulations {{patientName}}! Your insurance pre-auth for case {{caseNumber}} has been APPROVED for {{approvedAmount}} by {{insurerName}}. Please contact us to proceed. – {{hospitalName}}`,
    PARTIAL_APPROVAL:       `Hi {{patientName}}, {{insurerName}} has approved your pre-auth partially ({{approvedAmount}}) for case {{caseNumber}}. Please call us to discuss. – {{hospitalName}}`,
    ADMISSION_READY:        `Hi {{patientName}}, admission for case {{caseNumber}} is ready. Please report to {{hospitalName}} as per your scheduled date. – {{hospitalName}}`,
    ADMITTED:               `Dear {{patientName}}, you have been admitted at {{hospitalName}} under case {{caseNumber}}. Welcome! – {{hospitalName}}`,
    SURGERY_SCHEDULED:      `Hi {{patientName}}, your surgery has been scheduled for case {{caseNumber}}. Our team will guide you through the preparation. – {{hospitalName}}`,
    SURGERY_COMPLETED:      `Dear {{patientName}}, surgery is complete. Our team will now process your insurance claim (case {{caseNumber}}). – {{hospitalName}}`,
    BILL_PENDING:           `Hi {{patientName}}, billing for case {{caseNumber}} is being prepared. We'll share the details shortly. – {{hospitalName}}`,
    BILL_FINALIZED:         `Hi {{patientName}}, your bill for case {{caseNumber}} has been finalized. Your claim will be submitted to {{insurerName}}. – {{hospitalName}}`,
    CLAIM_READY:            `Hi {{patientName}}, your insurance claim for case {{caseNumber}} is ready for submission. – {{hospitalName}}`,
    CLAIM_SUBMITTED:        `Hi {{patientName}}, your claim for case {{caseNumber}} has been submitted to {{insurerName}}. We'll update you on progress. – {{hospitalName}}`,
    CLAIM_IN_PROCESS:       `Hi {{patientName}}, your claim (case {{caseNumber}}) is being processed by {{insurerName}}. – {{hospitalName}}`,
    SETTLEMENT_PENDING:     `Hi {{patientName}}, settlement for case {{caseNumber}} is pending. We'll notify you once received. – {{hospitalName}}`,
    PARTIAL_SETTLEMENT:     `Hi {{patientName}}, a partial settlement of {{approvedAmount}} has been received for case {{caseNumber}}. – {{hospitalName}}`,
    FULL_SETTLEMENT:        `Hi {{patientName}}, your full insurance settlement for case {{caseNumber}} has been received. – {{hospitalName}}`,
    RECONCILED:             `Hi {{patientName}}, case {{caseNumber}} has been fully reconciled and settled. Thank you. – {{hospitalName}}`,
    CLOSED:                 `Hi {{patientName}}, case {{caseNumber}} has been closed. Thank you for choosing {{hospitalName}}.`,
    REJECTED:               `Hi {{patientName}}, unfortunately {{insurerName}} has rejected pre-auth for case {{caseNumber}}. Please call us to discuss options. – {{hospitalName}}`,
    EXPIRED:                `Hi {{patientName}}, your pre-auth for case {{caseNumber}} has expired. Please contact us to resubmit. – {{hospitalName}}`,
    CANCELLED:              `Hi {{patientName}}, case {{caseNumber}} has been cancelled. Please contact us if this is unexpected. – {{hospitalName}}`,
  };

  const tpl = templates[state] ?? `Hi {{patientName}}, an update is available for your case {{caseNumber}}. Please contact us at {{hospitalName}}.`;
  return { subject: '', body: smsLine(tpl, ctx) };
}

// ── Email drafts ──────────────────────────────────────────────────────────────

function buildEmailDraft(
  state: string,
  recipientType: string,
  ctx: CommsContext,
): { subject: string; body: string } {
  const isReply = !!ctx.lastInboundComm;
  const ref = caseRef(ctx);

  switch (state) {
    case 'ELIGIBILITY_PENDING':
      return eligibilityPending(ctx, recipientType, isReply, ref);
    case 'ELIGIBILITY_VERIFIED':
      return eligibilityVerified(ctx, recipientType, ref);
    case 'POLICY_CAPTURED':
      return policyConfirmed(ctx, ref);
    case 'AUTHORIZATION_REQUIRED':
    case 'PREAUTH_GENERATED':
      return authorizationRequired(ctx, ref);
    case 'PREAUTH_SENT':
      return preauthSent(ctx, recipientType, isReply, ref);
    case 'WAITING_APPROVAL':
      return waitingApproval(ctx, ref);
    case 'CLARIFICATION_REQUIRED':
      return clarificationRequired(ctx, isReply, ref);
    case 'RESUBMITTED':
      return resubmitted(ctx, ref);
    case 'APPROVED':
      return approved(ctx, recipientType, ref);
    case 'PARTIAL_APPROVAL':
      return partialApproval(ctx, ref);
    case 'ADMISSION_READY':
      return admissionReady(ctx, ref);
    case 'ADMITTED':
    case 'SURGERY_SCHEDULED':
    case 'SURGERY_COMPLETED':
      return surgeryUpdate(ctx, state, ref);
    case 'BILL_PENDING':
    case 'BILL_FINALIZED':
      return billingUpdate(ctx, state, ref);
    case 'CLAIM_READY':
    case 'CLAIM_SUBMITTED':
      return claimSubmission(ctx, state, isReply, ref);
    case 'CLAIM_IN_PROCESS':
      return claimInProcess(ctx, isReply, ref);
    case 'SETTLEMENT_PENDING':
    case 'PARTIAL_SETTLEMENT':
    case 'FULL_SETTLEMENT':
    case 'RECONCILED':
      return settlementUpdate(ctx, state, ref);
    case 'REJECTED':
      return rejected(ctx, isReply, ref);
    case 'EXPIRED':
      return expired(ctx, ref);
    case 'CLOSED':
      return closed(ctx, ref);
    default:
      return genericUpdate(ctx, ref);
  }
}

// ── Individual email template builders ───────────────────────────────────────

function eligibilityPending(ctx: CommsContext, recipientType: string, isReply: boolean, ref: string) {
  const subject = isReply
    ? `Re: Eligibility Verification — ${ctx.caseNumber}`
    : `Eligibility Verification Request — ${ctx.caseNumber}`;
  const intro = isReply ? replyPrefix(ctx) : ctx.isFirstContactToRecipient
    ? `We are reaching out for the first time regarding the insurance eligibility verification for the above-referenced patient.\n\n`
    : `We are following up on the pending eligibility verification for the above-referenced patient.\n\n`;

  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + intro
    + `We kindly request you to verify the insurance eligibility and coverage details for:\n`
    + `  Patient Name : ${ctx.patientName}\n`
    + (ctx.policyNumber    ? `  Policy No.   : ${ctx.policyNumber}\n`    : '')
    + (ctx.membershipNumber ? `  Membership No.: ${ctx.membershipNumber}\n` : '')
    + (ctx.diagnosisCode   ? `  Diagnosis     : ${ctx.diagnosisCode}\n`  : '')
    + (ctx.procedureCode   ? `  Procedure     : ${ctx.procedureCode}\n`  : '')
    + `\nPlease confirm the following:\n`
    + `  1. Is the policy active and valid?\n`
    + `  2. Is the proposed procedure covered under the policy?\n`
    + `  3. What is the sum insured and remaining balance?\n`
    + `  4. Are there any waiting period restrictions?\n`
    + `\nWe request a response at the earliest to avoid any delay in patient care.`
    + signature();

  return { subject, body };
}

function eligibilityVerified(ctx: CommsContext, recipientType: string, ref: string) {
  const subject = recipientType === 'patient'
    ? `Insurance Eligibility Confirmed — Case ${ctx.caseNumber}`
    : `Eligibility Verified — ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `We are pleased to inform you that the insurance eligibility for ${ctx.patientName} has been successfully verified.\n\n`
    + (ctx.sumInsured ? `  Sum Insured: ${ctx.sumInsured}\n\n` : '')
    + `We will proceed with pre-authorization for the proposed procedure.`
    + signature();
  return { subject, body };
}

function policyConfirmed(ctx: CommsContext, ref: string) {
  const subject = `Policy Details Recorded — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `This is to confirm that the policy details for ${ctx.patientName} have been captured in our system.\n\n`
    + `We will now proceed with the pre-authorization process.`
    + signature();
  return { subject, body };
}

function authorizationRequired(ctx: CommsContext, ref: string) {
  const subject = `Pre-Authorization Initiation — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `We are initiating the pre-authorization process for the below patient and request your guidance on any documents required:\n\n`
    + `  Patient Name : ${ctx.patientName}\n`
    + (ctx.policyNumber   ? `  Policy No.   : ${ctx.policyNumber}\n`   : '')
    + (ctx.diagnosisCode  ? `  Diagnosis    : ${ctx.diagnosisCode}\n`  : '')
    + (ctx.procedureCode  ? `  Procedure    : ${ctx.procedureCode}\n`  : '')
    + (ctx.surgeryDate    ? `  Surgery Date : ${ctx.surgeryDate}\n`    : '')
    + (ctx.urgencyLevel   ? `  Urgency      : ${ctx.urgencyLevel}\n`   : '')
    + `\nKindly let us know the expected turnaround time.`
    + signature();
  return { subject, body };
}

function preauthSent(ctx: CommsContext, recipientType: string, isReply: boolean, ref: string) {
  const subject = isReply
    ? `Re: Pre-Authorization Follow-Up — ${ctx.caseNumber}`
    : `Pre-Authorization Follow-Up — ${ctx.caseNumber}`;
  const intro = isReply
    ? replyPrefix(ctx)
    : `We submitted the pre-authorization request for the above case `
      + (ctx.isFirstContactToRecipient ? 'recently' : 'some time ago')
      + `. We are writing to follow up on the status.\n\n`;

  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + intro
    + `Could you please provide an update on:\n`
    + `  1. Current status of the pre-authorization request\n`
    + `  2. Expected approval timeline\n`
    + `  3. Any additional information required from our end\n\n`
    + `Patient details for your reference:\n`
    + `  Patient Name : ${ctx.patientName}\n`
    + (ctx.policyNumber  ? `  Policy No.   : ${ctx.policyNumber}\n`  : '')
    + (ctx.diagnosisCode ? `  Diagnosis    : ${ctx.diagnosisCode}\n` : '')
    + (ctx.procedureCode ? `  Procedure    : ${ctx.procedureCode}\n` : '')
    + (ctx.surgeryDate   ? `  Surgery Date : ${ctx.surgeryDate}\n`   : '')
    + `\nYour prompt response will help us provide timely care to the patient.`
    + signature();
  return { subject, body };
}

function waitingApproval(ctx: CommsContext, ref: string) {
  const days = ctx.daysSinceLastOutbound != null ? ` ${ctx.daysSinceLastOutbound} days` : '';
  const subject = `Approval Status Enquiry — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `We submitted the pre-authorization request${days} ago and are yet to receive a decision. We kindly request you to expedite the approval process.\n\n`
    + `Patient: ${ctx.patientName}`
    + (ctx.surgeryDate ? ` | Planned Surgery: ${ctx.surgeryDate}` : '')
    + `\n\n`
    + `If you require any additional clinical or administrative documentation, please let us know immediately.`
    + signature();
  return { subject, body };
}

function clarificationRequired(ctx: CommsContext, isReply: boolean, ref: string) {
  const subject = isReply
    ? `Re: Clarification for Pre-Authorization — ${ctx.caseNumber}`
    : `Clarification / Additional Documents — Pre-Authorization ${ctx.caseNumber}`;
  const intro = isReply
    ? replyPrefix(ctx)
    : `We have noted your request for clarification / additional documents for the above pre-authorization.\n\n`;

  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + intro
    + `Please find the requested details / documents attached to this email:\n`
    + `  - [Document 1]\n`
    + `  - [Document 2]\n\n`
    + `If further information is required, please do not hesitate to contact us. We are committed to resolving this at the earliest to ensure the patient receives timely treatment.`
    + signature();
  return { subject, body };
}

function resubmitted(ctx: CommsContext, ref: string) {
  const subject = `Pre-Authorization Resubmission — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `This is to inform you that we have resubmitted the pre-authorization request for ${ctx.patientName} after addressing the earlier clarification / query.\n\n`
    + `Please review and revert with the approval at your earliest.`
    + signature();
  return { subject, body };
}

function approved(ctx: CommsContext, recipientType: string, ref: string) {
  if (recipientType === 'patient') {
    const subject = `Pre-Authorization Approved — Case ${ctx.caseNumber}`;
    const body = `Dear ${ctx.patientName},\n\n`
      + `${ref}\n\n`
      + `We are pleased to inform you that your insurance pre-authorization has been APPROVED by ${ctx.insurerName}.\n\n`
      + (ctx.approvedAmount ? `  Approved Amount : ${ctx.approvedAmount}\n` : '')
      + (ctx.preAuthNumber  ? `  Pre-Auth No.    : ${ctx.preAuthNumber}\n`  : '')
      + `\nPlease contact our counsellor to proceed with admission formalities.`
      + signature();
    return { subject, body };
  }
  const subject = `Pre-Authorization Acknowledgement — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `Thank you for approving the pre-authorization for ${ctx.patientName}.\n\n`
    + (ctx.approvedAmount ? `  Approved Amount : ${ctx.approvedAmount}\n` : '')
    + (ctx.preAuthNumber  ? `  Pre-Auth No.    : ${ctx.preAuthNumber}\n`  : '')
    + `\nWe will proceed with admission as per the approved terms.`
    + signature();
  return { subject, body };
}

function partialApproval(ctx: CommsContext, ref: string) {
  const subject = `Partial Pre-Authorization — Case ${ctx.caseNumber} — Clarification Required`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `We have received the partial approval for the above case.\n\n`
    + (ctx.approvedAmount ? `  Approved Amount : ${ctx.approvedAmount}\n\n` : '\n')
    + `We would like to understand the reason for partial approval and request you to reconsider the remaining amount, as the full procedure as documented is medically necessary.\n\n`
    + `Please advise on next steps.`
    + signature();
  return { subject, body };
}

function admissionReady(ctx: CommsContext, ref: string) {
  const subject = `Admission Confirmation — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `The patient ${ctx.patientName} is scheduled for admission. This is to confirm that all pre-authorization formalities are complete and we are ready to proceed.\n\n`
    + (ctx.preAuthNumber ? `Pre-Auth Reference: ${ctx.preAuthNumber}\n\n` : '')
    + `Please ensure the admission desk has the authorization details for a smooth check-in.`
    + signature();
  return { subject, body };
}

function surgeryUpdate(ctx: CommsContext, state: string, ref: string) {
  const stateMap: Record<string, string> = {
    ADMITTED:          'Patient Admitted',
    SURGERY_SCHEDULED: 'Surgery Scheduled',
    SURGERY_COMPLETED: 'Surgery Completed',
  };
  const subject = `${stateMap[state] ?? 'Case Update'} — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `This is to update you that the status of the above case has progressed to: ${getStateLabel(state)}.\n\n`
    + (state === 'SURGERY_COMPLETED'
      ? `Surgery has been completed successfully. We will initiate the billing and claims process shortly.\n\n`
      : state === 'SURGERY_SCHEDULED'
      ? (ctx.surgeryDate ? `Surgery is scheduled for ${ctx.surgeryDate}.\n\n` : `Surgery has been scheduled.\n\n`)
      : `The patient has been admitted.\n\n`)
    + `Please maintain the authorization reference for claim settlement.`
    + signature();
  return { subject, body };
}

function billingUpdate(ctx: CommsContext, state: string, ref: string) {
  const subject = state === 'BILL_FINALIZED'
    ? `Bill Finalized — Claim Submission Imminent — Case ${ctx.caseNumber}`
    : `Billing in Progress — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + (state === 'BILL_FINALIZED'
      ? `The final bill for ${ctx.patientName} has been prepared. We will be submitting the insurance claim shortly.\n\nKindly ensure the prior authorization is valid for processing.`
      : `The billing process for ${ctx.patientName} is currently underway. We will submit the claim once the bill is finalized.`)
    + signature();
  return { subject, body };
}

function claimSubmission(ctx: CommsContext, state: string, isReply: boolean, ref: string) {
  const subject = state === 'CLAIM_SUBMITTED'
    ? (isReply ? `Re: Claim Submission — Case ${ctx.caseNumber}` : `Claim Submission — Case ${ctx.caseNumber}`)
    : `Claim Packet Ready — Case ${ctx.caseNumber}`;
  const intro = isReply ? replyPrefix(ctx) : '';

  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + intro
    + (state === 'CLAIM_SUBMITTED'
      ? `Please find attached the insurance claim documents for the above patient. We request you to acknowledge receipt and initiate processing.\n\n`
        + `Documents submitted:\n`
        + `  - Discharge summary\n`
        + `  - Final bill\n`
        + `  - Pre-authorization letter\n`
        + `  - Investigation reports\n`
        + `  - [Additional documents as applicable]\n\n`
        + `Kindly confirm receipt and provide a claim reference number.`
      : `The claim packet for ${ctx.patientName} is ready for submission. We will dispatch the documents shortly.`)
    + signature();
  return { subject, body };
}

function claimInProcess(ctx: CommsContext, isReply: boolean, ref: string) {
  const subject = isReply
    ? `Re: Claim Processing Status — Case ${ctx.caseNumber}`
    : `Claim Processing Status Enquiry — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + (isReply ? replyPrefix(ctx) : '')
    + `We are writing to enquire about the current status of the insurance claim for ${ctx.patientName}.\n\n`
    + `Could you please provide:\n`
    + `  1. Current status of the claim\n`
    + `  2. Expected settlement date\n`
    + `  3. Any additional documents / queries from your end\n\n`
    + `Your prompt response is appreciated.`
    + signature();
  return { subject, body };
}

function settlementUpdate(ctx: CommsContext, state: string, ref: string) {
  const stateLabels: Record<string, string> = {
    SETTLEMENT_PENDING: 'Settlement Pending',
    PARTIAL_SETTLEMENT: 'Partial Settlement Received',
    FULL_SETTLEMENT:    'Full Settlement Received',
    RECONCILED:         'Settlement Reconciled',
  };
  const subject = `${stateLabels[state] ?? 'Settlement Update'} — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + (state === 'SETTLEMENT_PENDING'
      ? `We wish to follow up on the pending settlement for the above case. Kindly advise on the expected payment date.\n\n`
        + `Please ensure the payment is remitted to the hospital account at the earliest.`
      : state === 'PARTIAL_SETTLEMENT'
      ? `We acknowledge receipt of the partial settlement of ${ctx.approvedAmount || '[amount]'} for the above case.\n\n`
        + `We request you to process the remaining settlement at the earliest. Please advise on the timeline.`
      : state === 'FULL_SETTLEMENT'
      ? `We are pleased to acknowledge receipt of the full settlement for case ${ctx.caseNumber}. Thank you.\n\n`
        + `We will proceed with final reconciliation.`
      : `The case ${ctx.caseNumber} has been fully reconciled. All documentation is in order.`)
    + signature();
  return { subject, body };
}

function rejected(ctx: CommsContext, isReply: boolean, ref: string) {
  const subject = isReply
    ? `Re: Pre-Authorization Rejection — Appeal — Case ${ctx.caseNumber}`
    : `Pre-Authorization Rejection — Request for Reconsideration — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + (isReply ? replyPrefix(ctx) : '')
    + `We have received the rejection of the pre-authorization for ${ctx.patientName} and wish to appeal this decision.\n\n`
    + `The proposed procedure is medically necessary as evidenced by the attached clinical documents. We request you to:\n`
    + `  1. Review the clinical documentation provided\n`
    + `  2. Reconsider the rejection / escalate to the medical review committee\n`
    + `  3. Provide a written explanation of the grounds for rejection\n\n`
    + `We believe this case meets all the criteria for coverage under the policy terms. Please advise on the appeal process.`
    + signature();
  return { subject, body };
}

function expired(ctx: CommsContext, ref: string) {
  const subject = `Pre-Authorization Expired — Resubmission Request — Case ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `The pre-authorization for ${ctx.patientName} has expired. We request you to guide us on the resubmission process so that we can continue with the patient's treatment without further delay.`
    + signature();
  return { subject, body };
}

function closed(ctx: CommsContext, ref: string) {
  const subject = `Case Closed — ${ctx.caseNumber}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `This is to inform you that case ${ctx.caseNumber} for ${ctx.patientName} has been closed. All formalities are complete.\n\n`
    + `Thank you for your cooperation throughout this process.`
    + signature();
  return { subject, body };
}

function genericUpdate(ctx: CommsContext, ref: string) {
  const subject = `Case Update — ${ctx.caseNumber} — ${ctx.stateLabel}`;
  const body = `${greeting(ctx)}\n\n`
    + `${ref}\n\n`
    + `We are writing to provide an update on the above case. The current status is: ${ctx.stateLabel}.\n\n`
    + `Please advise on any action required from your end.`
    + signature();
  return { subject, body };
}

import type { MasterOption } from '@/hooks/use-master-values';

/** Map master counsellor.comm_channel code → API / DB channel string */
const COMM_CHANNEL_TO_API: Record<string, string> = {
  PHONE: 'Phone',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  IN_PERSON: 'InPerson',
};

/**
 * counselor_callback_requests.callback_type CHECK allowlist (migration 70).
 * Master counsellor.callback_type codes (SCHEDULED/REMINDER/…) are NOT valid DB values.
 */
const CALLBACK_TYPE_DB_ALLOWLIST = new Set([
  'PreSurgery',
  'PostSurgery',
  'General',
  'Financial',
  'FearAnxiety',
  'DelayReason',
  'InsuranceFollowup',
  'DecisionPending',
]);

const CALLBACK_TYPE_CODE_TO_DB: Record<string, string> = {
  SCHEDULED: 'General',
  REMINDER: 'General',
  FOLLOW_UP: 'General',
  NO_SHOW: 'DelayReason',
  URGENT: 'General',
  // Already-valid / legacy passthrough
  PreSurgery: 'PreSurgery',
  PostSurgery: 'PostSurgery',
  General: 'General',
  Financial: 'Financial',
  FearAnxiety: 'FearAnxiety',
  DelayReason: 'DelayReason',
  InsuranceFollowup: 'InsuranceFollowup',
  DecisionPending: 'DecisionPending',
};

/** Callback channel CHECK allows Phone | WhatsApp | SMS | VideoCall only (no Email/InPerson). */
const CALLBACK_CHANNEL_TO_DB: Record<string, string> = {
  Phone: 'Phone',
  SMS: 'SMS',
  WhatsApp: 'WhatsApp',
  VideoCall: 'VideoCall',
  Email: 'Phone',
  InPerson: 'Phone',
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Phone',
  IN_PERSON: 'Phone',
};

/**
 * counselor_communication_log.outcome CHECK allowlist (migration 69).
 * UI shorthand outcomes must be mapped before write.
 */
const COMM_OUTCOME_TO_DB: Record<string, string> = {
  Answered: 'Answered',
  AnsweredInterested: 'AnsweredInterested',
  AnsweredNotInterested: 'AnsweredNotInterested',
  AnsweredCallbackNeeded: 'AnsweredCallbackNeeded',
  NoAnswer: 'NoAnswer',
  Busy: 'Busy',
  WrongNumber: 'WrongNumber',
  Voicemail: 'Voicemail',
  MessageSent: 'MessageSent',
  DeclinedContact: 'DeclinedContact',
  // UI shorthand used by ContactLogModal
  LeftMessage: 'Voicemail',
  Declined: 'DeclinedContact',
};

/** Channels offered in Send Reminder (subset of comm_channel) */
const REMINDER_CHANNEL_CODES = new Set(['SMS', 'WHATSAPP', 'EMAIL']);

export function commChannelCodeToApi(code: string): string {
  return COMM_CHANNEL_TO_API[code.toUpperCase()] ?? code;
}

/**
 * Master counsellor.callback_type code → counselor_callback_requests.callback_type DB value.
 * Does not invent new CHECK values — maps onto the existing migration-70 allowlist.
 */
export function callbackTypeCodeToDb(code: string | undefined | null): string {
  const raw = (code ?? '').trim();
  if (!raw) return 'General';
  if (CALLBACK_TYPE_DB_ALLOWLIST.has(raw)) return raw;
  const mapped = CALLBACK_TYPE_CODE_TO_DB[raw] ?? CALLBACK_TYPE_CODE_TO_DB[raw.toUpperCase()];
  return mapped ?? 'General';
}

/** Comm / API channel → callback channel allowed by migration-70 CHECK. */
export function callbackChannelToDb(channel: string | undefined | null): string {
  const raw = (channel ?? '').trim();
  if (!raw) return 'Phone';
  return CALLBACK_CHANNEL_TO_DB[raw] ?? CALLBACK_CHANNEL_TO_DB[raw.toUpperCase()] ?? 'Phone';
}

/** ContactLogModal / UI outcome → communication_log.outcome DB value. */
export function contactOutcomeToDb(outcome: string | undefined | null): string {
  const raw = (outcome ?? '').trim();
  if (!raw) return 'Answered';
  return COMM_OUTCOME_TO_DB[raw] ?? raw;
}

export function commChannelApiToLabel(apiValue: string, options: MasterOption[]): string {
  const normalized = apiValue.replace(/\s/g, '');
  const match = options.find(
    (o) => commChannelCodeToApi(o.value) === apiValue || o.value === normalized.toUpperCase(),
  );
  return match?.label ?? apiValue;
}

export function filterReminderChannelOptions(options: MasterOption[]): MasterOption[] {
  const filtered = options.filter((o) => REMINDER_CHANNEL_CODES.has(o.value.toUpperCase()));
  return filtered.length > 0 ? filtered : options;
}

/** Default SMS templates keyed by counsellor.reminder_type master code */
export const REMINDER_TEMPLATES_BY_CODE: Record<string, string> = {
  PRE_OP_DAY:
    'Hi {name}, this is a reminder about your upcoming procedure tomorrow. Please follow pre-op instructions and contact us with any questions.',
  APPOINTMENT:
    'Hi {name}, this is a friendly reminder about your upcoming appointment at our hospital. Please confirm your attendance or contact us to reschedule. Thank you.',
  FOLLOW_UP:
    "Hi {name}, we're checking in for your follow-up. If you have any concerns, please reach out to our care team.",
  PAYMENT_DUE:
    'Hi {name}, this is a reminder that a payment is due for your care plan. Please contact our billing desk at your earliest convenience.',
  RESULT_READY:
    'Hi {name}, your test results are ready. Please visit or call the hospital to discuss them with your care team.',
  // Legacy API keys (if stored in sessions)
  CallbackReminder:
    'Hi {name}, this is a reminder that we have a scheduled callback with you soon regarding your upcoming procedure.',
  AppointmentReminder:
    'Hi {name}, this is a friendly reminder about your upcoming appointment at our hospital.',
  WellnessCheck:
    "Hi {name}, we're checking in to see how you're doing. Please reach out if you have any concerns.",
  PostSurgeryFollowup:
    "Hi {name}, we hope you're recovering well after your recent procedure. Please contact us if you experience unusual symptoms.",
  General:
    'Hi {name}, this is a message from our care team at the hospital. Please reach out at your earliest convenience.',
};

export function reminderTemplateForCode(code: string, patientFirstName: string): string {
  const meta = REMINDER_TEMPLATES_BY_CODE[code] ?? REMINDER_TEMPLATES_BY_CODE.General;
  return meta.replace('{name}', patientFirstName);
}

export function templateFromMasterOption(
  option: MasterOption,
  patientFirstName: string,
): string {
  const fromMeta =
    typeof option.metadata?.template === 'string' ? option.metadata.template : null;
  if (fromMeta) return fromMeta.replace('{name}', patientFirstName);
  return reminderTemplateForCode(option.value, patientFirstName);
}

/** Legacy counseling_sessions.session_type values → master code */
const SESSION_TYPE_LEGACY_TO_CODE: Record<string, string> = {
  Initial: 'INITIAL',
  'Initial Counseling': 'INITIAL',
  Followup: 'FOLLOW_UP',
  'Follow-Up': 'FOLLOW_UP',
  Recheck: 'FOLLOW_UP',
  'Pre-Surgery': 'PRE_OP',
  PreSurgery: 'PRE_OP',
  'Pre-Op Counseling': 'PRE_OP',
  'Post-Op': 'POST_OP',
  PostSurgery: 'POST_OP',
  'Post-Op Counseling': 'POST_OP',
  'Package Finalization': 'PACKAGE',
  Financial: 'PACKAGE',
  Insurance: 'PACKAGE',
  General: 'INITIAL',
  Urgent: 'INITIAL',
  AttenderCounseling: 'FOLLOW_UP',
};

/**
 * DB check counseling_sessions_session_type_check allows only:
 * Initial | Followup | Recheck | Urgent
 * Master UI codes must be mapped before POST /Counseling/sessions.
 */
const SESSION_TYPE_CODE_TO_DB: Record<string, string> = {
  INITIAL: 'Initial',
  FOLLOW_UP: 'Followup',
  PRE_OP: 'Recheck',
  POST_OP: 'Followup',
  PACKAGE: 'Initial',
  URGENT: 'Urgent',
  // Already-legacy / passthrough
  Initial: 'Initial',
  Followup: 'Followup',
  Recheck: 'Recheck',
  Urgent: 'Urgent',
};

export function defaultSessionTypeCode(context: 'new' | 'repeat' | 'requeue' = 'new'): string {
  if (context === 'repeat' || context === 'requeue') return 'FOLLOW_UP';
  return 'INITIAL';
}

/** Master counsellor.session_type code → counseling_sessions.session_type DB value */
export function sessionTypeCodeToDb(code: string | undefined | null): string {
  const raw = (code ?? '').trim();
  if (!raw) return 'Initial';
  const mapped = SESSION_TYPE_CODE_TO_DB[raw] ?? SESSION_TYPE_CODE_TO_DB[raw.toUpperCase()];
  if (mapped) return mapped;
  // Unknown master code — safest allowed default
  return 'Initial';
}

/** Normalize DB / API session_type to counsellor.session_type master code */
export function sessionTypeApiToCode(apiValue: string | undefined | null, options: MasterOption[]): string {
  if (!apiValue) return defaultSessionTypeCode('new');
  const direct = options.find((o) => o.value === apiValue);
  if (direct) return direct.value;
  const legacy = SESSION_TYPE_LEGACY_TO_CODE[apiValue];
  if (legacy) return legacy;
  const byLabel = options.find((o) => o.label === apiValue);
  if (byLabel) return byLabel.value;
  return defaultSessionTypeCode('new');
}

export function sessionTypeLabelForCode(code: string, options: MasterOption[]): string {
  const match = options.find((o) => o.value === code);
  if (match) return match.label;
  const legacyLabel = Object.entries(SESSION_TYPE_LEGACY_TO_CODE).find(([, c]) => c === code)?.[0];
  return legacyLabel ?? code;
}

'use client';

import {
  countAdditionalEngagements,
  formatDirectoryPhoneDisplay,
  formatHubCurrentVisitStatusLine,
  formatHubLocationLines,
  formatHubNextAppointment,
  pickPrimaryVisitEngagement,
} from '@/lib/patients/patient-hub-row-display';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

const emptyCellClass = 'text-sm text-counselling-muted-foreground';

/** Compact engagement indicator (legacy export — prefer Current Visit status line). */
export function PatientHubEngagementCell({ row }: { row: PatientLookupRow }) {
  const primary = pickPrimaryVisitEngagement(row.activeEngagements ?? []);
  if (!primary) return null;
  const extra = countAdditionalEngagements(row.activeEngagements);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          counsellingSessionTokens.statusPill,
          'max-w-full truncate bg-counselling-muted text-counselling-foreground',
        )}
        title={primary.label}
      >
        {primary.label}
      </span>
      {extra > 0 && (
        <span className="shrink-0 text-xs font-medium text-counselling-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Directory grid phone — plain text only (no tel: / click). Presentation formatting only. */
export function PatientHubPhoneCell({ row }: { row: PatientLookupRow }) {
  const phone = row.phone?.trim() ?? '';
  if (!phone) {
    return <span className={emptyCellClass}>Not available</span>;
  }
  const display = formatDirectoryPhoneDisplay(phone);
  return (
    <span
      className="block min-w-0 max-w-full truncate whitespace-nowrap text-sm font-medium text-counselling-foreground"
      data-testid={patientLookupTestIds.rowPhone(row.id)}
      title={display}
    >
      {display}
    </span>
  );
}

/**
 * Current Visit: reason + compact status/time (+ engagement) — max two lines.
 * Uses existing scheduledAt semantics (check-in vs appointment).
 */
export function PatientHubCurrentVisitCell({
  row,
  showInlineProvider = false,
}: {
  row: PatientLookupRow;
  /** Tablet / compact: fold Provider into Current Visit. */
  showInlineProvider?: boolean;
}) {
  const reason = row.reasonForVisit?.trim() ?? '';
  const statusLine = formatHubCurrentVisitStatusLine(row);
  const providerName = row.assignedProviderName?.trim() ?? '';
  const providerRole = row.assignedProviderRole?.trim() ?? '';
  const providerLine = [providerName, providerRole].filter(Boolean).join(' · ');

  if (!reason && !statusLine && !(showInlineProvider && providerLine)) {
    return <span className={emptyCellClass}>No active visit</span>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-0.5 overflow-hidden">
      {reason ? (
        <p className="truncate text-sm text-counselling-foreground" title={reason}>
          {reason}
        </p>
      ) : null}
      {statusLine ? (
        <p
          className="truncate text-xs text-counselling-muted-foreground"
          title={statusLine}
        >
          {statusLine}
        </p>
      ) : null}
      {showInlineProvider && providerLine ? (
        <p className="truncate text-xs text-counselling-muted-foreground" title={providerLine}>
          {providerLine}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer PatientHubCurrentVisitCell — kept for transitional imports. */
export function PatientHubVisitCell({
  row,
  showInlineProvider = false,
}: {
  row: PatientLookupRow;
  showInlineLocation?: boolean;
  showInlineProvider?: boolean;
}) {
  return <PatientHubCurrentVisitCell row={row} showInlineProvider={showInlineProvider} />;
}

export function PatientHubLocationCell({ row }: { row: PatientLookupRow }) {
  const lines = formatHubLocationLines(row);
  if (lines.length === 0) {
    return <span className={emptyCellClass}>—</span>;
  }
  return (
    <div className="min-w-0 space-y-0.5">
      {lines.map((line) => (
        <p key={line} className="truncate text-sm text-counselling-foreground" title={line}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function PatientHubProviderCell({ row }: { row: PatientLookupRow }) {
  const name = row.assignedProviderName?.trim() ?? '';
  const role = row.assignedProviderRole?.trim() ?? '';
  if (!name && !role) {
    // Neutral placeholder — lookup did not return provider context (not "unassigned").
    return <span className={emptyCellClass}>—</span>;
  }
  return (
    <div className="min-w-0">
      {name && (
        <p className="truncate text-sm text-counselling-foreground" title={name}>
          {name}
        </p>
      )}
      {role && <p className="truncate text-xs text-counselling-muted-foreground">{role}</p>}
    </div>
  );
}

/**
 * Next Appointment column — appointment time only (never check-in time).
 * Display only; booking is a direct Actions control when applicable.
 */
export function PatientHubNextAppointmentCell({ row }: { row: PatientLookupRow }) {
  const when = formatHubNextAppointment(row);
  if (!when) {
    return <span className={emptyCellClass}>No upcoming appointment</span>;
  }
  return (
    <p className="truncate text-sm text-counselling-foreground" title={when}>
      {when}
    </p>
  );
}

/** @deprecated Booking moved to PatientHubRowActions direct action. */
export function PatientHubAppointmentCell({ row }: { row: PatientLookupRow }) {
  return <PatientHubNextAppointmentCell row={row} />;
}

export function PatientHubMobileContextLine({ row }: { row: PatientLookupRow }) {
  const reason = row.reasonForVisit?.trim() ?? '';
  const statusLine = formatHubCurrentVisitStatusLine(row);
  if (!reason && !statusLine) {
    return <span className={emptyCellClass}>No active visit</span>;
  }
  return (
    <div className="mt-1 min-w-0 space-y-0.5">
      {reason ? (
        <p className="truncate text-sm text-counselling-foreground" title={reason}>
          {reason}
        </p>
      ) : null}
      {statusLine ? (
        <p className="truncate text-xs text-counselling-muted-foreground" title={statusLine}>
          {statusLine}
        </p>
      ) : null}
    </div>
  );
}

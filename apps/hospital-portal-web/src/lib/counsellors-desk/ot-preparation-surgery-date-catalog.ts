import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import { isValidPrepareOtSurgeryDate } from './prepare-ot-date-scope';

export type SurgeryDateCatalogEntry = {
  /** yyyy-MM-dd from ScheduleDate / StartTime — never Finalisation date */
  scheduleDate: string;
  /** Count of Finalised rows on this surgery date */
  readyCount: number;
  /** Count of OTPrepared rows on this surgery date (from loaded finalize records) */
  preparedCount: number;
};

/**
 * RESP presentation kinds for standalone OT Preparation.
 * Ready / None / Already-prepared / Completion — no prepared operational grid.
 */
export type OtPreparationDayKind = 'ready' | 'none' | 'already_prepared' | 'completion';

export type OtPreparationDayPresentation = {
  kind: OtPreparationDayKind;
  primaryMessage: string;
  secondaryMessage?: string;
  readyCount: number;
  preparedCount: number;
};

/** Historical Package A READ plan — retained for contract tests; OT Prep UI no longer auto-loads getOtList. */
export type OtPrepDateLoadPlan = {
  date: string;
  readOnly: true;
  invokePrepare: false;
};

function dayKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const day = raw.trim().slice(0, 10);
  return isValidPrepareOtSurgeryDate(day) ? day : null;
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addLocalDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localYmd(dt);
}

function surgeryCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'surgery' : 'surgeries'} prepared`;
}

/**
 * Relative label for an actual ScheduleDate only — never invents a date.
 * PD-OTPREP-UAT-01 / RESP-09.
 */
export function formatSurgeryDateRelativeLabel(
  scheduleDate: string,
  today: Date = new Date(),
): string {
  const day = dayKey(scheduleDate);
  if (!day) return scheduleDate?.trim() || '—';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[dt.getDay()];
  const dayNum = String(d).padStart(2, '0');
  const month = MONTHS[m - 1];
  const weekdayDate = `${weekday}, ${dayNum} ${month}`;

  const todayKey = localYmd(today);
  if (day === todayKey) return `Today · ${weekdayDate}`;
  if (day === addLocalDays(todayKey, 1)) return `Tomorrow · ${weekdayDate}`;
  return weekdayDate;
}

/**
 * Distinct surgery ScheduleDate values from loaded Finalize/OT records.
 * Counts derive from existing status fields only — no invented date horizon.
 */
export function buildSurgeryDateCatalog(
  records: FinalizeSurgeryRecord[],
): SurgeryDateCatalogEntry[] {
  const map = new Map<string, SurgeryDateCatalogEntry>();

  for (const r of records) {
    const scheduleDate = dayKey(r.scheduleDate);
    if (!scheduleDate) continue;

    let entry = map.get(scheduleDate);
    if (!entry) {
      entry = { scheduleDate, readyCount: 0, preparedCount: 0 };
      map.set(scheduleDate, entry);
    }

    if (r.status === 'Finalised') entry.readyCount += 1;
    if (r.status === 'OTPrepared') entry.preparedCount += 1;
  }

  return [...map.values()]
    .filter((e) => e.readyCount > 0 || e.preparedCount > 0)
    .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate));
}

/**
 * Honest OT Preparation day messaging from catalog/finalize data only.
 * PD-OTPREP-RESP — no getOtList grid; completion is session presentation only.
 */
export function resolveOtPreparationDayPresentation(input: {
  selectedDate: string | null | undefined;
  readyCount: number;
  preparedCountInRecords: number;
  /** Session completion after successful Prepare for this ScheduleDate */
  completionForDate?: string | null;
  completionCount?: number;
}): OtPreparationDayPresentation {
  const selected = dayKey(input.selectedDate);
  const readyCount = Math.max(0, input.readyCount);
  const preparedCount = Math.max(0, input.preparedCountInRecords);
  const completionDay = dayKey(input.completionForDate);
  const completionCount = Math.max(0, input.completionCount ?? 0);

  if (selected && completionDay === selected && completionCount > 0) {
    return {
      kind: 'completion',
      primaryMessage: 'OT list prepared',
      secondaryMessage: surgeryCountLabel(completionCount),
      readyCount: 0,
      preparedCount: completionCount,
    };
  }

  if (readyCount > 0) {
    return {
      kind: 'ready',
      primaryMessage: 'Ready for OT Preparation',
      secondaryMessage: `${readyCount} ${readyCount === 1 ? 'surgery' : 'surgeries'}`,
      readyCount,
      preparedCount,
    };
  }

  if (preparedCount > 0) {
    return {
      kind: 'already_prepared',
      primaryMessage: 'OT list already prepared',
      secondaryMessage: surgeryCountLabel(preparedCount),
      readyCount: 0,
      preparedCount,
    };
  }

  return {
    kind: 'none',
    primaryMessage: 'No eligible surgeries',
    readyCount: 0,
    preparedCount: 0,
  };
}

/** Clear stale OT Preparation presentation when the selected surgery date changes. */
export function shouldClearPreparedOtListOnDateChange(
  previousDate: string | null | undefined,
  nextDate: string | null | undefined,
): boolean {
  const prev = dayKey(previousDate);
  const next = dayKey(nextDate);
  if (!prev || !next) return false;
  return prev !== next;
}

/**
 * Historical Package A auto-load contract: READ GetOtList only — never Prepare.
 * Standalone OT Prep no longer uses this for presentation (RESP-03).
 */
export function createOtPrepDateLoadPlan(date: string | null | undefined): OtPrepDateLoadPlan | null {
  const day = dayKey(date);
  if (!day) return null;
  return { date: day, readOnly: true, invokePrepare: false };
}

/**
 * RESP-08 preparation-oriented metrics — existing catalog data only.
 * No backend metric API.
 */
export type OtPreparationMetrics = {
  /** Ready for selected ScheduleDate (selectFinalisedForPrepareDate length) */
  readyForSelectedDate: number;
  /** Catalog entries with readyCount > 0 */
  datesRequiringPreparation: number;
};

export function summarizeOtPreparationMetrics(
  catalog: SurgeryDateCatalogEntry[],
  readyForSelectedDate: number,
): OtPreparationMetrics {
  let datesRequiringPreparation = 0;
  for (const entry of catalog) {
    if (entry.readyCount > 0) datesRequiringPreparation += 1;
  }
  return {
    readyForSelectedDate: Math.max(0, readyForSelectedDate),
    datesRequiringPreparation,
  };
}

/** @deprecated Package A strip — superseded by summarizeOtPreparationMetrics (RESP-08). */
export type OtPreparationStripSummary = {
  surgeryDateCount: number;
  readyCount: number;
  preparedCount: number;
};

/** @deprecated Package A strip — retained for historical tests only. */
export function summarizeOtPreparationCatalog(
  catalog: SurgeryDateCatalogEntry[],
): OtPreparationStripSummary {
  let readyCount = 0;
  let preparedCount = 0;
  for (const entry of catalog) {
    readyCount += entry.readyCount;
    preparedCount += entry.preparedCount;
  }
  return {
    surgeryDateCount: catalog.length,
    readyCount,
    preparedCount,
  };
}

/** Unfiltered-by-date Finalize list filters — existing API omits `date` when empty. */
export const OT_PREP_SURGERY_DATE_CATALOG_FILTERS = {
  date: '',
  uhid: '',
  name: '',
} as const;

/**
 * Content-aware OT Prep preparation queue grid (Finalised eligible).
 * Patient/Procedure capped; Eye/Time/Theatre/Status compact — no Action/selection column.
 */
export const OT_PREPARATION_READY_GRID_CLASS =
  'grid w-max min-w-full max-w-full grid-cols-[1.75rem_minmax(9rem,14rem)_minmax(7rem,12rem)_2.25rem_3.75rem_minmax(5.5rem,9rem)_4.75rem_6.25rem] items-center gap-x-3 pr-3';

/** @deprecated Alias — historical Package A prepared-grid class name; maps to ready grid. */
export const OT_PREPARATION_PREPARED_GRID_CLASS = OT_PREPARATION_READY_GRID_CLASS;

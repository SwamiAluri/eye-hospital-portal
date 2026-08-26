import {
  IP_DASHBOARD_TABS,
  type IpDashboardTab,
  type IpFinancialFilter,
} from './ip-dashboard-tabs';
import { isSlotSession, type IpSlotSessionFilter } from './ip-slot-display';

export const IP_CENSUS_TAB_KEYS: readonly IpDashboardTab[] = IP_DASHBOARD_TABS.map(t => t.key);

export const IP_CENSUS_FIN_KEYS: readonly IpFinancialFilter[] = [
  'All',
  'HasBalance',
  'Cleared',
  'EmergencyFc',
];

export interface IpCensusUrlState {
  tab: IpDashboardTab;
  patient: string | null;
  fin: IpFinancialFilter;
  session: IpSlotSessionFilter;
}

export const DEFAULT_IP_CENSUS_URL: IpCensusUrlState = {
  tab: 'All',
  patient: null,
  fin: 'All',
  session: 'All',
};

function isTab(value: string | null): value is IpDashboardTab {
  return !!value && (IP_CENSUS_TAB_KEYS as readonly string[]).includes(value);
}

function isFin(value: string | null): value is IpFinancialFilter {
  return !!value && (IP_CENSUS_FIN_KEYS as readonly string[]).includes(value);
}

/** Read `?tab=&patient=&fin=&session=` from the census URL. Unknown values fall back to All / none. */
export function parseIpCensusSearchParams(
  params: Pick<URLSearchParams, 'get'>,
): IpCensusUrlState {
  const tabRaw = params.get('tab');
  const finRaw = params.get('fin');
  const sessionRaw = params.get('session');
  const patientRaw = params.get('patient')?.trim() ?? '';

  return {
    tab: isTab(tabRaw) ? tabRaw : 'All',
    fin: isFin(finRaw) ? finRaw : 'All',
    session: isSlotSession(sessionRaw) ? sessionRaw : 'All',
    patient: patientRaw.length > 0 ? patientRaw : null,
  };
}

/**
 * Write census selection into a query string.
 * Default tab/fin/session (`All`) are omitted so shared links stay short; `patient` is always
 * written when a row is selected.
 */
export function serializeIpCensusSearchParams(
  state: IpCensusUrlState,
  current?: Pick<URLSearchParams, 'toString'>,
): string {
  const params = new URLSearchParams(current?.toString() ?? '');
  if (state.tab && state.tab !== 'All') params.set('tab', state.tab);
  else params.delete('tab');

  if (state.fin && state.fin !== 'All') params.set('fin', state.fin);
  else params.delete('fin');

  if (state.session && state.session !== 'All') params.set('session', state.session);
  else params.delete('session');

  if (state.patient) params.set('patient', state.patient);
  else params.delete('patient');

  return params.toString();
}

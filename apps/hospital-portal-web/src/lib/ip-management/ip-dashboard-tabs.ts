import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

/** Primary IP dashboard tabs are clinical / operational. Financial is secondary. */
export type IpDashboardTab =
  | 'All'
  | 'InHouse'
  | 'ReadyForOt'
  | 'SentToOt'
  | 'InOt'
  | 'PostOp'
  | 'ReadyForDischarge'
  | 'Discharged'
  | 'Cancelled';

export type IpFinancialFilter = 'All' | 'HasBalance' | 'Cleared' | 'EmergencyFc';

export const IP_DASHBOARD_TABS: { key: IpDashboardTab; label: string; activeClass: string; dot: string }[] = [
  { key: 'All', label: 'All', activeClass: 'bg-gray-800 text-white', dot: 'bg-gray-400' },
  { key: 'InHouse', label: 'In-House', activeClass: 'bg-teal-600 text-white', dot: 'bg-teal-400' },
  { key: 'ReadyForOt', label: 'Ready for OT', activeClass: 'bg-violet-600 text-white', dot: 'bg-violet-400' },
  { key: 'SentToOt', label: 'Sent to OT', activeClass: 'bg-purple-600 text-white', dot: 'bg-purple-400' },
  { key: 'InOt', label: 'In OT', activeClass: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
  { key: 'PostOp', label: 'Post-Op', activeClass: 'bg-green-600 text-white', dot: 'bg-green-500' },
  { key: 'ReadyForDischarge', label: 'Ready D/C', activeClass: 'bg-emerald-600 text-white', dot: 'bg-emerald-400' },
  { key: 'Discharged', label: 'Discharged', activeClass: 'bg-slate-500 text-white', dot: 'bg-slate-400' },
  { key: 'Cancelled', label: 'Cancelled', activeClass: 'bg-rose-600 text-white', dot: 'bg-rose-400' },
];

export function matchesIpDashboardTab(j: PatientJourneyRowDto, tab: IpDashboardTab): boolean {
  switch (tab) {
    case 'All':
      return true;
    case 'InHouse':
      return j.clinicalState === 'Admitted';
    case 'ReadyForOt':
      return j.clinicalState === 'ReadyForSurgery';
    case 'SentToOt':
      return j.clinicalState === 'SentToOT';
    case 'InOt':
      return j.clinicalState === 'InOT';
    case 'PostOp':
      return j.clinicalState === 'SurgeryCompleted' || j.clinicalState === 'PostOp';
    case 'ReadyForDischarge':
      return j.clinicalState === 'ReadyForDischarge';
    case 'Discharged':
      return j.clinicalState === 'Discharged';
    case 'Cancelled':
      return j.clinicalState === 'CancelledSurgery' || j.clinicalState === 'AdmissionCancelled';
    default:
      return true;
  }
}

export function matchesIpFinancialFilter(j: PatientJourneyRowDto, filter: IpFinancialFilter): boolean {
  switch (filter) {
    case 'All':
      return true;
    case 'HasBalance':
      return (j.balanceDue ?? 0) > 0;
    case 'Cleared':
      return (j.balanceDue ?? 0) <= 0;
    case 'EmergencyFc':
      return j.isEmergencyFc === true;
    default:
      return true;
  }
}

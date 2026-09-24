/**
 * Concise Waiting List empty-state copy by status tab.
 * Tab label already conveys context — no implementation jargon.
 */
export function resolveWaitingListEmptyCopy(input: {
  activeTab: string;
  hasRestrictiveClientScope: boolean;
  hasAnyPatientsInBranch: boolean;
}): { title: string; detail?: string } {
  if (input.hasRestrictiveClientScope) {
    return { title: 'No patients found' };
  }

  switch (input.activeTab) {
    case 'Pending':
      return { title: 'No pending patients' };
    case 'Processed':
      return { title: 'No patients in progress' };
    case 'Done':
      return { title: 'No completed counselling sessions' };
    case 'RepeatCounselling':
      return { title: 'No repeat counselling cases' };
    case 'AddOnSurgery':
      return { title: 'No add-on surgery cases' };
    case 'SurgeryDone':
      return { title: 'No surgery-completed cases' };
    case 'OtReturned':
      return { title: 'No OT-returned patients' };
    case 'PreAuthQueue':
      return { title: 'No patients awaiting pre-authorization' };
    case 'All':
    default:
      if (!input.hasAnyPatientsInBranch) {
        return { title: 'No patients found' };
      }
      return { title: 'No patients found' };
  }
}

/** Selected-tab content title — mirrors tab label; no redundant "Patient Queue". */
export function resolveWaitingListQueueTitle(activeTab: string): string {
  switch (activeTab) {
    case 'Pending':
      return 'Pending';
    case 'Processed':
      return 'Processing';
    case 'Done':
      return 'Done';
    case 'RepeatCounselling':
      return 'Repeat Counselling';
    case 'AddOnSurgery':
      return 'Add-on Surgery';
    case 'SurgeryDone':
      return 'Surgery Done';
    case 'OtReturned':
      return 'OT Returned';
    case 'PreAuthQueue':
      return 'Pre-Auth Queue';
    case 'All':
    default:
      return 'All';
  }
}

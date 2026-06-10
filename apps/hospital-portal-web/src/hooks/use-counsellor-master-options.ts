'use client';

import { useMasterValues } from '@/hooks/use-master-values';

/** Program B — counsellor desk master lookups */
export function useCounsellorMasterOptions() {
  const commChannel = useMasterValues('counsellor.comm_channel');
  const reminderType = useMasterValues('counsellor.reminder_type');
  const callbackType = useMasterValues('counsellor.callback_type');
  const sessionType = useMasterValues('counsellor.session_type');

  return {
    commChannelOptions: commChannel.options,
    commChannelLoading: commChannel.loading,
    reminderTypeOptions: reminderType.options,
    reminderTypeLoading: reminderType.loading,
    callbackTypeOptions: callbackType.options,
    callbackTypeLoading: callbackType.loading,
    sessionTypeOptions: sessionType.options,
    sessionTypeLoading: sessionType.loading,
  };
}

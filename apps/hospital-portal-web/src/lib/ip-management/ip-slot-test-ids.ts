/** Stable `data-testid` values for the day-care slot board (IP-013). */
export const IP_SLOT_TEST_IDS = {
  board: 'ip-slot-board',
  date: 'ip-slot-date',
  theatre: 'ip-slot-theatre',
  assign: (session: string) => `ip-slot-assign-${session}`,
  assignDialog: 'ip-slot-assign-dialog',
  assignPatient: 'ip-slot-assign-patient',
  assignSubmit: 'ip-slot-assign-submit',
  row: (journeyId: string) => `ip-slot-row-${journeyId}`,
} as const;

import { loadPatient360Administration } from '@/lib/patients/patient-360-administration';
import {
  loadPatient360Clinical,
  loadPatient360Prescriptions,
} from '@/lib/patients/patient-360-clinical';
import { loadPatient360Communications } from '@/lib/patients/patient-360-communication';
import { loadPatient360CounsellingSessions } from '@/lib/patients/patient-360-counselling-sessions';
import { loadPatient360Bills } from '@/lib/patients/patient-360-financial';

export type TimelineReadState = 'ready' | 'unavailable';

export interface Patient360TimelineEvent {
  id: string;
  at: string | null;
  sortAt: number;
  type: string;
  description: string;
  source: string;
  actor: string | null;
  href: string | null;
}

export interface Patient360TimelineResult {
  state: TimelineReadState;
  events: Patient360TimelineEvent[];
  sourcesUnavailable: string[];
}

function parseSort(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(time) ? time : 0;
}

function event(input: Omit<Patient360TimelineEvent, 'sortAt'>): Patient360TimelineEvent {
  return { ...input, sortAt: parseSort(input.at) };
}

export function sortTimelineEvents(events: Patient360TimelineEvent[]): Patient360TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.sortAt !== b.sortAt) return b.sortAt - a.sortAt;
    return a.id.localeCompare(b.id);
  });
}

export function timelineUnavailableMessage(): string {
  return 'Timeline is not available in Patient 360.';
}

export function timelineEmptyMessage(): string {
  return 'No dated events were returned from available sources.';
}

export async function loadPatient360Timeline(patientId: string): Promise<Patient360TimelineResult> {
  const [admin, clinical, communications, counselling, bills, prescriptions] = await Promise.all([
    loadPatient360Administration(patientId),
    loadPatient360Clinical(patientId),
    loadPatient360Communications(patientId),
    loadPatient360CounsellingSessions(patientId),
    loadPatient360Bills(patientId),
    loadPatient360Prescriptions(patientId, 1),
  ]);

  const sourcesUnavailable: string[] = [];
  const events: Patient360TimelineEvent[] = [];
  let anyReady = false;

  const pushSource = (name: string, state: string, map: () => void) => {
    if (state === 'unavailable' || state === 'unauthorized') {
      sourcesUnavailable.push(name);
      return;
    }
    anyReady = true;
    if (state === 'ready') map();
  };

  pushSource('Appointments', admin.appointments.state, () => {
    for (const row of admin.appointments.rows) {
      events.push(
        event({
          id: `appointment-${row.id}`,
          at: row.when,
          type: 'Appointment',
          description: [row.title, row.status, row.detail].filter(Boolean).join(' · '),
          source: 'Scheduling',
          actor: row.provider,
          href: null,
        }),
      );
    }
  });

  pushSource('Visits', admin.visits.state, () => {
    for (const row of admin.visits.rows) {
      events.push(
        event({
          id: `visit-${row.id ?? row.title}`,
          at: row.when ?? row.checkInTime,
          type: 'Visit',
          description: [row.title, row.status, row.station].filter(Boolean).join(' · '),
          source: 'Front desk',
          actor: row.provider,
          href: row.encounterHref,
        }),
      );
    }
  });

  pushSource('Consents', admin.consents.state, () => {
    for (const row of admin.consents.rows) {
      events.push(
        event({
          id: `consent-${row.id}`,
          at: row.grantedAt ?? row.revokedAt,
          type: 'Consent',
          description: [row.title, row.status].filter(Boolean).join(' · '),
          source: 'Administration',
          actor: null,
          href: null,
        }),
      );
    }
  });

  pushSource('Examinations', clinical.examinations.state, () => {
    for (const row of clinical.examinations.rows) {
      events.push(
        event({
          id: `exam-${row.id}`,
          at: row.when,
          type: 'Examination',
          description: row.title,
          source: 'Clinical',
          actor: row.provider,
          href: null,
        }),
      );
    }
  });

  pushSource('Prescriptions', prescriptions.state, () => {
    for (const row of prescriptions.rows) {
      const meds = row.lines.map((line) => line.medicationName).filter(Boolean).join(', ');
      events.push(
        event({
          id: `rx-${row.id}`,
          at: row.when,
          type: 'Prescription',
          description: [meds || 'Prescription', row.status].filter(Boolean).join(' · '),
          source: 'Clinical',
          actor: null,
          href: null,
        }),
      );
    }
  });

  pushSource('Laboratory', clinical.labs.state, () => {
    for (const row of clinical.labs.rows) {
      events.push(
        event({
          id: `lab-${row.id}`,
          at: row.when,
          type: 'Laboratory',
          description: [row.title, row.status].filter(Boolean).join(' · '),
          source: 'Laboratory',
          actor: null,
          href: null,
        }),
      );
    }
  });

  pushSource('Communications', communications.state, () => {
    for (const row of communications.rows) {
      events.push(
        event({
          id: `comm-${row.id}`,
          at: row.when,
          type: 'Communication',
          description: [row.subject ?? row.channel, row.status].filter(Boolean).join(' · '),
          source: 'Communication',
          actor: row.sender,
          href: null,
        }),
      );
    }
  });

  pushSource('Counselling', counselling.state, () => {
    for (const row of counselling.rows) {
      events.push(
        event({
          id: `counsel-${row.id}`,
          at: row.sessionDate,
          type: 'Counselling',
          description: [row.sessionNumber ?? row.sessionType, row.status].filter(Boolean).join(' · '),
          source: 'Counselling',
          actor: row.counsellorName,
          href: null,
        }),
      );
    }
  });

  pushSource('Billing', bills.state, () => {
    for (const row of bills.rows) {
      events.push(
        event({
          id: `bill-${row.id}`,
          at: row.billDate,
          type: 'Billing',
          description: [row.billNumber ?? 'OPD bill', row.status].filter(Boolean).join(' · '),
          source: 'Billing',
          actor: null,
          href: null,
        }),
      );
    }
  });

  if (!anyReady) {
    return { state: 'unavailable', events: [], sourcesUnavailable };
  }

  return {
    state: 'ready',
    events: sortTimelineEvents(events),
    sourcesUnavailable,
  };
}

import { visitsApi, examinationApi, prescriptionsApi } from '@/lib/api';

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  lastInteraction?: string;
  interactionCount: number;
}

function upsertMember(
  map: Map<string, CareTeamMember>,
  name: string,
  role: string,
  specialty: string,
  date?: string,
) {
  const key = name.trim().toLowerCase();
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    existing.interactionCount += 1;
    if (date && (!existing.lastInteraction || date > existing.lastInteraction)) {
      existing.lastInteraction = date;
    }
    return;
  }
  map.set(key, {
    id: key,
    name: name.trim(),
    role,
    specialty,
    lastInteraction: date,
    interactionCount: 1,
  });
}

export async function fetchCareTeam(patientId: string): Promise<CareTeamMember[]> {
  const [visitsRes, examsRes, rxRes] = await Promise.allSettled([
    visitsApi.getByPatient(patientId),
    examinationApi.getByPatient(patientId),
    prescriptionsApi.getByPatient(patientId),
  ]);

  const map = new Map<string, CareTeamMember>();

  if (visitsRes.status === 'fulfilled') {
    const visits = visitsRes.value.data ?? [];
    for (const v of visits) {
      const doctor = v.doctorName ?? v.assignedDoctorName;
      if (doctor) {
        upsertMember(
          map,
          doctor,
          'Attending',
          v.departmentName ?? 'OPD',
          v.checkInTime ?? v.createdAt,
        );
      }
    }
  }

  if (examsRes.status === 'fulfilled') {
    const exams = examsRes.value.data ?? [];
    for (const e of exams) {
      if (e.doctorName) {
        upsertMember(
          map,
          e.doctorName,
          'Examiner',
          e.examinationType ?? 'Examination',
          e.examinationDate ?? e.createdAt,
        );
      }
    }
  }

  if (rxRes.status === 'fulfilled') {
    const rx = rxRes.value.data ?? [];
    for (const p of rx) {
      const prescriber = p.prescribedBy ?? p.doctorName;
      if (prescriber) {
        upsertMember(map, prescriber, 'Prescriber', 'Pharmacy', p.createdAt);
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const aDate = a.lastInteraction ?? '';
    const bDate = b.lastInteraction ?? '';
    return bDate.localeCompare(aDate);
  });
}

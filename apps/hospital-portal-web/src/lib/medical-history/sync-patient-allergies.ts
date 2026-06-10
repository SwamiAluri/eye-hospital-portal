import { patientAllergiesApi, type PatientAllergy } from '@/lib/api/patient-allergies.api';
import {
  allergiesToJsonSnapshot,
  type DisplayAllergy,
} from '@/lib/medical-history/allergy-utils';

/**
 * Persist allergy list to patientAllergiesApi (source of truth) and return JSON snapshot for patient record.
 */
export async function syncAllergiesToPatient(
  patientId: string,
  localAllergies: DisplayAllergy[],
  baselineIds: Set<string>,
): Promise<{ allergies: DisplayAllergy[]; jsonSnapshot: string }> {
  const active = localAllergies.filter((a) => a.status === 'active');
  const activeIds = new Set(active.map((a) => a.id));

  const toDelete = [...baselineIds].filter((id) => !activeIds.has(id) && !id.startsWith('new-') && !id.startsWith('json-'));

  for (const id of toDelete) {
    try {
      await patientAllergiesApi.delete(id);
    } catch {
      /* may already be removed */
    }
  }

  const persisted: DisplayAllergy[] = [];

  for (const item of active) {
    if (item.isNew || item.fromJsonOnly || item.id.startsWith('new-') || item.id.startsWith('json-')) {
      const res = await patientAllergiesApi.create({
        patientId,
        allergenName: item.allergenName,
        allergenType: item.allergenType,
        severity: item.severity,
        reaction: item.reaction,
        notes: item.notes,
        status: 'active',
        verified: false,
      });
      const created = res.data;
      persisted.push({
        id: created.id,
        allergenName: created.allergenName,
        allergenType: created.allergenType,
        severity: created.severity,
        reaction: created.reaction,
        notes: created.notes,
        status: created.status || 'active',
      });
    } else {
      const existing = await patientAllergiesApi.getById(item.id).catch(() => null);
      if (existing?.data) {
        await patientAllergiesApi.update(item.id, {
          allergenName: item.allergenName,
          allergenType: item.allergenType,
          severity: item.severity,
          reaction: item.reaction,
          notes: item.notes,
          status: item.status,
        });
      }
      persisted.push({ ...item, fromJsonOnly: false, isNew: false });
    }
  }

  let finalList = persisted;
  try {
    const res = await patientAllergiesApi.getByPatient(patientId);
    const apiRows = (res.data || []).filter(
      (a: PatientAllergy) => a.status !== 'inactive' && a.status !== 'resolved',
    );
    finalList = apiRows.map((row) => ({
      id: row.id,
      allergenName: row.allergenName,
      allergenType: row.allergenType,
      severity: row.severity,
      reaction: row.reaction,
      notes: row.notes,
      status: row.status || 'active',
    }));
  } catch {
    /* use persisted list */
  }

  const jsonSnapshot = allergiesToJsonSnapshot(finalList);
  return { allergies: finalList, jsonSnapshot };
}

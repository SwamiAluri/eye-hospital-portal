import { examinationDraftApi } from '@/lib/api/examinationDraft.api';

import type { OptometryExamDraftData } from './optometry-exam-types';



const localKey = (visitId: string) => `optometry-exam-draft:${visitId}`;



export function readLocalDraft(visitId: string): OptometryExamDraftData | null {

  if (typeof window === 'undefined' || !visitId) return null;

  try {

    const raw = localStorage.getItem(localKey(visitId));

    if (!raw) return null;

    return JSON.parse(raw) as OptometryExamDraftData;

  } catch {

    return null;

  }

}



export function writeLocalDraft(data: OptometryExamDraftData): void {

  if (typeof window === 'undefined' || !data.visitId) return;

  localStorage.setItem(localKey(data.visitId), JSON.stringify(data));

}



export function clearLocalDraft(visitId: string): void {

  if (typeof window === 'undefined' || !visitId) return;

  localStorage.removeItem(localKey(visitId));

}



/** Remove visit-scoped draft after exam complete (local + remote). */

export async function clearExamDraft(patientId: string, visitId: string): Promise<void> {

  clearLocalDraft(visitId);

  try {

    await examinationDraftApi.deleteDraft(patientId, visitId);

  } catch {

    // Best effort — segment rows are canonical after complete.

  }

}



export function parseDraftData(raw: unknown): OptometryExamDraftData | null {

  if (!raw) return null;

  if (typeof raw === 'string') {

    try {

      return JSON.parse(raw) as OptometryExamDraftData;

    } catch {

      return null;

    }

  }

  return raw as OptometryExamDraftData;

}



/** Remote draft for this visit — localStorage is the instant fallback. */

export async function fetchRemoteExamDraft(

  patientId: string,

  visitId: string,

): Promise<OptometryExamDraftData | null> {

  if (!patientId || !visitId) return null;



  const local = readLocalDraft(visitId);

  try {

    const remote = await examinationDraftApi.getDraft(patientId, visitId);

    if (!remote?.data) return local;

    const parsed = parseDraftData(remote.data);

    if (parsed && parsed.visitId !== visitId) {

      return local;

    }

    return parsed ?? local;

  } catch {

    return local;

  }

}



export async function loadExamDraft(

  patientId: string,

  visitId: string,

): Promise<OptometryExamDraftData | null> {

  return fetchRemoteExamDraft(patientId, visitId);

}



export async function persistExamDraft(

  patientId: string,

  doctorId: string,

  payload: OptometryExamDraftData,

): Promise<void> {

  if (!payload.visitId) {

    throw new Error('visitId is required to persist an optometry exam draft');

  }



  payload.savedAt = new Date().toISOString();

  writeLocalDraft(payload);



  const serialized = JSON.stringify(payload);



  try {

    await examinationDraftApi.saveDraft({

      patientId,

      doctorId,

      visitId: payload.visitId,

      data: serialized,

      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),

    });

  } catch (err) {

    throw err;

  }

}



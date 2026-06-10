'use client';

/**
 * @deprecated S0 — Replaced by CounsellorOutpatientChecklist + ip-management API.
 * Migration 66 pre-admission-checklist endpoints are deprecated.
 * Use ipManagementApi.getCounsellorOutpatientChecklist / saveCounsellorOutpatientCompletion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistTemplateItem {
  id?: string;
  itemKey: string;
  itemLabel: string;
  description?: string;
  departmentOwner?: string;
  departmentColor?: string;
  isMandatory: boolean;
  isBlocking: boolean;
  appliesIfAgeBelow?: number;
  requiresDocument: boolean;
  displayOrder: number;
}

export interface PatientTypeInstructions {
  docs: string[];
  financial: string;
  specialNote?: string;
}

export interface ChecklistTemplate {
  templateId: string | null;
  templateName: string;
  description?: string;
  items: ChecklistTemplateItem[];
  patientTypeInstructions: PatientTypeInstructions | null;
  isDefault: boolean;
}

export interface CompletionEntry {
  completionId: string;
  itemId: string;
  templateId: string;
  itemKey: string;
  itemLabel: string;
  departmentOwner?: string;
  departmentColor?: string;
  isMandatory: boolean;
  isBlocking: boolean;
  isComplete: boolean;
  completedAt?: string;
  completedByDept?: string;
  documentUrl?: string;
  notes?: string;
}

export interface ItemUpdateRequest {
  itemId: string;
  isComplete: boolean;
  notes?: string;
  completedByDept?: string;
  documentUrl?: string;
}

// ── Hook: fetch template ──────────────────────────────────────────────────────

export function usePreAdmissionChecklistTemplate(opts: {
  patientType?: string;
  surgeryType?: string;
  patientAge?: number;
}) {
  return useQuery<ChecklistTemplate>({
    queryKey: ['pre-admission-checklist-template', opts.patientType, opts.surgeryType, opts.patientAge],
    enabled: true,
    staleTime: 300_000, // templates change rarely
    queryFn: async () => {
      const api = getApi();
      const params = new URLSearchParams();
      if (opts.patientType) params.append('patientType', opts.patientType);
      if (opts.surgeryType) params.append('surgeryType', opts.surgeryType);
      if (opts.patientAge != null) params.append('patientAge', String(opts.patientAge));
      const res = await api.get(`/pre-admission-checklist/template?${params.toString()}`);
      return res.data;
    },
  });
}

// ── Hook: fetch completion status for a schedule ───────────────────────────────

export function usePreAdmissionCompletion(scheduleId: string | undefined) {
  return useQuery<{ scheduleId: string; completions: CompletionEntry[] }>({
    queryKey: ['pre-admission-completion', scheduleId],
    enabled: !!scheduleId,
    staleTime: 30_000,
    queryFn: async () => {
      const api = getApi();
      const res = await api.get(`/pre-admission-checklist/completion/${scheduleId}`);
      return res.data;
    },
  });
}

/** Bridge legacy pre_admission data via counselling session id (S8). */
export function usePreAdmissionCompletionBySession(sessionId: string | undefined) {
  return useQuery<{ scheduleId: string | null; completions: CompletionEntry[] }>({
    queryKey: ['pre-admission-completion-by-session', sessionId],
    enabled: !!sessionId,
    staleTime: 60_000,
    queryFn: async () => {
      const api = getApi();
      const res = await api.get(`/pre-admission-checklist/completion/by-session/${sessionId}`);
      return res.data;
    },
  });
}

// ── Hook: save completion updates ─────────────────────────────────────────────

export function useUpdatePreAdmissionCompletion(scheduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: ItemUpdateRequest[]) => {
      const api = getApi();
      const res = await api.patch(`/pre-admission-checklist/completion/${scheduleId}`, { updates });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-admission-completion', scheduleId] });
      qc.invalidateQueries({ queryKey: ['surgery-confirmed'] });
    },
  });
}

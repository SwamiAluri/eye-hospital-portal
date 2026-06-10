'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { patientAllergiesApi } from '@/lib/api/patient-allergies.api';
import {
  ALLERGEN_TYPES,
  ALLERGY_SEVERITY_OPTIONS,
  COMMON_ALLERGENS,
  isCriticalSeverity,
  isHighSeverity,
  mergeAllergies,
  parseJsonAllergies,
  severityToLabel,
  type DisplayAllergy,
} from '@/lib/medical-history/allergy-utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ResponsiveFormSheet } from '@/components/examination/medical-history/ResponsiveFormSheet';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ModalSelectContent,
} from '@/components/ui/select';
import {
  SelectWithOther,
  validateSelectWithOther,
} from '@/components/examination/medical-history/SelectWithOther';

interface MedicalHistoryAllergiesSectionProps {
  patientId: string;
  knownAllergiesDetails?: unknown;
  canEdit?: boolean;
  nkda: boolean;
  onNkdaChange: (nkda: boolean) => void;
  allergies: DisplayAllergy[];
  /** Initial API/JSON merge — does not mark the form dirty. */
  onAllergiesHydrated: (allergies: DisplayAllergy[]) => void;
  /** User edits (add / update / delete / NKDA clear). */
  onAllergiesChange: (allergies: DisplayAllergy[]) => void;
  onBaselineIdsReady: (ids: Set<string>) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** Collapse body when empty to reduce vertical whitespace (default true). */
  collapseWhenEmpty?: boolean;
}

type FormState = {
  allergenName: string;
  allergenType: string;
  severity: string;
  reaction: string;
  notes: string;
};

const emptyForm: FormState = {
  allergenName: '',
  allergenType: 'medication',
  severity: 'moderate',
  reaction: '',
  notes: '',
};

function severityBadgeClass(severity: string): string {
  if (isCriticalSeverity(severity)) return 'bg-red-100 text-red-900 border-red-300';
  if (isHighSeverity(severity)) return 'bg-orange-100 text-orange-900 border-orange-300';
  if (severity === 'moderate') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-blue-100 text-blue-900 border-blue-200';
}

export function MedicalHistoryAllergiesSection({
  patientId,
  knownAllergiesDetails,
  canEdit = true,
  nkda,
  onNkdaChange,
  allergies,
  onAllergiesHydrated,
  onAllergiesChange,
  onBaselineIdsReady,
  onLoadingChange,
  collapseWhenEmpty = true,
}: MedicalHistoryAllergiesSectionProps) {
  const [loading, setLoading] = useState(true);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const onAllergiesHydratedRef = useRef(onAllergiesHydrated);
  const onBaselineIdsReadyRef = useRef(onBaselineIdsReady);
  const onLoadingChangeRef = useRef(onLoadingChange);
  onAllergiesHydratedRef.current = onAllergiesHydrated;
  onBaselineIdsReadyRef.current = onBaselineIdsReady;
  onLoadingChangeRef.current = onLoadingChange;

  const loadAllergies = useCallback(async () => {
    setLoading(true);
    onLoadingChangeRef.current?.(true);
    try {
      let apiRows: Awaited<ReturnType<typeof patientAllergiesApi.getByPatient>>['data'] = [];
      try {
        const res = await patientAllergiesApi.getByPatient(patientId);
        apiRows = res.data || [];
      } catch {
        apiRows = [];
      }
      const jsonRows = parseJsonAllergies(knownAllergiesDetails);
      const merged = mergeAllergies(apiRows, jsonRows);
      onAllergiesHydratedRef.current(merged);
      onBaselineIdsReadyRef.current(new Set(apiRows.map((a) => a.id).filter(Boolean)));
    } catch {
      toast.error('Failed to load allergies');
    } finally {
      setLoading(false);
      onLoadingChangeRef.current?.(false);
    }
  }, [patientId, knownAllergiesDetails]);

  useEffect(() => {
    void loadAllergies();
  }, [loadAllergies]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: DisplayAllergy) => {
    setEditingId(item.id);
    setForm({
      allergenName: item.allergenName,
      allergenType: item.allergenType,
      severity: item.severity,
      reaction: item.reaction || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSaveForm = () => {
    const allergenErr = validateSelectWithOther(form.allergenName, 'allergen');
    if (allergenErr) {
      toast.error(allergenErr);
      return;
    }
    if (editingId) {
      onAllergiesChange(
        allergies.map((a) =>
          a.id === editingId
            ? {
                ...a,
                allergenName: form.allergenName.trim(),
                allergenType: form.allergenType,
                severity: form.severity,
                reaction: form.reaction.trim() || undefined,
                notes: form.notes.trim() || undefined,
              }
            : a,
        ),
      );
    } else {
      const newItem: DisplayAllergy = {
        id: `new-${Date.now()}`,
        allergenName: form.allergenName.trim(),
        allergenType: form.allergenType,
        severity: form.severity,
        reaction: form.reaction.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: 'active',
        isNew: true,
      };
      onAllergiesChange([...allergies, newItem]);
      if (nkda) onNkdaChange(false);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    onAllergiesChange(allergies.filter((a) => a.id !== id));
  };

  const criticalCount = allergies.filter((a) => isCriticalSeverity(a.severity)).length;
  const isEmpty = !loading && allergies.length === 0 && !nkda;

  useEffect(() => {
    if (allergies.length > 0 || nkda) setBodyOpen(true);
  }, [allergies.length, nkda]);

  const collapsed = collapseWhenEmpty && isEmpty && !bodyOpen;

  return (
    <section id="mh-section-allergies" className="scroll-mt-24 w-full bg-white border border-gray-200 rounded-xl overflow-hidden h-fit">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {collapseWhenEmpty && isEmpty && (
            <button
              type="button"
              onClick={() => setBodyOpen((o) => !o)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand allergies section' : 'Collapse allergies section'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900">Known Allergies</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {nkda && allergies.length === 0
                ? 'NKDA confirmed'
                : `${allergies.length} recorded`}
              {criticalCount > 0 ? ` · ${criticalCount} critical` : ''}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button type="button" size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={openAdd}>
            Add allergy
          </Button>
        )}
      </div>

      {!collapsed && criticalCount > 0 && (
        <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">Critical allergies on record</p>
            <p className="text-xs text-red-700 mt-0.5">
              Review before proceeding with medications or procedures.
            </p>
          </div>
        </div>
      )}

      {!collapsed && (
        <>
      {canEdit && (
        <div className="px-5 pt-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={nkda}
              onChange={(e) => {
                onNkdaChange(e.target.checked);
                if (e.target.checked) onAllergiesChange([]);
              }}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="font-medium">No known drug allergies (NKDA)</span>
          </label>
        </div>
      )}

      <div className="p-5 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-2 text-sm text-gray-600">Loading allergies…</span>
          </div>
        )}

        {!loading && nkda && allergies.length === 0 && (
          <div className="text-center py-6 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-medium text-emerald-800">No known drug allergies confirmed</p>
          </div>
        )}

        {!loading && !nkda && allergies.length === 0 && (
          <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">No allergies recorded</p>
          </div>
        )}

        {!loading &&
          allergies.map((allergy) => (
          <div
            key={allergy.id}
            className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
              isCriticalSeverity(allergy.severity)
                ? 'bg-red-50/50 border-red-200'
                : 'bg-gray-50 border-gray-200 hover:bg-white'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm text-gray-900">{allergy.allergenName}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${severityBadgeClass(allergy.severity)}`}
                >
                  {severityToLabel(allergy.severity)}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                  {allergy.allergenType}
                </span>
              </div>
              {allergy.reaction && (
                <p className="text-xs text-gray-600 mt-1">Reaction: {allergy.reaction}</p>
              )}
              {allergy.notes && <p className="text-xs text-gray-500 mt-0.5">{allergy.notes}</p>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(allergy)}
                  className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(allergy.id)}
                  className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
        </>
      )}

      <ResponsiveFormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit allergy' : 'Add allergy'}
        footer={
          <>
            <Button type="button" variant="secondary" className="min-h-[44px]" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" className="min-h-[44px]" onClick={handleSaveForm}>
              {editingId ? 'Update' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <SelectWithOther
            label="Allergen"
            required
            options={COMMON_ALLERGENS}
            value={form.allergenName}
            onChange={(v) => setForm((f) => ({ ...f, allergenName: v }))}
            customPlaceholder="Specify allergen"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={form.allergenType}
                onValueChange={(v) => setForm((f) => ({ ...f, allergenType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <ModalSelectContent>
                  {ALLERGEN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </ModalSelectContent>
              </Select>
            </div>
            <div>
              <Label required>Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <ModalSelectContent>
                  {ALLERGY_SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </ModalSelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reaction</Label>
            <Input
              value={form.reaction}
              onChange={(e) => setForm((f) => ({ ...f, reaction: e.target.value }))}
              placeholder="e.g. Rash, anaphylaxis"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
      </ResponsiveFormSheet>
    </section>
  );
}

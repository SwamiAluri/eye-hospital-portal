'use client';

import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PatientSearchAutosuggest } from '@/components/patients/lookup/PatientSearchAutosuggest';
import { useBranchContext } from '@/hooks/use-branch-context';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { labReportsApi, type LabReport } from '@/lib/api/lab-reports.api';
import {
  unifiedHitDisplayName,
  type UnifiedPatientSearchHit,
} from '@/lib/patients/unified-patient-search';
import {
  LAB_REPORT_PRIORITIES,
  LAB_REPORT_PRIORITY_LABELS,
} from '@/components/laboratory/laboratory-constants';
import {
  DoctorSearchAutosuggest,
  type LaboratoryOrderingClinician,
} from '@/components/laboratory/DoctorSearchAutosuggest';
import {
  LaboratoryCatalogPicker,
  type CatalogSelection,
} from '@/components/laboratory/LaboratoryCatalogPicker';
import { LaboratoryOrderSummaryPanel } from '@/components/laboratory/LaboratoryOrderSummaryPanel';
import { useHasAnyPermission } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export interface LaboratoryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (report: LabReport) => void;
}

function selectionKey(sel: CatalogSelection): string {
  return sel.kind === 'test' ? `test:${sel.test.id}` : `panel:${sel.panel.id}`;
}

function catalogMeta(sel: CatalogSelection): {
  name: string;
  code: string;
  category: string;
  specimen: string;
} {
  if (sel.kind === 'test') {
    const specimen =
      sel.test.specimenTypes.find((s) => s.isDefault)?.specimenType ??
      sel.test.specimenTypes[0]?.specimenType ??
      '—';
    return {
      name: sel.test.name,
      code: sel.test.localCode,
      category: sel.test.category ?? '—',
      specimen,
    };
  }
  return {
    name: sel.panel.name,
    code: sel.panel.localCode,
    category: sel.panel.category ?? '—',
    specimen: '—',
  };
}

export function LaboratoryOrderDialog({ open, onOpenChange, onCreated }: LaboratoryOrderDialogProps) {
  const { branchId } = useBranchContext();
  /** FIN-VIS-01: reuse existing Billing view permissions — never patient.update. */
  const canViewFinancialAmounts = useHasAnyPermission(['bill.view', 'opd_bill.view']);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<UnifiedPatientSearchHit | null>(null);
  const [selectedItems, setSelectedItems] = useState<CatalogSelection[]>([]);
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const [specimenType, setSpecimenType] = useState('');
  const [clinician, setClinician] = useState<LaboratoryOrderingClinician | null>(null);
  const [priority, setPriority] = useState('routine');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const excludeKeys = useMemo(() => selectedItems.map(selectionKey), [selectedItems]);

  const specimenOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of selectedItems) {
      if (item.kind === 'test') {
        for (const s of item.test.specimenTypes) set.add(s.specimenType);
      } else {
        for (const panelItem of item.panel.items) {
          for (const s of panelItem.test?.specimenTypes ?? []) set.add(s.specimenType);
        }
      }
    }
    return Array.from(set);
  }, [selectedItems]);

  const needsSpecimenChoice = useMemo(() => {
    if (selectedItems.length === 0) return false;
    if (selectedItems.length === 1) return specimenOptions.length > 1;
    return selectedItems.some((item) => {
      if (item.kind === 'test') return item.test.specimenTypes.length > 1;
      return item.panel.items.some((pi) => (pi.test?.specimenTypes?.length ?? 0) > 1);
    });
  }, [selectedItems, specimenOptions.length]);

  const reset = () => {
    setPatientQuery('');
    setSelectedPatient(null);
    setSelectedItems([]);
    setPickerResetKey((k) => k + 1);
    setSpecimenType('');
    setClinician(null);
    setPriority('routine');
    setClinicalIndication('');
    setNotes('');
    setFormError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery('');
  };

  const addCatalogItem = (next: CatalogSelection | null) => {
    if (!next) return;
    const key = selectionKey(next);
    if (excludeKeys.includes(key)) {
      setFormError('That test or panel is already selected.');
      setPickerResetKey((k) => k + 1);
      return;
    }
    setSelectedItems((prev) => [...prev, next]);
    setFormError(null);
    setPickerResetKey((k) => k + 1);

    if (next.kind === 'test' && next.test.specimenTypes.length === 1 && selectedItems.length === 0) {
      setSpecimenType(next.test.specimenTypes[0].specimenType);
    }
  };

  const removeCatalogItem = (key: string) => {
    setSelectedItems((prev) => prev.filter((item) => selectionKey(item) !== key));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedPatient) {
      setFormError('Select a patient before ordering.');
      return;
    }
    if (selectedItems.length === 0) {
      setFormError('Select at least one laboratory test or panel.');
      return;
    }
    if (needsSpecimenChoice && !specimenType) {
      setFormError('Select a valid specimen type for the selected catalog items.');
      return;
    }
    if (specimenType && specimenOptions.length > 0 && !specimenOptions.includes(specimenType)) {
      setFormError('Specimen type is not valid for the selected tests or panels.');
      return;
    }
    if (!clinician) {
      setFormError('Select an ordering clinician.');
      return;
    }
    if (!clinicalIndication.trim()) {
      setFormError('Clinical indication / reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await labReportsApi.createFromCatalog({
        patientId: selectedPatient.id,
        items: selectedItems.map((item) =>
          item.kind === 'test'
            ? { testDefinitionId: item.test.id }
            : { panelId: item.panel.id },
        ),
        specimenType: specimenType || undefined,
        orderedById: clinician.id,
        clinicalIndication: clinicalIndication.trim(),
        notes: notes.trim() || undefined,
        priority,
      });
      toast.success('Laboratory order created');
      handleOpenChange(false);
      onCreated(response.data);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err) || 'Could not create laboratory order.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="full"
        className={cn(
          // !flex defeats DialogContent default `grid` so the scroll body + sticky footer partition correctly
          '!flex max-h-[min(92vh,48rem)] w-[min(100vw-1rem,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0',
        )}
        data-testid="laboratory-order-dialog"
        data-layout="two-column-summary"
      >
        <DialogHeader className="shrink-0 border-b border-gray-100 px-5 py-3 pr-12 text-left">
          <DialogTitle>Order New Laboratory Tests</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          data-testid="laboratory-order-form"
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
            data-testid="laboratory-order-workspace"
          >
            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-6 pt-3 scroll-pb-6 lg:basis-[62%]"
              data-testid="laboratory-order-form-body"
            >
              <div className="space-y-1.5">
                <Label htmlFor="lab-order-patient">Patient</Label>
                {selectedPatient ? (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-1.5"
                    data-testid="laboratory-order-patient-selected"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-emerald-950">
                        {unifiedHitDisplayName(selectedPatient)}
                      </p>
                      <p
                        className="truncate text-xs text-emerald-800/80"
                        data-testid="laboratory-order-patient-context"
                      >
                        {selectedPatient.medicalRecordNumber
                          ? `MRN ${selectedPatient.medicalRecordNumber}`
                          : 'Selected patient'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={clearPatient}
                      disabled={submitting}
                      data-testid="laboratory-order-patient-clear"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <PatientSearchAutosuggest
                    value={patientQuery}
                    onChange={setPatientQuery}
                    branchId={branchId}
                    onSelectPatient={(hit) => {
                      setSelectedPatient(hit);
                      setPatientQuery(unifiedHitDisplayName(hit));
                    }}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Ordering clinician</Label>
                {clinician ? (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-1.5"
                    data-testid="laboratory-order-clinician-selected"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-emerald-950">{clinician.fullName}</p>
                      <p className="truncate text-xs text-emerald-800/80">
                        {[clinician.specialization, clinician.department].filter(Boolean).join(' · ') ||
                          'Ordering clinician'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={() => setClinician(null)}
                      disabled={submitting}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <DoctorSearchAutosuggest value={clinician} onSelect={setClinician} disabled={submitting} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lab-order-priority">Priority</Label>
                <select
                  id="lab-order-priority"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  data-testid="laboratory-order-priority"
                >
                  {LAB_REPORT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {LAB_REPORT_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>Tests / Panels</Label>
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid="laboratory-order-selected-count"
                    aria-live="polite"
                  >
                    {selectedItems.length} selected
                  </span>
                </div>
                <LaboratoryCatalogPicker
                  key={pickerResetKey}
                  value={null}
                  onChange={addCatalogItem}
                  disabled={submitting}
                  excludeKeys={excludeKeys}
                  loadOnOpen
                />

                {selectedItems.length > 0 && (
                  <div
                    className="max-h-[min(14rem,30vh)] overflow-y-auto overscroll-contain rounded-md border border-gray-200"
                    data-testid="laboratory-order-selected-items"
                    tabIndex={0}
                    role="region"
                    aria-label="Selected laboratory tests"
                  >
                    <table className="w-full caption-bottom text-sm" role="table">
                      <TableHeader sticky className="bg-gray-50 text-xs">
                        <TableRow className="hover:bg-gray-50">
                          <TableHead className="h-8 px-2 font-semibold">Test</TableHead>
                          <TableHead className="h-8 px-2 font-semibold">Code</TableHead>
                          <TableHead className="hidden h-8 px-2 font-semibold sm:table-cell">
                            Category
                          </TableHead>
                          <TableHead className="h-8 px-2 font-semibold">Specimen</TableHead>
                          <TableHead className="h-8 w-10 px-1 text-right font-semibold">
                            <span className="sr-only">Remove</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item) => {
                          const key = selectionKey(item);
                          const meta = catalogMeta(item);
                          const panelHint =
                            item.kind === 'panel' && item.panel.items.length > 0
                              ? `Includes: ${item.panel.items
                                  .map((i) => i.test?.name ?? i.testDefinitionId)
                                  .join(', ')}`
                              : undefined;
                          return (
                            <TableRow
                              key={key}
                              className="hover:bg-slate-50"
                              data-testid={`laboratory-order-selected-${key}`}
                            >
                              <TableCell className="max-w-[10rem] px-2 py-1.5 align-top">
                                <div className="truncate font-medium text-gray-900" title={meta.name}>
                                  {meta.name}
                                </div>
                                {panelHint && (
                                  <div
                                    className="truncate text-[11px] text-muted-foreground"
                                    title={panelHint}
                                    data-testid="laboratory-order-panel-members"
                                  >
                                    {panelHint}
                                  </div>
                                )}
                                <div className="truncate text-[11px] text-muted-foreground sm:hidden">
                                  <span data-testid="laboratory-order-derived-category">{meta.category}</span>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap px-2 py-1.5 align-top text-muted-foreground">
                                <span data-testid="laboratory-order-derived-code">{meta.code}</span>
                              </TableCell>
                              <TableCell className="hidden max-w-[7rem] truncate px-2 py-1.5 align-top text-muted-foreground sm:table-cell">
                                <span data-testid="laboratory-order-derived-category">{meta.category}</span>
                              </TableCell>
                              <TableCell className="max-w-[7rem] truncate px-2 py-1.5 align-top text-muted-foreground">
                                {meta.specimen}
                              </TableCell>
                              <TableCell className="px-1 py-1 align-top text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeCatalogItem(key)}
                                  disabled={submitting}
                                  aria-label={`Remove ${meta.name} from order`}
                                  data-testid={`laboratory-order-remove-${key}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </table>
                  </div>
                )}
              </div>

              {needsSpecimenChoice && (
                <div className="space-y-1.5">
                  <Label htmlFor="lab-order-specimen">Specimen</Label>
                  <select
                    id="lab-order-specimen"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={specimenType}
                    onChange={(e) => setSpecimenType(e.target.value)}
                    data-testid="laboratory-order-specimen"
                    required
                  >
                    <option value="">Select specimen…</option>
                    {specimenOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="lab-order-indication">Clinical indication / reason</Label>
                <Textarea
                  id="lab-order-indication"
                  value={clinicalIndication}
                  onChange={(e) => setClinicalIndication(e.target.value)}
                  rows={2}
                  required
                  placeholder="Enter clinical indication or reason"
                  className="min-h-[2.5rem] resize-y"
                  data-testid="laboratory-order-indication"
                />
              </div>

              <div className="space-y-1.5" data-testid="laboratory-order-notes-field">
                <Label htmlFor="lab-order-notes">Additional notes</Label>
                <Input
                  id="lab-order-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  data-testid="laboratory-order-notes"
                />
              </div>

              {formError && (
                <p className="text-sm text-destructive" data-testid="laboratory-order-error" role="alert">
                  {formError}
                </p>
              )}
            </div>

            <LaboratoryOrderSummaryPanel
              className="max-h-[min(40vh,18rem)] shrink-0 lg:max-h-none lg:basis-[38%]"
              selectedItems={selectedItems}
              patientLabel={selectedPatient ? unifiedHitDisplayName(selectedPatient) : null}
              patientMrn={selectedPatient?.medicalRecordNumber ?? null}
              canViewFinancialAmounts={canViewFinancialAmounts}
            />
          </div>

          <DialogFooter className="relative z-10 shrink-0 border-t border-gray-100 bg-white px-5 py-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} data-testid="laboratory-order-submit">
              {submitting ? 'Creating…' : 'Create order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

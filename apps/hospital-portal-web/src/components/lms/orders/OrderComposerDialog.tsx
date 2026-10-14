'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PatientSearchAutosuggest } from '@/components/patients/lookup/PatientSearchAutosuggest';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePatientRecentVisitsQuery } from '@/hooks/use-patient-lookup-queries';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  amendLmsOrder,
  createLmsOrderDraft,
  LMS_ORDER_PRIORITIES,
  LMS_ORDER_SOURCES,
  newLmsIdempotencyKey,
  parseLmsOrderApiError,
  priorityRequiresReason,
  submitLmsOrder,
  updateLmsOrderDraft,
  validateOrderComposerClient,
  type LmsOrderDetailDto,
} from '@/lib/lms/lms-orders.api';
import { unifiedHitDisplayName, type UnifiedPatientSearchHit } from '@/lib/patients/unified-patient-search';
import { OrderablesPicker, toSelectionInputs, type SelectedOrderable } from './OrderablesPicker';
import { OrderProviderPicker } from './OrderProviderPicker';

export type ComposerMode = 'create' | 'edit' | 'amend';

type Props = {
  open: boolean;
  mode: ComposerMode;
  order?: LmsOrderDetailDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (detail: LmsOrderDetailDto) => void;
};

type FormState = {
  patientId: string | null;
  patientLabel: string;
  patientQuery: string;
  visitId: string | null;
  orderingProviderUserId: string | null;
  orderingProviderLabel: string;
  responsibleClinicianUserId: string | null;
  responsibleClinicianLabel: string;
  orderSource: string;
  priority: string;
  priorityReason: string;
  clinicalIndication: string;
  notes: string;
  acknowledgementEvidence: string;
  selections: SelectedOrderable[];
  amendmentReason: string;
};

const emptyForm = (): FormState => ({
  patientId: null,
  patientLabel: '',
  patientQuery: '',
  visitId: null,
  orderingProviderUserId: null,
  orderingProviderLabel: '',
  responsibleClinicianUserId: null,
  responsibleClinicianLabel: '',
  orderSource: 'Clinician',
  priority: 'Routine',
  priorityReason: '',
  clinicalIndication: '',
  notes: '',
  acknowledgementEvidence: '',
  selections: [],
  amendmentReason: '',
});

function formFromOrder(order: LmsOrderDetailDto): FormState {
  const v = order.currentVersion;
  return {
    patientId: v?.patientId ?? null,
    patientLabel: v?.patientNameSnapshot || v?.patientMrnSnapshot || v?.patientId || '',
    patientQuery: '',
    visitId: v?.visitId ?? null,
    orderingProviderUserId: v?.orderingProviderUserId ?? null,
    orderingProviderLabel: v?.orderingProviderNameSnapshot || '',
    responsibleClinicianUserId: v?.responsibleClinicianUserId ?? null,
    responsibleClinicianLabel: v?.responsibleClinicianNameSnapshot || '',
    orderSource: v?.orderSource || 'Clinician',
    priority: v?.priority || 'Routine',
    priorityReason: v?.priorityReason || '',
    clinicalIndication: v?.clinicalIndication || '',
    notes: v?.notes || '',
    acknowledgementEvidence: v?.acknowledgementEvidence || '',
    selections: (v?.selections ?? []).map((s) => ({
      catalogueItemId: s.catalogueItemId,
      displayName: s.displayNameSnapshot || s.catalogueItemId,
      internalOrderCode: s.internalOrderCodeSnapshot || '',
      catalogueType: s.catalogueType,
    })),
    amendmentReason: '',
  };
}

export function OrderComposerDialog({ open, mode, order, onOpenChange, onSaved }: Props) {
  const { branchId, branchName, isReady } = useBranchContext();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [concurrencyHint, setConcurrencyHint] = useState(false);
  const createIdemRef = useRef<string | null>(null);
  const submitIdemRef = useRef<string | null>(null);
  const amendIdemRef = useRef<string | null>(null);

  const visitsQuery = usePatientRecentVisitsQuery(form.patientId, branchId);

  useEffect(() => {
    if (!open) return;
    setClientError(null);
    setServerError(null);
    setConcurrencyHint(false);
    createIdemRef.current = null;
    submitIdemRef.current = null;
    amendIdemRef.current = null;
    if ((mode === 'edit' || mode === 'amend') && order) {
      setForm(formFromOrder(order));
    } else {
      setForm(emptyForm());
    }
  }, [open, mode, order]);

  const title = useMemo(() => {
    if (mode === 'amend') return 'Amend order';
    if (mode === 'edit') return `Edit draft ${order?.orderNumber ?? ''}`.trim();
    return 'New laboratory order';
  }, [mode, order?.orderNumber]);

  const operatingBranchId = mode === 'create' ? branchId : order?.operatingBranchId || branchId;

  const buildPayloadCore = () => ({
    patientId: form.patientId!,
    visitId: form.visitId || null,
    orderingProviderUserId: form.orderingProviderUserId!,
    responsibleClinicianUserId: form.responsibleClinicianUserId!,
    operatingBranchId: operatingBranchId!,
    orderSource: form.orderSource,
    priority: form.priority,
    priorityReason: priorityRequiresReason(form.priority) ? form.priorityReason.trim() : null,
    clinicalIndication: form.clinicalIndication.trim(),
    notes: form.notes.trim() || null,
    selections: toSelectionInputs(form.selections),
    acknowledgementEvidence:
      form.orderSource === 'SelfRequested' ? form.acknowledgementEvidence.trim() : null,
  });

  const runMutation = async (alsoSubmit: boolean) => {
    setClientError(null);
    setServerError(null);
    setConcurrencyHint(false);

    const validation = validateOrderComposerClient({
      ...form,
      operatingBranchId,
    });
    if (validation) {
      setClientError(validation);
      return;
    }
    if (mode === 'amend' && !form.amendmentReason.trim()) {
      setClientError('Amendment reason is required.');
      return;
    }
    if (!operatingBranchId) {
      setClientError('Operating branch is required. Select a branch in the context strip.');
      return;
    }

    setSubmitting(true);
    try {
      let detail: LmsOrderDetailDto;
      const core = buildPayloadCore();

      if (mode === 'create') {
        if (!createIdemRef.current) createIdemRef.current = newLmsIdempotencyKey();
        detail = await createLmsOrderDraft({
          ...core,
          idempotencyKey: createIdemRef.current,
        });
        if (alsoSubmit) {
          if (!submitIdemRef.current) submitIdemRef.current = newLmsIdempotencyKey();
          detail = await submitLmsOrder(detail.id, detail.rowVersion, submitIdemRef.current);
          toast.success(`Order ${detail.orderNumber} submitted`);
        } else {
          toast.success(`Draft ${detail.orderNumber} saved`);
        }
      } else if (mode === 'edit' && order) {
        detail = await updateLmsOrderDraft(order.id, {
          expectedRowVersion: order.rowVersion,
          ...core,
        });
        if (alsoSubmit) {
          if (!submitIdemRef.current) submitIdemRef.current = newLmsIdempotencyKey();
          detail = await submitLmsOrder(detail.id, detail.rowVersion, submitIdemRef.current);
          toast.success(`Order ${detail.orderNumber} submitted`);
        } else {
          toast.success('Draft updated');
        }
      } else if (mode === 'amend' && order) {
        if (!amendIdemRef.current) amendIdemRef.current = newLmsIdempotencyKey();
        detail = await amendLmsOrder(order.id, {
          expectedRowVersion: order.rowVersion,
          amendmentReason: form.amendmentReason.trim(),
          idempotencyKey: amendIdemRef.current,
          ...core,
        });
        toast.success(`Order amended (v${detail.currentVersionNumber})`);
      } else {
        throw new Error('Invalid composer mode');
      }

      onSaved(detail);
      onOpenChange(false);
    } catch (e) {
      const err = parseLmsOrderApiError(e);
      setServerError(err.message);
      if (err.isConcurrencyConflict) setConcurrencyHint(true);
      if (err.isAuditUnavailable) {
        toast.error('Order change was not completed — platform audit unavailable.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSelectPatient = (hit: UnifiedPatientSearchHit) => {
    setForm((f) => ({
      ...f,
      patientId: hit.id,
      patientLabel: `${unifiedHitDisplayName(hit)} · ${hit.mrn}`,
      patientQuery: '',
      visitId: null,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
        data-testid="order-composer-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3" aria-labelledby="sec-patient">
            <h3 id="sec-patient" className="text-sm font-semibold">
              1. Patient & encounter
            </h3>
            {form.patientId ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span data-testid="composer-patient-label">{form.patientLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting || mode === 'amend'}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      patientId: null,
                      patientLabel: '',
                      visitId: null,
                    }))
                  }
                >
                  Change
                </Button>
              </div>
            ) : (
              <PatientSearchAutosuggest
                branchId={branchId}
                value={form.patientQuery}
                onChange={(v) => setForm((f) => ({ ...f, patientQuery: v }))}
                onSelectPatient={onSelectPatient}
              />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="visit-select">Visit (optional)</Label>
              <Select
                value={form.visitId ?? 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, visitId: v === 'none' ? null : v }))}
                disabled={!form.patientId || submitting}
              >
                <SelectTrigger id="visit-select" data-testid="composer-visit">
                  <SelectValue placeholder="No visit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No visit</SelectItem>
                  {(visitsQuery.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.visitType || 'Visit'} · {v.status}
                      {v.checkedInAt
                        ? ` · ${new Date(v.checkedInAt).toLocaleString()}`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Do not invent a visit. Leave empty when no applicable encounter exists.
              </p>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="sec-ordering">
            <h3 id="sec-ordering" className="text-sm font-semibold">
              2. Ordering context
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <OrderProviderPicker
                id="ordering-provider"
                label="Ordering provider"
                required
                value={form.orderingProviderUserId}
                displayValue={form.orderingProviderLabel}
                disabled={submitting}
                onChange={(id, name) =>
                  setForm((f) => ({
                    ...f,
                    orderingProviderUserId: id || null,
                    orderingProviderLabel: name,
                  }))
                }
              />
              <OrderProviderPicker
                id="responsible-clinician"
                label="Responsible clinician"
                required
                value={form.responsibleClinicianUserId}
                displayValue={form.responsibleClinicianLabel}
                disabled={submitting}
                onChange={(id, name) =>
                  setForm((f) => ({
                    ...f,
                    responsibleClinicianUserId: id || null,
                    responsibleClinicianLabel: name,
                  }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Operating branch</Label>
                <Input
                  readOnly
                  value={
                    isReady
                      ? branchName || operatingBranchId || '—'
                      : 'Loading branch…'
                  }
                  data-testid="composer-operating-branch"
                />
                <p className="text-xs text-muted-foreground">
                  Performing site equals operating branch for this slice.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-source">
                  Source <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.orderSource}
                  onValueChange={(v) => setForm((f) => ({ ...f, orderSource: v }))}
                  disabled={submitting}
                >
                  <SelectTrigger id="order-source" data-testid="composer-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LMS_ORDER_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.orderSource === 'SelfRequested' ? (
              <div className="space-y-1.5">
                <Label htmlFor="ack-evidence">
                  Acknowledgement evidence <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ack-evidence"
                  data-testid="composer-ack"
                  value={form.acknowledgementEvidence}
                  disabled={submitting}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, acknowledgementEvidence: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3" aria-labelledby="sec-clinical">
            <h3 id="sec-clinical" className="text-sm font-semibold">
              3. Clinical request
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="priority">
                  Priority <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  disabled={submitting}
                >
                  <SelectTrigger id="priority" data-testid="composer-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LMS_ORDER_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {priorityRequiresReason(form.priority) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="priority-reason">
                    Priority reason <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="priority-reason"
                    data-testid="composer-priority-reason"
                    value={form.priorityReason}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, priorityReason: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="indication">
                Clinical indication <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="indication"
                data-testid="composer-indication"
                value={form.clinicalIndication}
                disabled={submitting}
                onChange={(e) => setForm((f) => ({ ...f, clinicalIndication: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                disabled={submitting}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            {mode === 'amend' ? (
              <div className="space-y-1.5">
                <Label htmlFor="amend-reason">
                  Amendment reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="amend-reason"
                  data-testid="composer-amend-reason"
                  value={form.amendmentReason}
                  disabled={submitting}
                  onChange={(e) => setForm((f) => ({ ...f, amendmentReason: e.target.value }))}
                  rows={2}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3" aria-labelledby="sec-tests">
            <h3 id="sec-tests" className="text-sm font-semibold">
              4. Tests / panels
            </h3>
            <OrderablesPicker
              operatingBranchId={operatingBranchId}
              selected={form.selections}
              disabled={submitting}
              onChange={(selections) => setForm((f) => ({ ...f, selections }))}
            />
          </section>

          {(clientError || serverError) && (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="composer-error"
            >
              {clientError || serverError}
              {concurrencyHint ? (
                <p className="mt-1 text-xs">
                  This order was changed by another action. Close and refresh the order before
                  retrying.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === 'amend' ? (
            <Button
              type="button"
              disabled={submitting}
              data-testid="composer-amend-submit"
              onClick={() => void runMutation(false)}
            >
              {submitting ? 'Saving…' : 'Submit amendment'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                data-testid="composer-save-draft"
                onClick={() => void runMutation(false)}
              >
                {submitting ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                type="button"
                disabled={submitting}
                data-testid="composer-save-submit"
                onClick={() => void runMutation(true)}
              >
                {submitting ? 'Submitting…' : 'Save & submit'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

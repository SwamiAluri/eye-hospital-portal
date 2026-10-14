'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
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
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  laboratoryCatalogApi,
  type LaboratoryCommercialState,
  type LaboratoryServiceVariantOptionDto,
  type LaboratoryTestDefinitionDto,
} from '@/lib/api/laboratory-catalog.api';
import { LAB_REPORT_CATEGORIES } from '@/components/laboratory/laboratory-constants';

export interface LaboratoryCatalogAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const COMMERCIAL_BADGE: Record<LaboratoryCommercialState, string> = {
  MAPPED: 'bg-emerald-100 text-emerald-800',
  UNMAPPED: 'bg-amber-100 text-amber-900',
  NON_BILLABLE: 'bg-slate-200 text-slate-800',
  UNPRICED: 'bg-orange-100 text-orange-900',
};

/** Catalog administration: create tests + L3-COM-01 commercial mapping (no charge posting). */
export function LaboratoryCatalogAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: LaboratoryCatalogAdminDialogProps) {
  const [tab, setTab] = useState<'mapping' | 'create'>('mapping');

  const [name, setName] = useState('');
  const [localCode, setLocalCode] = useState('');
  const [category, setCategory] = useState('hematology');
  const [specimenTypes, setSpecimenTypes] = useState('Blood');
  const [method, setMethod] = useState('');
  const [turnaroundHours, setTurnaroundHours] = useState('');
  const [analyteName, setAnalyteName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [tests, setTests] = useState<LaboratoryTestDefinitionDto[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [variantSearch, setVariantSearch] = useState('');
  const [variants, setVariants] = useState<LaboratoryServiceVariantOptionDto[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [mutating, setMutating] = useState(false);

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  const resetCreate = () => {
    setName('');
    setLocalCode('');
    setCategory('hematology');
    setSpecimenTypes('Blood');
    setMethod('');
    setTurnaroundHours('');
    setAnalyteName('');
    setError(null);
    setSubmitting(false);
  };

  const loadTests = useCallback(async () => {
    setTestsLoading(true);
    setTestsError(null);
    try {
      const res = await laboratoryCatalogApi.searchTests({
        search: catalogSearch.trim() || undefined,
        activeOnly: false,
        take: 50,
      });
      setTests(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      setTests([]);
      setTestsError(getApiErrorMessage(err) || 'Unable to load catalog tests.');
    } finally {
      setTestsLoading(false);
    }
  }, [catalogSearch]);

  const loadVariants = useCallback(async () => {
    try {
      const res = await laboratoryCatalogApi.searchServiceVariants({
        search: variantSearch.trim() || undefined,
        take: 30,
      });
      setVariants(Array.isArray(res.data) ? res.data : []);
    } catch {
      setVariants([]);
    }
  }, [variantSearch]);

  useEffect(() => {
    if (!open || tab !== 'mapping') return;
    void loadTests();
  }, [open, tab, loadTests]);

  useEffect(() => {
    if (!open || tab !== 'mapping') return;
    const handle = window.setTimeout(() => void loadVariants(), 250);
    return () => window.clearTimeout(handle);
  }, [open, tab, loadVariants]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetCreate();
      setTab('mapping');
      setCatalogSearch('');
      setSelectedId(null);
      setVariantSearch('');
      setSelectedVariantId('');
      setTestsError(null);
    }
    onOpenChange(next);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const specimens = specimenTypes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || !localCode.trim()) {
      setError('Name and local code are required.');
      return;
    }
    if (specimens.length === 0) {
      setError('At least one specimen type is required.');
      return;
    }

    setSubmitting(true);
    try {
      await laboratoryCatalogApi.createTest({
        name: name.trim(),
        localCode: localCode.trim(),
        category: category || undefined,
        method: method.trim() || undefined,
        turnaroundHours: turnaroundHours ? Number(turnaroundHours) : undefined,
        specimenTypes: specimens,
        analytes: analyteName.trim()
          ? [{ name: analyteName.trim(), valueType: 'numeric' }]
          : undefined,
      });
      toast.success('Laboratory test definition created');
      resetCreate();
      setTab('mapping');
      onCreated?.();
      void loadTests();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err) || 'Could not create catalog test.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const refreshSelected = async (testId: string) => {
    await loadTests();
    setSelectedId(testId);
  };

  const handleMap = async () => {
    if (!selected) return;
    if (!selectedVariantId) {
      toast.error('Select an active ServiceVariant before mapping.');
      return;
    }
    if (selected.isNonBillable || selected.commercialState === 'NON_BILLABLE') {
      toast.error('Clear non-billable before mapping a ServiceVariant.');
      return;
    }
    setMutating(true);
    try {
      const res = await laboratoryCatalogApi.mapServiceVariant(selected.id, selectedVariantId);
      toast.success(`Mapped — ${res.data.commercialState}`);
      await refreshSelected(selected.id);
      setSelectedVariantId('');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err) || 'Mapping failed.');
    } finally {
      setMutating(false);
    }
  };

  const handleUnmap = async () => {
    if (!selected) return;
    setMutating(true);
    try {
      const res = await laboratoryCatalogApi.unmapServiceVariant(selected.id);
      toast.success(`Unmapped — ${res.data.commercialState}`);
      await refreshSelected(selected.id);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err) || 'Unmap failed.');
    } finally {
      setMutating(false);
    }
  };

  const handleSetNonBillable = async (isNonBillable: boolean) => {
    if (!selected) return;
    if (isNonBillable && selected.serviceVariantId) {
      toast.error('Unmap the ServiceVariant before marking non-billable.');
      return;
    }
    setMutating(true);
    try {
      const res = await laboratoryCatalogApi.setNonBillable(selected.id, isNonBillable);
      toast.success(res.data.commercialState);
      await refreshSelected(selected.id);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err) || 'Could not update non-billable state.');
    } finally {
      setMutating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="4xl"
        className="max-h-[90vh] overflow-y-auto"
        data-testid="laboratory-catalog-admin-dialog"
      >
        <DialogHeader>
          <DialogTitle>Laboratory catalog administration</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex gap-2" role="tablist" aria-label="Catalog admin sections">
          <Button
            type="button"
            size="sm"
            variant={tab === 'mapping' ? 'default' : 'outline'}
            onClick={() => setTab('mapping')}
            data-testid="laboratory-catalog-tab-mapping"
          >
            Commercial mapping
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'create' ? 'default' : 'outline'}
            onClick={() => setTab('create')}
            data-testid="laboratory-catalog-tab-create"
          >
            Add catalog test
          </Button>
        </div>

        {tab === 'mapping' ? (
          <div className="space-y-3" data-testid="laboratory-catalog-commercial-panel">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1 space-y-1.5">
                <Label htmlFor="lab-cat-search">Search tests</Label>
                <Input
                  id="lab-cat-search"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Name or code"
                  data-testid="laboratory-catalog-commercial-search"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadTests()}
                disabled={testsLoading}
              >
                Search
              </Button>
            </div>

            {testsError ? (
              <p className="text-sm text-destructive" role="alert">
                {testsError}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table
                className="min-w-full text-left text-sm"
                data-testid="laboratory-catalog-commercial-table"
              >
                <caption className="sr-only">Laboratory test commercial mapping</caption>
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Test</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Commercial</th>
                    <th className="px-3 py-2 font-medium">ServiceVariant</th>
                  </tr>
                </thead>
                <tbody>
                  {testsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-slate-500">
                        Loading catalog…
                      </td>
                    </tr>
                  ) : tests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-slate-500"
                        data-testid="laboratory-catalog-commercial-empty"
                      >
                        No catalog tests found.
                      </td>
                    </tr>
                  ) : (
                    tests.map((row) => {
                      const state = (row.commercialState ?? 'UNMAPPED') as LaboratoryCommercialState;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                            selectedId === row.id ? 'bg-primary-50/60' : ''
                          }`}
                          onClick={() => setSelectedId(row.id)}
                          data-testid="laboratory-catalog-commercial-row"
                          data-commercial-state={state}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                          <td className="px-3 py-2 text-slate-700">{row.localCode}</td>
                          <td className="px-3 py-2 text-slate-700">{row.category || '—'}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COMMERCIAL_BADGE[state]}`}
                              data-testid="laboratory-commercial-state"
                            >
                              {state}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.serviceVariantName || row.serviceVariantCode || row.serviceVariantId || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selected ? (
              <div
                className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3"
                data-testid="laboratory-catalog-commercial-detail"
              >
                <div>
                  <div className="font-medium text-gray-900">{selected.name}</div>
                  <div className="text-xs text-slate-600">
                    {selected.localCode}
                    {selected.category ? ` · ${selected.category}` : ''}
                    {' · '}
                    Clinical identity (LaboratoryTestDefinition)
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        COMMERCIAL_BADGE[
                          (selected.commercialState ?? 'UNMAPPED') as LaboratoryCommercialState
                        ]
                      }`}
                      data-testid="laboratory-commercial-state-detail"
                    >
                      {selected.commercialState ?? 'UNMAPPED'}
                    </span>
                    {selected.serviceVariantName || selected.serviceVariantCode ? (
                      <span
                        className="ml-2 text-xs text-slate-700"
                        data-testid="laboratory-commercial-variant"
                      >
                        {selected.serviceVariantName}
                        {selected.serviceVariantCode ? ` (${selected.serviceVariantCode})` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lab-sv-search">ServiceVariant</Label>
                    <Input
                      id="lab-sv-search"
                      value={variantSearch}
                      onChange={(e) => setVariantSearch(e.target.value)}
                      placeholder="Search variant name or code"
                      data-testid="laboratory-service-variant-search"
                      disabled={
                        mutating ||
                        selected.isNonBillable ||
                        selected.commercialState === 'NON_BILLABLE'
                      }
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      data-testid="laboratory-service-variant-select"
                      disabled={
                        mutating ||
                        selected.isNonBillable ||
                        selected.commercialState === 'NON_BILLABLE'
                      }
                      aria-label="Select ServiceVariant"
                    >
                      <option value="">Select ServiceVariant…</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.code ? ` (${v.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleMap()}
                      disabled={mutating || !selectedVariantId}
                      data-testid="laboratory-commercial-map"
                    >
                      Map
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleUnmap()}
                      disabled={mutating || !selected.serviceVariantId}
                      data-testid="laboratory-commercial-unmap"
                    >
                      Unmap
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSetNonBillable(true)}
                      disabled={
                        mutating ||
                        !!selected.serviceVariantId ||
                        selected.commercialState === 'NON_BILLABLE'
                      }
                      data-testid="laboratory-commercial-nonbillable"
                    >
                      Mark non-billable
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleSetNonBillable(false)}
                      disabled={mutating || selected.commercialState !== 'NON_BILLABLE'}
                      data-testid="laboratory-commercial-clear-nonbillable"
                    >
                      Clear non-billable
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Commercial state uses Billing price resolution (MAPPED / UNPRICED). Amounts are not
                  shown here. Mapping does not create bills or charges.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Select a test to map, unmap, or mark non-billable.</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lab-cat-name">Name</Label>
              <Input
                id="lab-cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="laboratory-catalog-admin-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-cat-code">Local code</Label>
              <Input
                id="lab-cat-code"
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value)}
                required
                data-testid="laboratory-catalog-admin-code"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-cat-category">Category</Label>
              <select
                id="lab-cat-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="laboratory-catalog-admin-category"
              >
                {LAB_REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-cat-specimen">Specimen types (comma-separated)</Label>
              <Input
                id="lab-cat-specimen"
                value={specimenTypes}
                onChange={(e) => setSpecimenTypes(e.target.value)}
                placeholder="Blood, Urine"
                required
                data-testid="laboratory-catalog-admin-specimen"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lab-cat-method">Method</Label>
                <Input id="lab-cat-method" value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lab-cat-tat">TAT (hours)</Label>
                <Input
                  id="lab-cat-tat"
                  type="number"
                  min={1}
                  value={turnaroundHours}
                  onChange={(e) => setTurnaroundHours(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lab-cat-analyte">Primary analyte (optional)</Label>
              <Input
                id="lab-cat-analyte"
                value={analyteName}
                onChange={(e) => setAnalyteName(e.target.value)}
                placeholder="e.g. Hemoglobin"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} data-testid="laboratory-catalog-admin-submit">
                {submitting ? 'Saving…' : 'Save test'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

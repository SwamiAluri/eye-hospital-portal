'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  serviceCatalogAdminApi,
  type CatalogServiceDto,
  type ServiceCategoryDto,
  type ServiceVariantDto,
} from '@/lib/api/service-catalog.api';

export type CatalogDialogState =
  | { kind: 'closed' }
  | { kind: 'category'; mode: 'create' | 'edit'; category?: ServiceCategoryDto }
  | {
      kind: 'service';
      mode: 'create' | 'edit';
      categoryId: string;
      categoryName?: string;
      service?: CatalogServiceDto;
    }
  | {
      kind: 'variant';
      mode: 'create' | 'edit';
      serviceId: string;
      serviceName?: string;
      variant?: ServiceVariantDto;
    };

type PriceType = ServiceVariantDto['priceType'];

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
  return axiosErr?.response?.data?.error ?? axiosErr?.response?.data?.message ?? 'Save failed';
}

export function ServiceCatalogAdminDialog({
  state,
  onClose,
  onSaved,
}: {
  state: CatalogDialogState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = state.kind !== 'closed';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Category fields
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catOrder, setCatOrder] = useState(0);
  const [catActive, setCatActive] = useState(true);

  // Service fields
  const [svcName, setSvcName] = useState('');
  const [svcCode, setSvcCode] = useState('');
  const [svcOrder, setSvcOrder] = useState(0);
  const [svcActive, setSvcActive] = useState(true);

  // Variant fields
  const [varName, setVarName] = useState('');
  const [varCode, setVarCode] = useState('');
  const [varPrice, setVarPrice] = useState('');
  const [varPriceType, setVarPriceType] = useState<PriceType>('FIXED');
  const [varIol, setVarIol] = useState(false);
  const [varOrder, setVarOrder] = useState(0);
  const [varActive, setVarActive] = useState(true);

  useEffect(() => {
    if (state.kind === 'closed') return;
    setError('');
    setSaving(false);

    if (state.kind === 'category') {
      const c = state.category;
      setCatCode(c?.code ?? '');
      setCatName(c?.name ?? '');
      setCatOrder(c?.displayOrder ?? 0);
      setCatActive(c?.isActive ?? true);
    } else if (state.kind === 'service') {
      const s = state.service;
      setSvcName(s?.name ?? '');
      setSvcCode(s?.code ?? '');
      setSvcOrder(0);
      setSvcActive(s?.isActive ?? true);
    } else if (state.kind === 'variant') {
      const v = state.variant;
      setVarName(v?.name ?? '');
      setVarCode(v?.code ?? '');
      setVarPrice(v != null ? String(v.price) : '');
      setVarPriceType(v?.priceType ?? 'FIXED');
      setVarIol(v?.hasIolOptions ?? false);
      setVarOrder(v?.displayOrder ?? 0);
      setVarActive(v?.isActive ?? true);
    }
  }, [state]);

  const title = (() => {
    if (state.kind === 'category') {
      return state.mode === 'create' ? 'Add category' : 'Edit category';
    }
    if (state.kind === 'service') {
      return state.mode === 'create'
        ? `Add service${state.categoryName ? ` · ${state.categoryName}` : ''}`
        : 'Edit service';
    }
    if (state.kind === 'variant') {
      return state.mode === 'create'
        ? `Add variant${state.serviceName ? ` · ${state.serviceName}` : ''}`
        : 'Edit variant';
    }
    return '';
  })();

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (state.kind === 'category') {
        if (!catCode.trim() || !catName.trim()) {
          setError('Code and name are required.');
          return;
        }
        if (state.mode === 'create') {
          await serviceCatalogAdminApi.createCategory({
            code: catCode.trim(),
            name: catName.trim(),
            displayOrder: catOrder,
            isActive: catActive,
          });
        } else if (state.category) {
          await serviceCatalogAdminApi.updateCategory(state.category.id, {
            code: catCode.trim(),
            name: catName.trim(),
            displayOrder: catOrder,
            isActive: catActive,
          });
        }
      } else if (state.kind === 'service') {
        if (!svcName.trim()) {
          setError('Service name is required.');
          return;
        }
        if (state.mode === 'create') {
          await serviceCatalogAdminApi.createService(state.categoryId, {
            name: svcName.trim(),
            code: svcCode.trim() || undefined,
            displayOrder: svcOrder,
            isActive: svcActive,
          });
        } else if (state.service) {
          await serviceCatalogAdminApi.updateService(state.service.id, {
            name: svcName.trim(),
            code: svcCode.trim() || undefined,
            displayOrder: svcOrder,
            isActive: svcActive,
          });
        }
      } else if (state.kind === 'variant') {
        if (!varName.trim()) {
          setError('Variant name is required.');
          return;
        }
        const price = Number(varPrice);
        if (state.mode === 'create' && (Number.isNaN(price) || price < 0)) {
          setError('Valid price is required.');
          return;
        }
        if (state.mode === 'create') {
          await serviceCatalogAdminApi.createVariant(state.serviceId, {
            name: varName.trim(),
            code: varCode.trim() || undefined,
            price,
            priceType: varPriceType,
            hasIolOptions: varIol,
            displayOrder: varOrder,
            isActive: varActive,
          });
        } else if (state.variant) {
          await serviceCatalogAdminApi.updateVariant(state.variant.id, {
            name: varName.trim(),
            code: varCode.trim() || undefined,
            price: varPrice !== '' ? price : undefined,
            priceType: varPriceType,
            hasIolOptions: varIol,
            displayOrder: varOrder,
            isActive: varActive,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {state.kind === 'category' && (
            <>
              <Field label="Code" required>
                <input
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="CATARACT"
                  disabled={state.mode === 'edit'}
                />
              </Field>
              <Field label="Name" required>
                <input value={catName} onChange={(e) => setCatName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  value={catOrder}
                  onChange={(e) => setCatOrder(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={catActive} onChange={(e) => setCatActive(e.target.checked)} />
                Active
              </label>
            </>
          )}

          {state.kind === 'service' && (
            <>
              <Field label="Name" required>
                <input value={svcName} onChange={(e) => setSvcName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Code">
                <input
                  value={svcCode}
                  onChange={(e) => setSvcCode(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="SVC-CATARACT"
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  value={svcOrder}
                  onChange={(e) => setSvcOrder(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={svcActive} onChange={(e) => setSvcActive(e.target.checked)} />
                Active
              </label>
            </>
          )}

          {state.kind === 'variant' && (
            <>
              <Field label="Name" required>
                <input value={varName} onChange={(e) => setVarName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Code">
                <input
                  value={varCode}
                  onChange={(e) => setVarCode(e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="CAT-PHACO"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)" required={state.mode === 'create'}>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={varPrice}
                    onChange={(e) => setVarPrice(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Price type">
                  <select
                    value={varPriceType}
                    onChange={(e) => setVarPriceType(e.target.value as PriceType)}
                    className={inputCls}
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="PER_EYE">Per eye</option>
                    <option value="BOTH_EYES">Both eyes</option>
                  </select>
                </Field>
              </div>
              <Field label="Display order">
                <input
                  type="number"
                  value={varOrder}
                  onChange={(e) => setVarOrder(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={varIol} onChange={(e) => setVarIol(e.target.checked)} />
                Has IOL options
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={varActive} onChange={(e) => setVarActive(e.target.checked)} />
                Active
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  serviceCatalogAdminApi,
  type FlatVariantDto,
  type VariantIolLinkRequest,
} from '@/lib/api/service-catalog.api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function VariantIolMappingDialog({
  variant,
  open,
  onClose,
  onSaved,
}: {
  variant: FlatVariantDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, { checked: boolean; isDefault: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const iolCatalogQuery = useQuery({
    queryKey: ['service-catalog', 'admin', 'iol'],
    queryFn: () => serviceCatalogAdminApi.getIolCatalog(true),
    enabled: open,
  });

  const mappingsQuery = useQuery({
    queryKey: ['service-catalog', 'variant-iol', variant?.id],
    queryFn: () => serviceCatalogAdminApi.getVariantIolMappings(variant!.id),
    enabled: open && !!variant?.id,
  });

  useEffect(() => {
    if (!open || !mappingsQuery.data) return;
    const next: Record<string, { checked: boolean; isDefault: boolean }> = {};
    for (const m of mappingsQuery.data) {
      next[m.iolMasterId] = { checked: true, isDefault: m.isDefault };
    }
    setSelected(next);
  }, [open, mappingsQuery.data]);

  const iolOptions = useMemo(
    () => (iolCatalogQuery.data ?? []).filter((i) => i.isActive),
    [iolCatalogQuery.data],
  );

  const toggle = (iolId: string) => {
    setSelected((prev) => {
      const cur = prev[iolId];
      if (cur?.checked) {
        const { [iolId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [iolId]: { checked: true, isDefault: Object.keys(prev).length === 0 } };
    });
  };

  const setDefault = (iolId: string) => {
    setSelected((prev) => {
      const next: typeof prev = {};
      for (const id of Object.keys(prev)) {
        next[id] = { checked: true, isDefault: id === iolId };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!variant) return;
    const links: VariantIolLinkRequest[] = Object.entries(selected)
      .filter(([, v]) => v.checked)
      .map(([iolMasterId, v]) => ({ iolMasterId, isDefault: v.isDefault }));

    setSaving(true);
    try {
      await serviceCatalogAdminApi.setVariantIolMappings(variant.id, links);
      toast.success('IOL mappings saved');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save IOL mappings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>IOL options — {variant?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-2">
          Select which IOL models counsellors can offer for this procedure variant. Mark one as default.
        </p>
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {iolOptions.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">Add IOL models in the IOL Master tab first.</p>
          ) : (
            iolOptions.map((iol) => {
              const state = selected[iol.id];
              const checked = !!state?.checked;
              return (
                <label
                  key={iol.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-teal-50/40' : ''}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(iol.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{iol.modelName}</p>
                    <p className="text-xs text-gray-500">
                      {iol.brandManufacturer} · {iol.iolType} · ₹{iol.price.toLocaleString()}
                    </p>
                  </div>
                  {checked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setDefault(iol.id);
                      }}
                      className={`text-xs px-2 py-1 rounded border ${
                        state?.isDefault
                          ? 'border-teal-500 bg-teal-100 text-teal-800'
                          : 'border-gray-200 text-gray-500 hover:border-teal-300'
                      }`}
                    >
                      {state?.isDefault ? 'Default' : 'Set default'}
                    </button>
                  )}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm border rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save mappings'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

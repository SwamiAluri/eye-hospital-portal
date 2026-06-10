'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  serviceCatalogAdminApi,
  type IolMasterAdminDto,
  type CreateIolMasterRequest,
  type UpdateIolMasterRequest,
} from '@/lib/api/service-catalog.api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

const IOL_QUERY_KEY = ['service-catalog', 'admin', 'iol'] as const;

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400';

export function ServiceCatalogIolPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IolMasterAdminDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IolMasterAdminDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const iolQuery = useQuery({
    queryKey: IOL_QUERY_KEY,
    queryFn: () => serviceCatalogAdminApi.getIolCatalog(true),
    staleTime: 2 * 60 * 1000,
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: IolMasterAdminDto) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const refresh = () => void queryClient.invalidateQueries({ queryKey: IOL_QUERY_KEY });

  const handleSave = async (payload: CreateIolMasterRequest | UpdateIolMasterRequest) => {
    setSaving(true);
    try {
      if (editing) {
        await serviceCatalogAdminApi.updateIol(editing.id, payload as UpdateIolMasterRequest);
      } else {
        await serviceCatalogAdminApi.createIol(payload as CreateIolMasterRequest);
      }
      toast.success('IOL saved');
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error('Failed to save IOL');
      throw new Error('save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await serviceCatalogAdminApi.deleteIol(deleteTarget.id);
      toast.success('IOL deleted');
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error('Delete failed');
      throw new Error('delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (iolQuery.isLoading) {
    return <p className="text-sm text-gray-500 animate-pulse">Loading IOL catalog…</p>;
  }

  const rows = iolQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Global IOL models linked to surgery variants with <span className="font-medium">Has IOL</span> enabled.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50"
        >
          <Plus className="h-4 w-4" />
          Add IOL
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Origin</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No IOL models in catalog
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={!row.isActive ? 'opacity-50' : ''}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.modelName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.brandManufacturer}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.iolType}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.origin}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">₹{row.price.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {row.isActive ? (
                      <span className="text-teal-700">Active</span>
                    ) : (
                      <span className="text-red-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(row)}
                        className="p-1.5 rounded text-gray-400 hover:text-teal-700 hover:bg-teal-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <IolFormDialog
        open={dialogOpen}
        editing={editing}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      <ConfirmationDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete IOL model?"
        message={<>Soft-delete <span className="font-medium">{deleteTarget?.modelName}</span> and unlink from variants.</>}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

function IolFormDialog({
  open,
  editing,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: IolMasterAdminDto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: CreateIolMasterRequest | UpdateIolMasterRequest) => Promise<void>;
}) {
  const [modelName, setModelName] = useState('');
  const [brand, setBrand] = useState('');
  const [iolType, setIolType] = useState('Monofocal');
  const [origin, setOrigin] = useState('Imported');
  const [price, setPrice] = useState('');
  const [productCode, setProductCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setModelName(editing?.modelName ?? '');
    setBrand(editing?.brandManufacturer ?? '');
    setIolType(editing?.iolType ?? 'Monofocal');
    setOrigin(editing?.origin ?? 'Imported');
    setPrice(editing != null ? String(editing.price) : '');
    setProductCode(editing?.productCode ?? '');
    setDisplayOrder(editing?.displayOrder ?? 0);
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit IOL' : 'Add IOL'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block text-xs font-medium text-gray-600">
            Model name *
            <input value={modelName} onChange={(e) => setModelName(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Brand / manufacturer *
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-600">
              Type
              <input value={iolType} onChange={(e) => setIolType(e.target.value)} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Origin
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={`mt-1 ${inputCls}`}>
                <option value="Imported">Imported</option>
                <option value="Indian">Indian</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-600">
            Price (₹) *
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Product code
            <input value={productCode} onChange={(e) => setProductCode(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm border rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void onSave({
                modelName: modelName.trim(),
                brandManufacturer: brand.trim(),
                iolType,
                origin,
                price: Number(price),
                productCode: productCode.trim() || undefined,
                displayOrder,
                isActive,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

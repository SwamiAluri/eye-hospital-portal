'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  CatalogServiceDto,
  ServiceCategoryDto,
  ServiceVariantDto,
} from '@/lib/api/service-catalog.api';
import { isInvestigationCategoryCode } from '@/lib/counsellors-desk/investigation-catalog';
import type { ServiceCatalogMode } from '@/lib/master-data/service-catalog-url';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: ServiceCatalogMode;
  categories: ServiceCategoryDto[];
  onEditCategory: (cat: ServiceCategoryDto) => void;
  onAddCategory: () => void;
  onAddService: (cat: ServiceCategoryDto) => void;
  onEditService: (cat: ServiceCategoryDto, svc: CatalogServiceDto) => void;
  onAddVariant: (svc: CatalogServiceDto) => void;
  onDeleteCategory: (cat: ServiceCategoryDto) => void;
  onDeleteService: (svc: CatalogServiceDto) => void;
};

export function ServiceCatalogStructureDrawer({
  open,
  onClose,
  mode,
  categories,
  onEditCategory,
  onAddCategory,
  onAddService,
  onEditService,
  onAddVariant,
  onDeleteCategory,
  onDeleteService,
}: Props) {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openServices, setOpenServices] = useState<Record<string, boolean>>({});

  const scopedCategories = categories.filter((cat) => {
    if (mode === 'investigations') return isInvestigationCategoryCode(cat.code);
    if (mode === 'surgery') return !isInvestigationCategoryCode(cat.code);
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-gray-100 shrink-0">
          <DialogTitle>Manage catalog structure</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Add or reorganize categories, services, and variants. Deletes are soft-deactivate and affect all
            branches.
          </p>
        </DialogHeader>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <button
            type="button"
            onClick={onAddCategory}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            <Plus className="h-4 w-4" />
            New category
          </button>
          <ul className="space-y-3 text-sm">
            {scopedCategories.map((cat) => (
              <li key={cat.id} className={!cat.isActive ? 'opacity-50' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="font-medium text-gray-900 hover:text-teal-800 text-left"
                    onClick={() => setOpenCats((o) => ({ ...o, [cat.id]: !o[cat.id] }))}
                  >
                    {cat.code}
                    <span className="text-gray-500 font-normal"> — {cat.name}</span>
                    <span className="text-gray-400 font-normal text-xs ml-1">
                      ({cat.services.length} services ·{' '}
                      {cat.services.reduce((n, s) => n + s.variants.length, 0)} variants)
                    </span>
                  </button>
                  <TreeActions
                    onEdit={() => onEditCategory(cat)}
                    onAdd={() => onAddService(cat)}
                    onDelete={() => onDeleteCategory(cat)}
                    addLabel="Add service"
                  />
                </div>
                {openCats[cat.id] && (
                  <ul className="ml-3 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                    {cat.services.map((svc) => (
                      <li key={svc.id} className={!svc.isActive ? 'opacity-50' : ''}>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-gray-800 hover:text-teal-800 text-left"
                            onClick={() =>
                              setOpenServices((o) => ({ ...o, [svc.id]: !o[svc.id] }))
                            }
                          >
                            {svc.name}
                            <span className="text-gray-400 text-xs"> · {svc.variants.length} variants</span>
                          </button>
                          <TreeActions
                            onEdit={() => onEditService(cat, svc)}
                            onAdd={() => onAddVariant(svc)}
                            onDelete={() => onDeleteService(svc)}
                            addLabel="Add variant"
                          />
                        </div>
                        {openServices[svc.id] && svc.variants.length > 0 && (
                          <ul className="ml-2 mt-1 text-xs text-gray-500 space-y-0.5">
                            {svc.variants.map((v: ServiceVariantDto) => (
                              <li key={v.id} className={!v.isActive ? 'line-through' : ''}>
                                {v.name} — ₹{v.price.toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TreeActions({
  onEdit,
  onAdd,
  onDelete,
  addLabel,
}: {
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
  addLabel: string;
}) {
  return (
    <span className="inline-flex gap-0.5">
      <MiniBtn label={addLabel} onClick={onAdd}>
        <Plus className="h-3 w-3" />
      </MiniBtn>
      <MiniBtn label="Edit" onClick={onEdit}>
        <Pencil className="h-3 w-3" />
      </MiniBtn>
      <MiniBtn label="Delete" onClick={onDelete} danger>
        <Trash2 className="h-3 w-3" />
      </MiniBtn>
    </span>
  );
}

function MiniBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`p-1 rounded border border-transparent ${
        danger
          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
          : 'text-gray-400 hover:text-teal-700 hover:bg-teal-50'
      }`}
    >
      {children}
    </button>
  );
}

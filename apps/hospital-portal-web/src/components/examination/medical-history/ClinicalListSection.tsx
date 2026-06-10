'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ResponsiveFormSheet } from '@/components/examination/medical-history/ResponsiveFormSheet';

interface ClinicalListSectionProps<T extends { id: string }> {
  sectionId: string;
  title: string;
  count: number;
  canEdit?: boolean;
  addLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  items: T[];
  renderItemContent: (item: T) => React.ReactNode;
  renderForm: (ctx: {
    item: T | null;
    onSave: (data: Omit<T, 'id'>) => void;
    onClose: () => void;
  }) => React.ReactNode;
  formTitle: (item: T | null) => string;
  onAdd: (data: Omit<T, 'id'>) => void;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  highlightItem?: (item: T) => boolean;
  /** Collapse body when empty to reduce vertical whitespace (default true). */
  collapseWhenEmpty?: boolean;
  /** Optional toolbar below the header (inside the card). */
  headerAddon?: React.ReactNode;
}

export function ClinicalListSection<T extends { id: string }>({
  sectionId,
  title,
  count,
  canEdit = true,
  addLabel,
  emptyTitle,
  emptyDescription,
  items,
  renderItemContent,
  renderForm,
  formTitle,
  onAdd,
  onEdit,
  onDelete,
  highlightItem,
  collapseWhenEmpty = true,
  headerAddon,
}: ClinicalListSectionProps<T>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [bodyOpen, setBodyOpen] = useState(items.length > 0);

  useEffect(() => {
    if (items.length > 0) setBodyOpen(true);
  }, [items.length]);

  const isEmpty = items.length === 0;
  const collapsed = collapseWhenEmpty && isEmpty && !bodyOpen;

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setSheetOpen(true);
  };

  const handleSave = (data: Omit<T, 'id'>) => {
    if (editing) {
      onEdit({ ...editing, ...data } as T);
    } else {
      onAdd(data);
    }
    setSheetOpen(false);
    setEditing(null);
  };

  return (
    <section
      id={`mh-section-${sectionId}`}
      className="scroll-mt-24 bg-white border border-gray-200 rounded-xl overflow-hidden h-fit w-full"
    >
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {collapseWhenEmpty && isEmpty && (
            <button
              type="button"
              onClick={() => setBodyOpen((o) => !o)}
              className="p-1 rounded text-gray-500 hover:bg-gray-100"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand section' : 'Collapse section'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{count} recorded</p>
          </div>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openAdd}
          >
            {addLabel}
          </Button>
        )}
      </div>

      {headerAddon && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">{headerAddon}</div>
      )}

      {!collapsed && (
        <div className="p-4 space-y-2">
          {isEmpty ? (
            <EmptyState compact title={emptyTitle} description={emptyDescription} />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                  highlightItem?.(item)
                    ? 'bg-teal-50/80 border-teal-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-white'
                }`}
              >
                <div className="min-w-0 flex-1">{renderItemContent(item)}</div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ResponsiveFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={formTitle(editing)}
      >
        {renderForm({
          item: editing,
          onSave: handleSave,
          onClose: () => {
            setSheetOpen(false);
            setEditing(null);
          },
        })}
      </ResponsiveFormSheet>
    </section>
  );
}

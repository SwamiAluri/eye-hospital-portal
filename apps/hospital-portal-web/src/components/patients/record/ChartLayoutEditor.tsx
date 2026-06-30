'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useChartLayout } from '@/hooks/use-chart-layout';
import {
  DEFAULT_CHART_LAYOUT,
  type ChartLayoutConfig,
  type ChartWidgetConfig,
} from '@/lib/patients/chart-layout';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

function moveWidget(widgets: ChartWidgetConfig[], id: string, direction: -1 | 1) {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((w) => w.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return widgets;
  const next = [...sorted];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next.map((w, order) => ({ ...w, order }));
}

export function ChartLayoutEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { layout, saveLayout, isSaving } = useChartLayout();
  const [draft, setDraft] = useState<ChartLayoutConfig>(DEFAULT_CHART_LAYOUT);

  useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  const widgets = [...draft.widgets].sort((a, b) => a.order - b.order);

  const handleSave = async () => {
    try {
      const result = await saveLayout(draft);
      if (result.savedToServer) {
        toast.success('Chart layout saved to your account');
      } else {
        toast.success('Chart layout saved on this device (server sync unavailable)');
      }
      onOpenChange(false);
    } catch {
      toast.error('Could not save layout');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
            Customize overview
          </SheetTitle>
        </SheetHeader>

        <div
          className="mt-4 space-y-2"
          data-testid={patientLookupTestIds.chartLayoutEditor}
        >
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={widget.visible}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      widgets: prev.widgets.map((w) =>
                        w.id === widget.id ? { ...w, visible: e.target.checked } : w,
                      ),
                    }))
                  }
                />
                {widget.label}
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  className={cn(
                    'text-xs px-2 py-1 rounded border',
                    index === 0 ? 'opacity-40' : 'hover:bg-gray-50',
                  )}
                  onClick={() =>
                    setDraft((prev) => ({
                      widgets: moveWidget(prev.widgets, widget.id, -1),
                    }))
                  }
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={index === widgets.length - 1}
                  className={cn(
                    'text-xs px-2 py-1 rounded border',
                    index === widgets.length - 1 ? 'opacity-40' : 'hover:bg-gray-50',
                  )}
                  onClick={() =>
                    setDraft((prev) => ({
                      widgets: moveWidget(prev.widgets, widget.id, 1),
                    }))
                  }
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-lg border border-gray-200"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleSave}
          >
            Save layout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ChartLayoutEditorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        data-testid={patientLookupTestIds.chartLayoutButton}
      >
        <LayoutGrid className="w-4 h-4" />
        Customize
      </button>
      <ChartLayoutEditor open={open} onOpenChange={setOpen} />
    </>
  );
}

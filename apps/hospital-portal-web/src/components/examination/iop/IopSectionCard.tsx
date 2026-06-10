'use client';

import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  IOP_SECTIONS,
  type IopSectionId,
  type IopSectionRecordStatus,
} from '@/lib/optometry/iop-section-constants';
import type { IopSectionViewMode } from '@/lib/optometry/iop-section-snapshot';
import type { ReactNode } from 'react';

interface IopSectionCardProps {
  sectionId: IopSectionId;
  title: string;
  description?: string;
  icon?: ReactNode;
  infoTooltip?: ReactNode;
  recordStatus?: IopSectionRecordStatus;
  canEdit?: boolean;
  saving?: boolean;
  onRecord?: () => void;
  onUpdate?: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  viewMode: IopSectionViewMode;
  onDoneEditing?: () => void;
  recordedRail?: ReactNode;
  showRail?: boolean;
  hasFormContent?: boolean;
  children: ReactNode;
}

export function IopSectionCard({
  sectionId,
  title,
  description,
  icon,
  infoTooltip,
  recordStatus = 'empty',
  canEdit = true,
  saving = false,
  onRecord,
  onUpdate,
  expanded,
  onExpandedChange,
  viewMode,
  onDoneEditing,
  recordedRail,
  showRail = false,
  hasFormContent = false,
  children,
}: IopSectionCardProps) {
  const meta = IOP_SECTIONS.find((s) => s.id === sectionId);
  const recorded = recordStatus === 'recorded';
  const dirty = recordStatus === 'draft';
  const isEditing = viewMode === 'editing';
  const showRailPanel = showRail && recordedRail;

  return (
    <section
      id={meta?.anchor ?? `iop-section-${sectionId}`}
      className="scroll-mt-28 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
    >
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 text-left flex-1 min-h-[44px] lg:min-h-0"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
          )}
          {icon && <span className="text-gray-600 shrink-0">{icon}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              {infoTooltip}
              {recorded && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <Check className="w-3 h-3" /> Recorded
                </span>
              )}
              {dirty && !recorded && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  In progress
                </span>
              )}
              {isEditing && recorded && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Editing
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing && recorded && onDoneEditing && (
            <Button type="button" size="sm" variant="outline" onClick={onDoneEditing}>
              Done
            </Button>
          )}
          {canEdit && isEditing && recorded && onUpdate && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving || !hasFormContent}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate();
              }}
              className="min-h-[44px] lg:min-h-9"
            >
              {saving ? 'Updating…' : 'Update section'}
            </Button>
          )}
          {canEdit && !(isEditing && recorded) && onRecord && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving || !hasFormContent}
              onClick={(e) => {
                e.stopPropagation();
                onRecord();
              }}
              className="min-h-[44px] lg:min-h-9"
            >
              {saving ? 'Recording…' : 'Record section'}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3">
          <div
            className={
              showRailPanel
                ? 'grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,340px)] gap-4 lg:gap-6 items-start'
                : 'min-w-0'
            }
          >
            <div className="min-w-0">{children}</div>
            {showRailPanel && (
              <div className="min-w-0 lg:sticky lg:top-24">{recordedRail}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

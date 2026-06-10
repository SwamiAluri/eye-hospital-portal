'use client';

import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RETINOSCOPY_SECTIONS,
  type RetinoscopySectionId,
  type RetinoscopySectionRecordStatus,
} from '@/lib/optometry/retinoscopy-section-constants';
import type { ReactNode } from 'react';

interface RetinoscopySectionCardProps {
  sectionId: RetinoscopySectionId;
  title: string;
  icon?: ReactNode;
  recordStatus?: RetinoscopySectionRecordStatus;
  canEdit?: boolean;
  saving?: boolean;
  showRecordButton?: boolean;
  showUpdateButton?: boolean;
  onRecord?: () => void;
  onUpdate?: () => void;
  onCancelEdit?: () => void;
  isRailEditing?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  recordedRail?: ReactNode;
  showRail?: boolean;
  children: ReactNode;
}

export function RetinoscopySectionCard({
  sectionId,
  title,
  icon,
  recordStatus = 'empty',
  canEdit = true,
  saving = false,
  showRecordButton = false,
  showUpdateButton = false,
  onRecord,
  onUpdate,
  onCancelEdit,
  isRailEditing = false,
  expanded,
  onExpandedChange,
  recordedRail,
  showRail = false,
  children,
}: RetinoscopySectionCardProps) {
  const meta = RETINOSCOPY_SECTIONS.find((s) => s.id === sectionId);
  const recorded = recordStatus === 'recorded';
  const dirty = recordStatus === 'draft';
  const showRailPanel = showRail && recordedRail;

  return (
    <section
      id={meta?.anchor ?? `retinoscopy-section-${sectionId}`}
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
              {isRailEditing && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Editing
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && isRailEditing && onCancelEdit && (
            <Button type="button" size="sm" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          )}
          {canEdit && showUpdateButton && onUpdate && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate();
              }}
              className="min-h-[44px] lg:min-h-9"
            >
              {saving ? 'Updating…' : 'Update section'}
            </Button>
          )}
          {canEdit && showRecordButton && onRecord && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving}
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

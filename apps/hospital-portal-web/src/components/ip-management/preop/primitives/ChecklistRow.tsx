'use client';

import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { StatusChip } from './StatusChip';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ChecklistRowProps {
  /** Stable key for test IDs + region association. */
  itemKey: string;
  title: string;
  description?: string;
  status?: PreOpStatus;
  /** Extra chips beside the title (e.g. Required, Critical). */
  badges?: ReactNode;
  /** Right-aligned summary shown when collapsed (e.g. the entered value). */
  summary?: ReactNode;

  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;

  /** Overflow actions (Save / Upload / Verify / History …). */
  actions?: ActionMenuItem[];

  /** Tints the row when the item is satisfied. */
  done?: boolean;
  /** Emphasises the row for patient-safety-critical items. */
  emphasis?: 'critical' | null;

  children?: ReactNode;
  className?: string;
}

/**
 * Generic, accessible checklist row used across Investigations, Department
 * Clearance, Consent, Ward Safety (blueprint §7, §14). Header is a 44px-min target
 * disclosure button controlling an associated region; status is icon + text + color.
 */
export function ChecklistRow({
  itemKey,
  title,
  description,
  status,
  badges,
  summary,
  expandable = true,
  expanded = false,
  onToggle,
  actions,
  done = false,
  emphasis = null,
  children,
  className = '',
}: ChecklistRowProps) {
  const regionId = `${useId()}-${itemKey}`;
  const isOpen = expandable && expanded;

  const borderClass =
    emphasis === 'critical'
      ? 'border-red-200'
      : done
        ? 'border-emerald-100'
        : 'border-gray-200';
  const bgClass =
    emphasis === 'critical'
      ? 'bg-red-50/40'
      : done
        ? 'bg-emerald-50/30'
        : 'bg-white';

  const headerInner = (
    <>
      {expandable && (
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {badges}
        </div>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
    </>
  );

  return (
    <div
      data-testid={WARD_PREOP_V2_TEST_IDS.checklistRow(itemKey)}
      className={`overflow-hidden rounded-xl border ${borderClass} ${bgClass} ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {expandable ? (
          <button
            type="button"
            data-testid={WARD_PREOP_V2_TEST_IDS.checklistRowToggle(itemKey)}
            aria-expanded={isOpen}
            aria-controls={regionId}
            onClick={onToggle}
            className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {headerInner}
          </button>
        ) : (
          <div className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2.5 text-left">
            {headerInner}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {!isOpen && summary}
          {status && <StatusChip status={status} size="sm" />}
          {actions && actions.length > 0 && <ActionMenu items={actions} />}
        </div>
      </div>

      {isOpen && children && (
        <div id={regionId} className="border-t border-gray-100 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

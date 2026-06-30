'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  PATIENT_RECORD_TAB_GROUPS,
  PATIENT_RECORD_TAB_GROUP_KEYS,
  getDefaultTabForGroup,
  getOverflowTabsForGroup,
  isOverflowTab,
  patientRecordTabLabel,
  resolveTabGroup,
  type PatientRecordTabGroupKey,
  type PatientRecordTabKey,
} from '@/lib/patients/patient-record-tabs';
import { cn } from '@/lib/utils';

export interface PatientRecordTabGroupsProps {
  activeTab: PatientRecordTabKey;
  onTabChange: (tab: PatientRecordTabKey) => void;
  trailing?: React.ReactNode;
}

export function PatientRecordTabGroups({
  activeTab,
  onTabChange,
  trailing,
}: PatientRecordTabGroupsProps) {
  const activeGroup = resolveTabGroup(activeTab);
  const groupConfig = PATIENT_RECORD_TAB_GROUPS[activeGroup];
  const overflowTabs = getOverflowTabsForGroup(activeGroup);
  const activeInOverflow = isOverflowTab(activeTab, activeGroup);

  const handleGroupSelect = (group: PatientRecordTabGroupKey) => {
    if (group === activeGroup) return;
    onTabChange(getDefaultTabForGroup(group));
  };

  return (
    <div className="border-b border-gray-100" data-testid={patientLookupTestIds.recordTabGroups}>
      <div
        className="flex gap-1 overflow-x-auto px-2 pt-2"
        role="tablist"
        aria-label="Record section"
      >
        {PATIENT_RECORD_TAB_GROUP_KEYS.map((groupKey) => {
          const group = PATIENT_RECORD_TAB_GROUPS[groupKey];
          const selected = activeGroup === groupKey;
          return (
            <button
              key={groupKey}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleGroupSelect(groupKey)}
              className={cn(
                'shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
              data-testid={patientLookupTestIds.recordTabGroup(groupKey)}
            >
              {group.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 overflow-x-auto px-2">
        <div className="flex min-w-0 gap-1" role="tablist" aria-label="Record tabs">
          {groupConfig.visible.map((tabKey) => {
            const active = tabKey === activeTab;
            return (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tabKey)}
                data-testid={patientLookupTestIds.recordTab(tabKey)}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                  active
                    ? 'border-emerald-600 font-medium text-emerald-700'
                    : 'border-transparent text-gray-600 hover:text-gray-900',
                )}
              >
                {patientRecordTabLabel(tabKey)}
              </button>
            );
          })}

          {overflowTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 border-b-2 px-3 py-2 text-sm transition-colors',
                    activeInOverflow
                      ? 'border-emerald-600 font-medium text-emerald-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900',
                  )}
                  data-testid={patientLookupTestIds.recordMoreTabs}
                >
                  More
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                {overflowTabs.map((tabKey) => (
                  <DropdownMenuItem
                    key={tabKey}
                    onClick={() => onTabChange(tabKey)}
                    data-testid={patientLookupTestIds.recordTab(tabKey)}
                    className={cn(tabKey === activeTab && 'bg-emerald-50 text-emerald-800')}
                  >
                    {patientRecordTabLabel(tabKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {trailing ? <div className="shrink-0 py-1">{trailing}</div> : null}
      </div>
    </div>
  );
}

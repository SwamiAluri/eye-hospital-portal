'use client';

import { useState, ReactNode } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

interface AdvancedFiltersProps {
  filterGroups: FilterGroup[];
  selectedFilters: Record<string, string[]>;
  onFiltersChange: (filters: Record<string, string[]>) => void;
  className?: string;
}

export function AdvancedFilters({ filterGroups, selectedFilters, onFiltersChange, className }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleFilter = (groupId: string, value: string, multiple: boolean) => {
    const currentValues = selectedFilters[groupId] || [];
    
    if (multiple) {
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      onFiltersChange({
        ...selectedFilters,
        [groupId]: newValues
      });
    } else {
      onFiltersChange({
        ...selectedFilters,
        [groupId]: currentValues.includes(value) ? [] : [value]
      });
    }
  };

  const clearFilters = () => {
    onFiltersChange({});
    setIsOpen(false);
  };

  const clearFilterGroup = (groupId: string) => {
    const newFilters = { ...selectedFilters };
    delete newFilters[groupId];
    onFiltersChange(newFilters);
  };

  const activeFilterCount = Object.values(selectedFilters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="md"
        leftIcon={<Filter className="h-4 w-4" />}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(activeFilterCount > 0 && 'border-emerald-500 text-emerald-600')}
      >
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white text-xs font-medium">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-80">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {filterGroups.map((group) => {
                const hasSelection = (selectedFilters[group.id] || []).length > 0;
                
                return (
                  <div key={group.id} className="border-b border-gray-200 last:border-b-0">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-900">
                          {group.label}
                          {hasSelection && (
                            <span className="ml-2 text-xs text-emerald-600">
                              ({selectedFilters[group.id].length})
                            </span>
                          )}
                        </label>
                        {hasSelection && (
                          <button
                            onClick={() => clearFilterGroup(group.id)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option) => {
                          const isSelected = (selectedFilters[group.id] || []).includes(option.value);
                          
                          return (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFilter(group.id, option.value, group.multiple !== false)}
                                className="h-4 w-4 rounded border-gray-200 accent-emerald-500"
                              />
                              <span className="flex-1 text-sm text-gray-700">
                                {option.label}
                              </span>
                              {option.count !== undefined && (
                                <span className="text-xs text-gray-500">
                                  {option.count}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Active Filters Display Component
interface ActiveFiltersProps {
  filterGroups: FilterGroup[];
  selectedFilters: Record<string, string[]>;
  onRemoveFilter: (groupId: string, value: string) => void;
  onClearAll: () => void;
}

export function ActiveFilters({ filterGroups, selectedFilters, onRemoveFilter, onClearAll }: ActiveFiltersProps) {
  const activeFilterCount = Object.values(selectedFilters).reduce((sum, arr) => sum + arr.length, 0);
  
  if (activeFilterCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-600 font-medium">Active filters:</span>
      {Object.entries(selectedFilters).map(([groupId, values]) => {
        const group = filterGroups.find(g => g.id === groupId);
        if (!group || values.length === 0) return null;

        return values.map(value => {
          const option = group.options.find(o => o.value === value);
          if (!option) return null;

          return (
            <span
              key={`${groupId}-${value}`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-sm"
            >
              <span className="font-medium">{group.label}:</span>
              <span>{option.label}</span>
              <button
                onClick={() => onRemoveFilter(groupId, value)}
                className="ml-1 hover:bg-emerald-100 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        });
      })}
      <button
        onClick={onClearAll}
        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

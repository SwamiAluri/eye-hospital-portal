'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({ value, onChange, placeholder = 'Select date range', className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(value || { from: null, to: null });

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleApply = () => {
    onChange(tempRange);
    setIsOpen(false);
  };

  const handleClear = () => {
    const emptyRange = { from: null, to: null };
    setTempRange(emptyRange);
    onChange(emptyRange);
    setIsOpen(false);
  };

  const hasValue = value?.from || value?.to;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 h-10 px-3 py-2 rounded-lg border bg-white text-sm',
          'focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all',
          hasValue ? 'border-emerald-500 text-gray-900' : 'border-gray-200 text-gray-600'
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400" />
        {hasValue ? (
          <span>
            {formatDate(value.from)} - {formatDate(value.to)}
          </span>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        {hasValue && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-0.5 hover:bg-gray-100 rounded"
          >
            <X className="h-3 w-3 text-gray-500" />
          </button>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[320px] max-w-[calc(100vw-2rem)]">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={tempRange.from ? tempRange.from.toISOString().split('T')[0] : ''}
                  onChange={(e) => setTempRange({ ...tempRange, from: e.target.value ? new Date(e.target.value) : null })}
                  className="w-full h-9 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={tempRange.to ? tempRange.to.toISOString().split('T')[0] : ''}
                  onChange={(e) => setTempRange({ ...tempRange, to: e.target.value ? new Date(e.target.value) : null })}
                  className="w-full h-9 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                >
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApply}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Quick Select</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const today = new Date();
                      setTempRange({ from: today, to: today });
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const lastWeek = new Date(today);
                      lastWeek.setDate(today.getDate() - 7);
                      setTempRange({ from: lastWeek, to: today });
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const lastMonth = new Date(today);
                      lastMonth.setDate(today.getDate() - 30);
                      setTempRange({ from: lastMonth, to: today });
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                      setTempRange({ from: firstDayOfMonth, to: today });
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    This month
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';

interface VesselChangeChipsProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  eyeLabel: 'OD' | 'OS';
}

export function VesselChangeChips({
  label,
  options,
  selected,
  onChange,
  disabled,
  eyeLabel,
}: VesselChangeChipsProps) {
  const toggle = (opt: string) => {
    if (disabled) return;
    if (selected.includes(opt)) {
      onChange(selected.filter((x) => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="py-0.5 min-w-0">
      <span
        className={cn(
          'lg:hidden text-[10px] font-semibold uppercase block mb-1',
          eyeLabel === 'OD' ? 'text-blue-700' : 'text-emerald-700',
        )}
      >
        {eyeLabel === 'OD' ? 'Right / OD' : 'Left / OS'}
      </span>
      <p className="text-[10px] text-slate-500 mb-1 lg:hidden">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt)}
              className={cn(
                'text-[11px] px-2 py-1 rounded-full border transition-colors',
                on
                  ? eyeLabel === 'OD'
                    ? 'bg-blue-100 border-blue-300 text-blue-900'
                    : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

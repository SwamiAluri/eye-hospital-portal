'use client';

interface PriorValueHintProps {
  value?: string | number | null;
  label?: string;
  className?: string;
}

export function PriorValueHint({ value, label = 'Last', className = '' }: PriorValueHintProps) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p className={`text-[11px] text-slate-500 mt-0.5 ${className}`}>
      {label}: <span className="font-medium text-slate-600">{value}</span>
    </p>
  );
}

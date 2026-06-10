'use client';

interface CompactSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

/** Table-cell sized select (keeps all dropdown options). */
export function CompactSelect({
  value,
  onChange,
  disabled,
  children,
  className = '',
  'aria-label': ariaLabel,
}: CompactSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-10 md:h-8 px-1.5 text-xs font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100 ${className}`}
    >
      {children}
    </select>
  );
}

'use client';

import { ExamSelectField } from './ExamSelectField';

interface RxComboboxProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  priorValue?: string;
  className?: string;
}

/** Diopter / axis picker — single-box UI with searchable popover list. */
export function RxCombobox({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select',
  priorValue,
  className = '',
}: RxComboboxProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <ExamSelectField
        aria-label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        priorValue={priorValue}
        searchable
      />
    </div>
  );
}

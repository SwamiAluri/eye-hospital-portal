'use client';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function PacClinicalTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  );
}

export interface PacTableRowProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  action?: ReactNode;
}

export function PacTableRow({ label, required, children, action }: PacTableRowProps) {
  return (
    <tr>
      <th
        scope="row"
        className="w-[38%] px-4 py-2 align-top text-left text-xs font-medium text-gray-600"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </th>
      <td className="px-4 py-2 text-sm text-gray-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">{children}</div>
          {action}
        </div>
      </td>
    </tr>
  );
}

export interface PacSegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T | null | undefined;
  disabled?: boolean;
  formatLabel?: (value: T) => string;
  onChange: (value: T) => void;
}

export function PacSegmentedControl<T extends string | number>({
  options,
  value,
  disabled,
  formatLabel,
  onChange,
}: PacSegmentedControlProps<T>) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(option => {
        const selected = value === option;
        const label = formatLabel ? formatLabel(option) : String(option);
        return (
          <button
            key={String(option)}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={`min-w-[2rem] rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? 'border-gray-800 bg-gray-800 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            } disabled:opacity-50`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export interface PacIconLinkProps {
  label: string;
  onClick: () => void;
  testId?: string;
}

export function PacIconLink({ label, onClick, testId }: PacIconLinkProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.25 5.5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0V7.56l-7.22 7.22a.75.75 0 0 1-1.06-1.06L11.44 6.5H5a.75.75 0 0 1-.75-.75Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

const fieldClass =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 disabled:bg-gray-50 disabled:text-gray-500';

export function PacFieldInput(
  props: InputHTMLAttributes<HTMLInputElement> & { testId?: string },
) {
  const { testId, className = '', ...rest } = props;
  return (
    <input
      data-testid={testId}
      className={`${fieldClass} ${className}`}
      {...rest}
    />
  );
}

export function PacFieldTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { testId?: string },
) {
  const { testId, className = '', ...rest } = props;
  return (
    <textarea
      data-testid={testId}
      className={`${fieldClass} resize-none ${className}`}
      {...rest}
    />
  );
}

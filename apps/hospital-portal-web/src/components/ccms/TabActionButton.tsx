'use client';

import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabledReason?: string;
  variant?: 'primary' | 'success';
}

export function TabActionButton({
  disabled,
  disabledReason,
  variant = 'primary',
  className = '',
  children,
  ...rest
}: Props) {
  const blocked = disabled || Boolean(disabledReason);
  const base =
    variant === 'success'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <span className="inline-flex" title={blocked && disabledReason ? disabledReason : undefined}>
      <button
        type="button"
        disabled={blocked}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${base} ${className}`}
        {...rest}
      >
        {children}
      </button>
    </span>
  );
}

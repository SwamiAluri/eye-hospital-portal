import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, required, ...props }, ref) => {
    const inputId = React.useId()
    
    if (label) {
      return (
        <div className="w-full">
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-status-critical ml-1">*</span>}
          </label>
          <input
            id={inputId}
            type={type}
            className={cn(
              'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
              error && 'border-status-critical focus:ring-status-critical focus:border-status-critical',
              className
            )}
            ref={ref}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-status-critical" role="alert">{error}</p>}
          {helperText && !error && <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500">{helperText}</p>}
        </div>
      )
    }
    
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
          error && 'border-status-critical focus:ring-status-critical focus:border-status-critical',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
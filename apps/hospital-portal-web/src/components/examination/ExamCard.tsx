/**
 * Shared Card Component for Examination Forms
 * Based on modern healthcare UI design principles
 */

import { ReactNode, useState } from 'react';
import { ChevronDown as ChevDown, ChevronUp as ChevUp, Info } from 'lucide-react';
// Fall back to simple implementation if icons not available
const ChevronDown = ChevDown || (() => <span>▼</span>);
const ChevronUp = ChevUp || (() => <span>▲</span>);

interface ExamCardProps {
  title: string;
  description?: string;
  infoTooltip?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  icon?: ReactNode;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  };
  className?: string;
  /** Compact padding for dense slit-lamp layouts */
  dense?: boolean;
}

export function ExamCard({
  title,
  description,
  infoTooltip,
  children,
  collapsible = false,
  defaultExpanded = true,
  icon,
  badge,
  className = '',
  dense = false,
}: ExamCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const badgeStyles = {
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    neutral: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div
        className={`${dense ? 'px-4 py-2.5' : 'px-6 py-4'} border-b border-gray-100 ${
          collapsible ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
        }`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="text-gray-600">{icon}</div>}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 inline-flex items-center">
                  {title}
                  {infoTooltip && <InfoTooltip content={infoTooltip} />}
                </h3>
                {badge && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      badgeStyles[badge.variant || 'neutral']
                    }`}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {collapsible && (
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && (
        <div className={dense ? 'px-4 py-3' : 'px-6 py-5'}>{children}</div>
      )}
    </div>
  );
}

// Import React at the top
import React from 'react';

/**
 * Form Input with Modern Healthcare Styling
 */
interface ExamInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  infoTooltip?: string;
}

export function ExamInput({ label, error, helpText, infoTooltip, className = '', ...props }: ExamInputProps) {
  const dense = className.includes('dense') || className.includes('py-1');
  return (
    <div className="w-full">
      {label && (
        <label className={`block font-medium text-gray-700 inline-flex items-center ${dense ? 'text-xs mb-1' : 'text-sm mb-1.5'}`}>
          {label}
          {infoTooltip && <InfoTooltip content={infoTooltip} />}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 text-sm border ${
          error ? 'border-red-500' : 'border-gray-300'
        } rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
          error ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
        } focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

/**
 * Select Dropdown with Modern Healthcare Styling
 */
interface ExamSelectProps {
  label?: string;
  error?: string;
  helpText?: string;
  infoTooltip?: string;
  options?: Array<{ value: string; label: string }>;
  value?: string | number;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
}

export function ExamSelect({ label, error, helpText, infoTooltip, className = '', children, options, onChange, ...props }: ExamSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const dense = className.includes('text-sm') && className.includes('py-1');

  return (
    <div className="w-full">
      {label && (
        <label className={`block font-medium text-gray-700 inline-flex items-center ${dense ? 'text-xs mb-1' : 'text-sm mb-1.5'}`}>
          {label}
          {infoTooltip && <InfoTooltip content={infoTooltip} />}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 text-sm border ${
          error ? 'border-red-500' : 'border-gray-300'
        } rounded-lg bg-white focus:outline-none focus:ring-2 ${
          error ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
        } focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors appearance-none cursor-pointer ${className}`}
        onChange={handleChange}
        {...props}
      >
        {options ? options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        )) : children}
      </select>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
interface StatusBadgeProps {
  text: string; // Changed from 'status' to match actual usage throughout codebase
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';
}

export function StatusBadge({ text, variant = 'neutral' }: StatusBadgeProps) {
  const variants = {
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800 bg-red-50',
    info: 'bg-blue-100 text-blue-800',
    neutral: 'bg-gray-100 text-gray-700',
    pending: 'bg-pink-50 text-pink-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {text}
    </span>
  );
}

/**
 * Section Divider
 */
interface SectionDividerProps {
  title?: string;
}

export function SectionDivider({ title }: SectionDividerProps) {
  if (title) {
    return (
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
    );
  }
  
  return <div className="border-t border-gray-200 my-6" />;
}

/**
 * Action Button (Emerald Primary)
 */
interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: ActionButtonProps) {
  const baseStyles = 'font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white focus:ring-emerald-500',
    secondary: 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 focus:ring-gray-500',
    destructive: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    ghost: 'text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${icon ? 'inline-flex items-center gap-2' : ''}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================================
// Info Tooltip Component
// ============================================================================

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export function InfoTooltip({ content, className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="ml-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
      >
        <Info className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className="absolute z-50 w-64 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg -top-2 left-6 transform -translate-y-full">
          <div className="relative">
            {content}
            <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-0" style={{ left: '-12px', top: '100%', marginTop: '-4px' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

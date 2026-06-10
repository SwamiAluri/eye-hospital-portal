'use client';

import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react';
import { SUPPORT_CONTACT } from './auth-constants';

interface AuthSelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon: string;
  staggerClass?: string;
  loading?: boolean;
  loadingText?: string;
}

export function AuthSelectField({
  label,
  icon,
  staggerClass = 'stagger-2',
  loading,
  loadingText = 'Loading…',
  children,
  id,
  ...props
}: AuthSelectFieldProps) {
  return (
    <div className={`auth-field-wrap staggered-child ${staggerClass}`}>
      <label htmlFor={id} className="auth-field-label">
        {label}
      </label>
      <div className="relative group input-focus-effect rounded-xl">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-oc-outline group-focus-within:text-oc-primary transition-colors pointer-events-none text-[18px]">
          {icon}
        </span>
        {loading ? (
          <div className="auth-field auth-field-pl text-oc-outline">{loadingText}</div>
        ) : (
          <>
            <select
              id={id}
              className="auth-field auth-field-pl auth-field-pr-select appearance-none cursor-pointer"
              {...props}
            >
              {children}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-oc-outline text-[18px]">
              expand_more
            </span>
          </>
        )}
      </div>
    </div>
  );
}

interface AuthInputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: string;
  staggerClass?: string;
  labelExtra?: ReactNode;
  inputClassName?: string;
}

export function AuthInputField({
  label,
  icon,
  staggerClass = 'stagger-3',
  labelExtra,
  id,
  inputClassName,
  className,
  ...props
}: AuthInputFieldProps) {
  return (
    <div className={`auth-field-wrap staggered-child ${staggerClass}`}>
      <div className="flex justify-between items-center px-1">
        <label htmlFor={id} className="auth-field-label">
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="relative group input-focus-effect rounded-xl">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-oc-outline group-focus-within:text-oc-primary transition-colors pointer-events-none text-[18px]">
          {icon}
        </span>
        <input
          id={id}
          className={`auth-field auth-field-pl placeholder:text-oc-outline-variant/60 ${inputClassName ?? ''} ${className ?? ''}`}
          {...props}
        />
      </div>
    </div>
  );
}

export function AuthMfaHintBanner() {
  return (
    <div className="auth-mfa-banner staggered-child stagger-5">
      <div className="auth-mfa-icon-wrap">
        <span className="material-symbols-outlined text-oc-primary text-[18px]">shield_person</span>
      </div>
      <div className="flex-grow min-w-0">
        <p className="auth-mfa-title">MFA Required</p>
        <p className="auth-mfa-desc">Secondary verification code required for clinical access</p>
        <p className="auth-mfa-oneline">MFA required for clinical access</p>
      </div>
      <button
        type="button"
        title="Biometric sign-in coming soon"
        className="auth-mfa-biometric"
        tabIndex={-1}
        aria-hidden
      >
        <span className="material-symbols-outlined text-[18px]">fingerprint</span>
        <span className="text-[8px] uppercase tracking-tighter">Biometric</span>
      </button>
    </div>
  );
}

export function AuthCardBottomActions({ showEmergency = false }: { showEmergency?: boolean }) {
  return (
    <div className="auth-card-bottom-actions staggered-child stagger-5">
      {showEmergency && (
        <>
          <button
            type="button"
            title="Contact Clinical IT Helpdesk (Ext. 555)"
            className="auth-emergency-action"
            tabIndex={-1}
            aria-hidden
          >
            <span className="material-symbols-outlined auth-emergency-icon pulse-icon">emergency</span>
            <span className="auth-emergency-label">Emergency Bypass</span>
          </button>
          <span className="auth-bottom-divider" aria-hidden>
            ·
          </span>
        </>
      )}
      <span className="auth-support-line">
        <span className="auth-support-prefix">Support: </span>
        <span className="auth-support-link">{SUPPORT_CONTACT}</span>
      </span>
    </div>
  );
}

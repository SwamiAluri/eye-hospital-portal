'use client';

import { APP_VERSION } from './auth-constants';
import type { ReactNode } from 'react';

interface AuthGlassCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showSecureBadge?: boolean;
}

export function AuthGlassCard({
  title,
  subtitle,
  children,
  showSecureBadge = true,
}: AuthGlassCardProps) {
  return (
    <div className="glass-card animate-fade-up">
      {showSecureBadge && (
        <div className="auth-card-badge-row staggered-child stagger-1">
          <div className="shimmer-badge border border-oc-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span
              className="material-symbols-outlined text-[12px] text-oc-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <span className="text-[9px] text-oc-primary uppercase tracking-widest font-bold">
              Secure Access
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-oc-on-surface-variant text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-oc-secondary" />
            {APP_VERSION}
          </div>
        </div>
      )}

      <div className="auth-card-header staggered-child stagger-1">
        <h2 className="auth-card-title">{title}</h2>
        {subtitle && <p className="auth-card-subtitle">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}

export function AuthAlert({
  variant,
  children,
}: {
  variant: 'error' | 'success';
  children: ReactNode;
}) {
  const styles =
    variant === 'error'
      ? 'bg-oc-error-container/30 border-oc-error/20 text-oc-error'
      : 'bg-green-50 border-green-200 text-green-700';

  return (
    <div
      className={`px-3 py-2 rounded-xl text-sm border ${styles} staggered-child stagger-1`}
      style={{ fontSize: 'clamp(0.75rem, 1.3vh, 0.875rem)' }}
    >
      {children}
    </div>
  );
}

export function AuthGradientButton({
  type = 'submit',
  disabled,
  loading,
  loadingText,
  children,
  className = '',
}: {
  type?: 'submit' | 'button';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`w-full btn-gradient text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-oc-primary/20 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        loadingText ?? 'Loading…'
      ) : (
        <>
          {children}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </>
      )}
    </button>
  );
}


'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApi } from '@/lib/api';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import {
  AuthGlassCard,
  AuthAlert,
  AuthGradientButton,
} from '@/components/auth/AuthGlassCard';
import { AuthInputField, AuthCardBottomActions } from '@/components/auth/AuthFormFields';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidating(false);
        setTokenValid(false);
        setMessage({ type: 'error', text: 'Invalid or missing reset token' });
        return;
      }

      try {
        const api = getApi();
        const response = await api.post('/auth/validate-reset-token', { token });

        if (response.data.valid) {
          setTokenValid(true);
          setUserEmail(response.data.email);
        } else {
          setTokenValid(false);
          setMessage({
            type: 'error',
            text: response.data.message || 'Invalid or expired reset token',
          });
        }
      } catch (error: unknown) {
        const apiErr = error as { response?: { data?: { message?: string } } };
        setTokenValid(false);
        setMessage({
          type: 'error',
          text: apiErr.response?.data?.message || 'Invalid or expired reset token',
        });
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength('weak');
      return;
    }

    let strength = 0;
    if (newPassword.length >= 12) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(newPassword)) strength++;

    if (strength >= 5) setPasswordStrength('strong');
    else if (strength >= 3) setPasswordStrength('medium');
    else setPasswordStrength('weak');
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (newPassword.length < 12) {
      setMessage({ type: 'error', text: 'Password must be at least 12 characters long' });
      setLoading(false);
      return;
    }

    if (passwordStrength === 'weak') {
      setMessage({
        type: 'error',
        text: 'Password is too weak. Please include uppercase, lowercase, numbers, and special characters.',
      });
      setLoading(false);
      return;
    }

    try {
      const api = getApi();
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword,
      });

      setMessage({ type: 'success', text: response.data.message || 'Password reset successful!' });

      setTimeout(() => {
        router.push('/auth/login?message=Password reset successful. Please login with your new password.');
      }, 3000);
    } catch (error: unknown) {
      const apiErr = error as { response?: { data?: { message?: string } } };
      setMessage({
        type: 'error',
        text: apiErr.response?.data?.message || 'Failed to reset password. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <>
        <AuthBrandHeader />
        <div className="auth-panel-stack">
          <div className="glass-card text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-oc-primary border-t-transparent" />
            <p className="mt-3 auth-card-subtitle">Validating reset link…</p>
          </div>
        </div>
      </>
    );
  }

  if (!tokenValid) {
    return (
      <>
        <AuthBrandHeader />
        <div className="auth-panel-stack">
          <AuthGlassCard title="Invalid Reset Link" subtitle="This link is invalid or has expired.">
            {message && (
              <div className="mb-4">
                <AuthAlert variant="error">{message.text}</AuthAlert>
              </div>
            )}
            <Link
              href="/auth/forgot-password"
              className="btn-gradient w-full text-white font-semibold flex items-center justify-center gap-2"
            >
              Request New Reset Link
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </AuthGlassCard>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthBrandHeader />

      <div className="auth-panel-stack">
        <AuthGlassCard title="Set New Password" subtitle={`For: ${userEmail}`}>
        {message && (
          <div className="mb-4">
            <AuthAlert variant={message.type === 'success' ? 'success' : 'error'}>
              {message.text}
            </AuthAlert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="staggered-child stagger-2 auth-form">
            <AuthInputField
              id="newPassword"
              label="New Password"
              icon="lock"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={loading}
            />
            {newPassword && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-1.5 bg-oc-outline-variant/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      passwordStrength === 'strong'
                        ? 'w-full bg-green-500'
                        : passwordStrength === 'medium'
                          ? 'w-2/3 bg-yellow-500'
                          : 'w-1/3 bg-oc-error'
                    }`}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${
                    passwordStrength === 'strong'
                      ? 'text-green-600'
                      : passwordStrength === 'medium'
                        ? 'text-yellow-600'
                        : 'text-oc-error'
                  }`}
                >
                  {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                </span>
              </div>
            )}
            <p className="auth-card-subtitle px-1">
              12+ chars with uppercase, lowercase, numbers &amp; special characters
            </p>
          </div>

          <AuthInputField
            id="confirmPassword"
            label="Confirm Password"
            icon="lock"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            disabled={loading}
            staggerClass="stagger-3"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="auth-card-subtitle text-oc-error px-1">Passwords do not match</p>
          )}

          <div className="auth-btn-wrap staggered-child stagger-4">
            <AuthGradientButton
              loading={loading}
              loadingText="Resetting…"
              disabled={loading || passwordStrength === 'weak'}
            >
              Reset Password
            </AuthGradientButton>
          </div>

          <AuthCardBottomActions />
        </form>

        <div className="text-center staggered-child stagger-5" style={{ marginTop: 'var(--auth-gap-section)' }}>
          <Link href="/auth/login" className="auth-card-subtitle font-semibold text-oc-primary hover:underline">
            ← Back to login
          </Link>
        </div>
      </AuthGlassCard>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card text-center animate-pulse">
          <div className="h-8 w-8 bg-oc-surface-container rounded-full mx-auto" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

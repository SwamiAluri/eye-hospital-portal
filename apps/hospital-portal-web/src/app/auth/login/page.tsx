'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, initializeApi, getApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Smartphone, Key } from 'lucide-react';
import { useAuthTenants, DEFAULT_LOGIN_TENANT_ID } from '@/components/auth/useAuthTenants';
import { useAuthTenant } from '@/components/auth/AuthTenantContext';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import {
  AuthGlassCard,
  AuthAlert,
  AuthGradientButton,
} from '@/components/auth/AuthGlassCard';
import {
  AuthSelectField,
  AuthInputField,
  AuthMfaHintBanner,
  AuthCardBottomActions,
} from '@/components/auth/AuthFormFields';
import { AuthDevPanel } from '@/components/auth/AuthDevPanel';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { setTenantName } = useAuthTenant();

  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123!');
  const { tenants, tenantId, setTenantId, selectedTenant, isLoading: isLoadingTenants } =
    useAuthTenants();

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'sms' | 'email' | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const expiredMsg = sessionStorage.getItem('auth_expired_message');
    if (expiredMsg) {
      setError(expiredMsg);
      sessionStorage.removeItem('auth_expired_message');
    }
    localStorage.clear();
    useAuthStore.getState().logout();
  }, [mounted]);

  useEffect(() => {
    setTenantName(selectedTenant?.name ?? null);
  }, [selectedTenant, setTenantName]);

  const handleCreateAdmin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const api = getApi();
      const createTenantId = tenantId || DEFAULT_LOGIN_TENANT_ID;
      await api.post(`/auth/debug/create-admin?tenantId=${createTenantId}`);
      alert('Admin user created successfully! Email: admin@hospital.com, Password: Admin@123456');
      setEmail('admin@hospital.com');
      setPassword('Admin@123456');
      setTenantId(createTenantId);
    } catch (err: unknown) {
      console.error('Create admin error:', err);
      const apiErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      setError(
        apiErr.response?.data?.message ||
          apiErr.response?.data?.error ||
          apiErr.message ||
          'Failed to create admin user. Check backend logs.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      initializeApi();
      const response = await authApi.login(email, password, tenantId);
      const { data } = response;

      if (!data.success) {
        setError(data.message || 'Login failed');
        return;
      }

      if (data.requiresMfa) {
        setMfaRequired(true);
        setMfaUserId(data.userId || '');
        setMfaMethod(data.mfaMethod || 'authenticator');
        setIsLoading(false);
        return;
      }

      setAuth(
        data.accessToken,
        data.refreshToken,
        data.user,
        data.roles,
        data.permissions,
        tenantId,
        data.mustChangePassword
      );

      router.push(data.mustChangePassword ? '/auth/change-password' : '/dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const apiErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      let errorMessage = 'An error occurred during login. ';
      if (apiErr.response?.data?.message) {
        errorMessage += apiErr.response.data.message;
      } else if (apiErr.response?.data?.error) {
        errorMessage += apiErr.response.data.error;
      } else if (apiErr.message) {
        errorMessage += apiErr.message;
      }
      if (errorMessage.includes('An error occurred during login') && !errorMessage.includes('user')) {
        errorMessage += ' (Database may be empty. Try "Create Admin User" below in dev mode.)';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';
      const response = await fetch(`${apiUrl}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          userId: mfaUserId,
          code: mfaCode,
          method: useBackupCode ? 'backup' : 'totp',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid MFA code');
      }

      const data = await response.json();
      setAuth(
        data.accessToken,
        data.refreshToken,
        data.user,
        data.roles,
        data.permissions,
        tenantId,
        data.mustChangePassword
      );
      router.push(data.mustChangePassword ? '/auth/change-password' : '/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify MFA code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaCode('');
    setUseBackupCode(false);
    setMfaUserId('');
    setPassword('');
  };

  if (!mounted) {
    return (
      <div className="auth-panel-stack">
        <div className="glass-card animate-pulse">
          <div className="h-6 bg-oc-surface-container rounded w-1/3 mb-4" />
          <div className="auth-form">
            <div className="h-10 bg-oc-surface-container rounded-xl" />
            <div className="h-10 bg-oc-surface-container rounded-xl" />
            <div className="h-10 bg-oc-surface-container rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthBrandHeader />

      <div className="auth-panel-stack">
        <AuthGlassCard
          title={mfaRequired ? 'Two-Factor Verification' : 'Clinical Sign In'}
          subtitle={
            mfaRequired
              ? selectedTenant
                ? `Verifying access for ${selectedTenant.name}`
                : 'Enter your verification code to continue'
              : selectedTenant
                ? `Signing in to ${selectedTenant.name}`
                : 'Enter your credentials to access the care portal.'
          }
          showSecureBadge={!mfaRequired}
        >
          {!mfaRequired ? (
            <form onSubmit={handleLogin} className="auth-form">
              {error && <AuthAlert variant="error">{error}</AuthAlert>}

              <AuthSelectField
                id="hospital"
                label="Hospital"
                icon="clinical_notes"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                loading={isLoadingTenants}
                loadingText="Loading hospitals…"
                required
                disabled={isLoadingTenants}
              >
                <option value="">Select your hospital</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </AuthSelectField>

              <AuthInputField
                id="email"
                label="Medical ID / Email"
                icon="badge"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Dr. Smith or your@email.com"
                required
                staggerClass="stagger-3"
              />

              <AuthInputField
                id="password"
                label="Security Password"
                icon="lock"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                staggerClass="stagger-4"
                labelExtra={
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-semibold tracking-wide text-oc-primary/80 hover:text-oc-primary uppercase"
                  >
                    Forgot?
                  </Link>
                }
              />

              <AuthMfaHintBanner />

              <div className="auth-btn-wrap staggered-child stagger-5">
                <AuthGradientButton loading={isLoading} loadingText="Signing in…">
                  Authorize &amp; Sign In
                </AuthGradientButton>
              </div>

              <AuthCardBottomActions showEmergency />
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} className="auth-form">
              <div className="text-center staggered-child stagger-1">
                <div
                  className="rounded-full bg-oc-primary/10 flex items-center justify-center mx-auto mb-2"
                  style={{
                    width: 'clamp(2.5rem, 6vh, 3.5rem)',
                    height: 'clamp(2.5rem, 6vh, 3.5rem)',
                  }}
                >
                  {useBackupCode ? (
                    <Key className="text-oc-primary" style={{ width: 'clamp(1.25rem, 3vh, 1.75rem)', height: 'clamp(1.25rem, 3vh, 1.75rem)' }} />
                  ) : (
                    <Smartphone className="text-oc-primary" style={{ width: 'clamp(1.25rem, 3vh, 1.75rem)', height: 'clamp(1.25rem, 3vh, 1.75rem)' }} />
                  )}
                </div>
                <p className="auth-card-subtitle">
                  {useBackupCode
                    ? 'Enter one of your backup codes'
                    : mfaMethod === 'authenticator'
                      ? 'Enter the code from your authenticator app'
                      : `A code has been sent to your ${mfaMethod}`}
                </p>
              </div>

              {error && <AuthAlert variant="error">{error}</AuthAlert>}

              <AuthInputField
                id="mfa-code"
                label={useBackupCode ? 'Backup Code' : 'Authentication Code'}
                icon="shield_person"
                type="text"
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, '').slice(0, useBackupCode ? 8 : 6))
                }
                placeholder={useBackupCode ? '12345678' : '000000'}
                maxLength={useBackupCode ? 8 : 6}
                required
                autoFocus
                staggerClass="stagger-2"
                inputClassName="text-center text-2xl tracking-widest"
              />

              <div className="auth-btn-wrap staggered-child stagger-3">
                <AuthGradientButton
                  loading={isLoading}
                  loadingText="Verifying…"
                  disabled={isLoading || mfaCode.length < (useBackupCode ? 8 : 6)}
                >
                  Verify &amp; Sign In
                </AuthGradientButton>
              </div>

              <div className="text-center auth-form staggered-child stagger-4" style={{ gap: '0.375rem' }}>
                {!useBackupCode && (
                  <button
                    type="button"
                    onClick={() => setUseBackupCode(true)}
                    className="text-sm text-oc-primary hover:underline"
                  >
                    Use a backup code instead
                  </button>
                )}
                {useBackupCode && (
                  <button
                    type="button"
                    onClick={() => setUseBackupCode(false)}
                    className="text-sm text-oc-primary hover:underline"
                  >
                    Use authenticator code
                  </button>
                )}
                <div>
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm text-oc-on-surface-variant hover:text-oc-on-surface"
                  >
                    Back to login
                  </button>
                </div>
              </div>

              <AuthCardBottomActions />
            </form>
          )}
        </AuthGlassCard>

        {!mfaRequired && (
          <AuthDevPanel
            onCreateAdmin={handleCreateAdmin}
            isLoading={isLoading}
            demoCredentials={`admin@test.com · Admin123! · ${selectedTenant?.name ?? 'India Eye Hospital Network'}`}
          />
        )}
      </div>
    </>
  );
}

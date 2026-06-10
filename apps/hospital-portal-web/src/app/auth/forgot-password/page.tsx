'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApi } from '@/lib/api';
import { useAuthTenants } from '@/components/auth/useAuthTenants';
import { useAuthTenant } from '@/components/auth/AuthTenantContext';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import {
  AuthGlassCard,
  AuthAlert,
  AuthGradientButton,
} from '@/components/auth/AuthGlassCard';
import { AuthSelectField, AuthInputField, AuthCardBottomActions } from '@/components/auth/AuthFormFields';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { tenants, tenantId, setTenantId, selectedTenant, isLoading: isLoadingTenants } =
    useAuthTenants();
  const { setTenantName } = useAuthTenant();

  useEffect(() => {
    setTenantName(selectedTenant?.name ?? null);
  }, [selectedTenant, setTenantName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const api = getApi();
      await api.post('/auth/forgot-password', { email, tenantId });
      setMessage({
        type: 'success',
        text: 'If your email exists in our system, you will receive a password reset link shortly. Please check your inbox.',
      });
      setEmail('');
    } catch {
      setMessage({
        type: 'success',
        text: 'If your email exists in our system, you will receive a password reset link shortly. Please check your inbox.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthBrandHeader />

      <div className="auth-panel-stack">
        <AuthGlassCard
          title="Forgot Password?"
          subtitle={
            selectedTenant
              ? `Reset access for ${selectedTenant.name}`
              : "No worries, we'll send you reset instructions."
          }
        >
          {message && (
            <div className="mb-4">
              <AuthAlert variant={message.type === 'success' ? 'success' : 'error'}>
                {message.text}
              </AuthAlert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <AuthSelectField
              id="hospital"
              label="Hospital"
              icon="clinical_notes"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              loading={isLoadingTenants}
              loadingText="Loading hospitals…"
              required
              disabled={isLoadingTenants || loading}
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              staggerClass="stagger-3"
            />

            <div className="auth-btn-wrap staggered-child stagger-4">
              <AuthGradientButton loading={loading} loadingText="Sending…">
                Send Reset Instructions
              </AuthGradientButton>
            </div>

            <AuthCardBottomActions />
          </form>

          <div className="text-center staggered-child stagger-5" style={{ marginTop: 'var(--auth-gap-section)' }}>
            <Link
              href="/auth/login"
              className="auth-card-subtitle font-semibold text-oc-primary hover:underline inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to login
            </Link>
          </div>
        </AuthGlassCard>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import {
  AuthGlassCard,
  AuthAlert,
  AuthGradientButton,
} from '@/components/auth/AuthGlassCard';
import { AuthInputField, AuthCardBottomActions } from '@/components/auth/AuthFormFields';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { mustChangePassword, clearMustChangePassword, user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pwd: string) => {
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*]/.test(pwd);
    const isLongEnough = pwd.length >= 12;

    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('All fields are required');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!validatePassword(newPassword)) {
        setError(
          'Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters'
        );
        return;
      }

      if (currentPassword === newPassword) {
        setError('New password must be different from current password');
        return;
      }

      await authApi.changePassword(currentPassword, newPassword);

      setSuccess('Password changed successfully!');
      clearMustChangePassword();

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthBrandHeader />

      <div className="auth-panel-stack">
        <AuthGlassCard
          title="Change Password"
          subtitle={
            mustChangePassword
              ? 'You must change your password before accessing the system'
              : user?.email
                ? `Update password for ${user.email}`
                : 'Update your security password'
          }
        >
          <form onSubmit={handleChangePassword} className="auth-form">
            {error && <AuthAlert variant="error">{error}</AuthAlert>}
            {success && <AuthAlert variant="success">{success}</AuthAlert>}

            <AuthInputField
              id="currentPassword"
              label="Current Password"
              icon="lock"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              staggerClass="stagger-2"
            />

            <AuthInputField
              id="newPassword"
              label="New Password"
              icon="lock"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              staggerClass="stagger-3"
            />
            <p className="auth-card-subtitle px-1 staggered-child stagger-3" style={{ marginTop: '-0.25rem' }}>
              12+ characters with uppercase, lowercase, numbers, and special characters
            </p>

            <AuthInputField
              id="confirmPassword"
              label="Confirm Password"
              icon="lock"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              staggerClass="stagger-4"
            />

            <div className="auth-btn-wrap staggered-child stagger-5">
              <AuthGradientButton loading={isLoading} loadingText="Changing Password…">
                Change Password
              </AuthGradientButton>
            </div>

            <AuthCardBottomActions />
          </form>
        </AuthGlassCard>
      </div>
    </>
  );
}

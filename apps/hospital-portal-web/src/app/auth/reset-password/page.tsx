'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApi } from '@/lib/api';

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

  // Validate token on mount
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
          setMessage({ type: 'error', text: response.data.message || 'Invalid or expired reset token' });
        }
      } catch (error: any) {
        console.error('Token validation error:', error);
        setTokenValid(false);
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.message || 'Invalid or expired reset token' 
        });
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Check password strength
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

    // Client-side validation
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
      setMessage({ type: 'error', text: 'Password is too weak. Please include uppercase, lowercase, numbers, and special characters.' });
      setLoading(false);
      return;
    }

    try {
      const api = getApi();
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      });

      setMessage({ type: 'success', text: response.data.message || 'Password reset successful!' });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login?message=Password reset successful. Please login with your new password.');
      }, 3000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to reset password. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="w-full text-center py-12">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{borderColor:'#10b981', borderTopColor:'transparent'}}></div>
        <p className="mt-4 text-sm text-gray-500">Validating reset link…</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8 text-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{backgroundColor:'rgba(239,68,68,0.1)'}}>
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
          <p className="text-sm text-gray-500 mb-6">{message?.text || 'This password reset link is invalid or has expired.'}</p>
          <Link
            href="/auth/forgot-password"
            className="inline-block py-2.5 px-6 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{backgroundColor:'#10b981'}}
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor:'rgba(16,185,129,0.1)'}}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'#10b981'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
          <p className="text-sm text-gray-500 mt-1">For: {userEmail}</p>
        </div>

        {message && (
          <div className={`mb-5 p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              placeholder="Enter new password"
              disabled={loading}
            />
            {newPassword && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${
                    passwordStrength === 'strong' ? 'w-full bg-green-500' :
                    passwordStrength === 'medium' ? 'w-2/3 bg-yellow-500' :
                    'w-1/3 bg-red-500'
                  }`} />
                </div>
                <span className={`text-xs font-medium ${
                  passwordStrength === 'strong' ? 'text-green-600' :
                  passwordStrength === 'medium' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">12+ chars with uppercase, lowercase, numbers &amp; special characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              placeholder="Confirm new password"
              disabled={loading}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || passwordStrength === 'weak'}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{backgroundColor:'#10b981'}}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.backgroundColor='#059669'; }}
            onMouseLeave={e => { if(!loading) e.currentTarget.style.backgroundColor='#10b981'; }}
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm font-medium transition-colors" style={{color:'#10b981'}}>
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full text-center py-12">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{borderColor:'#10b981', borderTopColor:'transparent'}}></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

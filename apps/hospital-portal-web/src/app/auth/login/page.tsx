'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, initializeApi, getApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import axios from 'axios';
import { Loader2, Smartphone, Key } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  tenantCode: string;
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123!');
  const [tenantId, setTenantId] = useState('155fe198-6ae5-4a01-9254-ead5b427247e');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  
  // MFA challenge states
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'sms' | 'email' | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [temporaryToken, setTemporaryToken] = useState('');
  const [mfaUserId, setMfaUserId] = useState('');

  // Clear any old auth state on mount
  useEffect(() => {
    // Clear localStorage to ensure fresh login
    if (typeof window !== 'undefined') {
      console.log('ðŸ§¹ Login page: Clearing old auth state');
      localStorage.clear();
      // Also clear the auth store
      useAuthStore.getState().logout();
    }
  }, []);

  // Fetch tenants on component mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';
        console.log('Fetching tenants from:', API_BASE_URL);
        
        // Try database first, fallback to mock data
        let response;
        try {
          response = await axios.get(`${API_BASE_URL}/tenants/debug/codes/db`, {
            timeout: 3000
          });
          console.log('Database tenants response:', response.data);
        } catch (dbError) {
          console.log('Database tenants not available, using mock data');
          response = await axios.get(`${API_BASE_URL}/tenants/debug/codes`, {
            timeout: 3000
          });
          console.log('Mock tenants response:', response.data);
        }
        
        // Check multiple possible response formats
        let tenantsList = [];
        if (response.data && Array.isArray(response.data.tenants)) {
          tenantsList = response.data.tenants;
        } else if (response.data && Array.isArray(response.data)) {
          tenantsList = response.data;
        }
        
        console.log('Parsed tenants list:', tenantsList);
        
        if (tenantsList.length > 0) {
          setTenants(tenantsList);
          setTenantId(tenantsList[0].id);
          console.log('Set tenants successfully:', tenantsList.length);
        } else {
          throw new Error('No tenants found in response');
        }
      } catch (err) {
        console.error('Error fetching tenants:', err);
        // Fallback to India Eye Hospital Network (the actual tenant in database)
        const fallbackTenants = [
          { id: '155fe198-6ae5-4a01-9254-ead5b427247e', name: 'India Eye Hospital Network', tenantCode: 'INDIA_EYE_NET' }
        ];
        setTenants(fallbackTenants);
        setTenantId(fallbackTenants[0].id);
        console.log('Using fallback tenant (India Eye Hospital Network)');
      } finally {
        setIsLoadingTenants(false);
      }
    };

    fetchTenants();
  }, []);

  const handleCreateAdmin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const api = getApi();
      
      // Use the selected tenant or default to India Eye Hospital Network
      const createTenantId = tenantId || '155fe198-6ae5-4a01-9254-ead5b427247e';
      
      const response = await api.post(`/auth/debug/create-admin?tenantId=${createTenantId}`);
      
      alert('Admin user created successfully! Email: admin@hospital.com, Password: Admin@123456');
      
      // Pre-fill the credentials
      setEmail('admin@hospital.com');
      setPassword('Admin@123456');
      setTenantId(createTenantId);
      
    } catch (err: any) {
      console.error('Create admin error:', err);
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error
        || err.message 
        || 'Failed to create admin user. Check backend logs.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Initialize API with tenant ID
      initializeApi();

      console.log('Attempting login with:', { email, password, tenantId });
      const response = await authApi.login(email, password, tenantId);
      console.log('Login response:', response);
      const { data } = response;
      console.log('Login data:', data);

      if (!data.success) {
        console.log('Login failed - no success flag');
        setError(data.message || 'Login failed');
        return;
      }

      // Check if MFA is required
      if (data.requiresMfa) {
        console.log('MFA required for this user, userId:', data.userId);
        setMfaRequired(true);
        setMfaUserId(data.userId || '');
        setMfaMethod(data.mfaMethod || 'authenticator');
        setTemporaryToken(data.temporaryToken || '');
        setIsLoading(false);
        return;
      }

      console.log('Login successful, calling setAuth...');
      // Store auth state
      setAuth(
        data.accessToken,
        data.refreshToken,
        data.user,
        data.roles,
        data.permissions,
        tenantId,
        data.mustChangePassword
      );

      console.log('Auth state set, checking mustChangePassword:', data.mustChangePassword);
      // Redirect based on must change password flag
      if (data.mustChangePassword) {
        console.log('Redirecting to change password');
        router.push('/auth/change-password');
      } else {
        console.log('Redirecting to dashboard');
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'An error occurred during login. ';
      
      if (err.response?.data?.message) {
        errorMessage += err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      }
      
      // Add helpful hint if generic error
      if (errorMessage.includes('An error occurred during login') && !errorMessage.includes('user')) {
        errorMessage += ' (Database may be empty. Try clicking "Create Admin User" below.)';
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

      console.log('Verifying MFA with userId:', mfaUserId, 'code:', mfaCode);
      const response = await fetch(`${apiUrl}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({
          userId: mfaUserId,
          code: mfaCode,
          method: useBackupCode ? 'backup' : 'totp'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid MFA code');
      }

      const data = await response.json();

      // Store auth state
      setAuth(
        data.accessToken,
        data.refreshToken,
        data.user,
        data.roles,
        data.permissions,
        tenantId,
        data.mustChangePassword
      );

      // Redirect to dashboard
      if (data.mustChangePassword) {
        router.push('/auth/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Failed to verify MFA code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaCode('');
    setUseBackupCode(false);
    setTemporaryToken('');
    setMfaUserId('');
    setPassword('');
  };

  return (
    <main id="main-content" className="w-full">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Mobile-only logo */}
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#0f1e3c' }}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Hospital Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to access the portal</p>
        </div>

        {!mfaRequired ? (
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Tenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Hospital / Tenant
              </label>
              {isLoadingTenants ? (
                <div className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm">
                  Loading tenantsâ€¦
                </div>
              ) : tenants.length > 0 ? (
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                  style={{ '--tw-ring-color': '#10b981' } as React.CSSProperties}
                  required
                >
                  <option value="">Select your hospital</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Enter your hospital tenant ID"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  required
                />
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium transition-colors"
                  style={{ color: '#10b981' }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#10b981' }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#059669'; }}
              onMouseLeave={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#10b981'; }}
            >
              {isLoading ? 'Signing inâ€¦' : 'Sign in'}
            </button>

            {/* Dev helper */}
            <button
              type="button"
              onClick={handleCreateAdmin}
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creatingâ€¦' : 'Create Admin User (Dev Only)'}
            </button>
          </form>
        ) : (
          /* MFA form */
          <form onSubmit={handleVerifyMfa} className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
                {useBackupCode
                  ? <Key className="w-7 h-7" style={{ color: '#10b981' }} />
                  : <Smartphone className="w-7 h-7" style={{ color: '#10b981' }} />
                }
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {useBackupCode
                  ? 'Enter one of your backup codes'
                  : mfaMethod === 'authenticator'
                    ? 'Enter the code from your authenticator app'
                    : `A code has been sent to your ${mfaMethod}`
                }
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {useBackupCode ? 'Backup Code' : 'Authentication Code'}
              </label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, useBackupCode ? 8 : 6))}
                placeholder={useBackupCode ? '12345678' : '000000'}
                maxLength={useBackupCode ? 8 : 6}
                required
                autoFocus
                className="w-full px-3 py-3 border border-gray-200 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || mfaCode.length < (useBackupCode ? 8 : 6)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#10b981' }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#059669'; }}
              onMouseLeave={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#10b981'; }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifyingâ€¦
                </>
              ) : (
                'Verify &amp; Sign in'
              )}
            </button>

            <div className="text-center space-y-2">
              {!useBackupCode && (
                <button type="button" onClick={() => setUseBackupCode(true)} className="text-sm transition-colors" style={{ color: '#10b981' }}>
                  Use a backup code instead
                </button>
              )}
              {useBackupCode && (
                <button type="button" onClick={() => setUseBackupCode(false)} className="text-sm transition-colors" style={{ color: '#10b981' }}>
                  Use authenticator code
                </button>
              )}
              <div>
                <button type="button" onClick={handleBackToLogin} className="text-sm text-gray-500 hover:text-gray-700">
                  Back to login
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Demo credentials */}
      {!mfaRequired && (
        <div className="mt-4 w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs text-blue-600">
            <strong>Demo:</strong> admin@test.com Â· Admin123! Â· India Eye Hospital Network
          </p>
        </div>
      )}
    </main>
  );
}

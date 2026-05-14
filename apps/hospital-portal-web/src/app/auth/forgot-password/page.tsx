'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // For demo: hardcoded tenant - in production this could be a dropdown
  const tenantId = '155fe198-6ae5-4a01-9254-ead5b427247e'; // India Eye Hospital Network

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const api = getApi();
      await api.post('/auth/forgot-password', {
        email,
        tenantId
      });

      setMessage({
        type: 'success',
        text: 'If your email exists in our system, you will receive a password reset link shortly. Please check your inbox.'
      });
      setEmail('');
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      // Even on error, don't reveal if email exists (security)
      setMessage({
        type: 'success',
        text: 'If your email exists in our system, you will receive a password reset link shortly. Please check your inbox.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor:'rgba(16,185,129,0.1)'}}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'#10b981'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
          <p className="text-sm text-gray-500 mt-1">No worries, we'll send you reset instructions.</p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-5 p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{backgroundColor:'#10b981'}}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.backgroundColor='#059669'; }}
            onMouseLeave={e => { if(!loading) e.currentTarget.style.backgroundColor='#10b981'; }}
          >
            {loading ? 'SendingÃ¢â‚¬Â¦' : 'Send Reset Instructions'}
          </button>
        </form>

        {/* Back to Login */}
        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm font-medium transition-colors" style={{color:'#10b981'}}>
            &larr; Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

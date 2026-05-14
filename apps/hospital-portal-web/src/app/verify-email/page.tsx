'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Mail, XCircle } from 'lucide-react';
import { getApi } from '@/lib/api';

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setError('Invalid verification link. Token is missing.');
        setVerifying(false);
        return;
      }

      try {
        const api = getApi();
        
        // Step 1: Validate token with notification service
        const notificationResponse = await api.post('/activation/verify-email', {
          token,
        });

        if (notificationResponse.data.success) {
          const { email: userEmail, userId } = notificationResponse.data;
          setEmail(userEmail);

          // Step 2: Mark email as verified in auth service
          const authApi = getApi();
          authApi.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';
          
          const authResponse = await authApi.post(`/users/${userId}/verify-email`);

          if (authResponse.data.success) {
            setVerified(true);
          } else {
            setError('Failed to update verification status. Please contact administrator.');
          }
        } else {
          setError(notificationResponse.data.error || 'Email verification failed');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Email verification failed. Please try again.');
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{backgroundColor:'rgba(16,185,129,0.1)'}}>
            <Mail className="w-6 h-6" style={{color:'#10b981'}} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
          <p className="text-sm text-gray-500 mb-4">Please wait while we verify your email address...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-transparent mx-auto" style={{borderColor:'#10b981',borderTopColor:'transparent'}}></div>
        </div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor:'rgba(16,185,129,0.1)'}}>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-sm text-gray-500">
              Your email address <strong className="text-gray-700">{email}</strong> has been successfully verified.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Next Steps:</h3>
            <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
              <li>Check your email for the activation link</li>
              <li>Click "Activate Now" to complete account setup</li>
              <li>Enter your activation code</li>
              <li>Set your password and configure MFA</li>
            </ol>
          </div>

          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{backgroundColor:'#10b981'}}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor:'rgba(239,68,68,0.1)'}}>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-sm text-red-500 mb-5">{error}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">What to do:</h3>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            <li>Request a new verification email</li>
            <li>Make sure you're using the latest email</li>
            <li>Verification links expire after 24 hours</li>
            <li>Contact administrator if issue persists</li>
          </ul>
        </div>

        <button
          onClick={() => router.push('/login')}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{backgroundColor:'#10b981'}}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{borderColor:'#10b981',borderTopColor:'transparent'}} />
      </div>
    }>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

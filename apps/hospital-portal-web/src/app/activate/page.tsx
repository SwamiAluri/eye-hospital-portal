'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, Lock, Shield, CheckCircle, Smartphone, Briefcase } from 'lucide-react';
import { getApi } from '@/lib/api';

type Step = 'verify-code' | 'set-password' | 'professional-info' | 'accept-terms' | 'setup-mfa' | 'complete';

function ActivatePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<Step>('verify-code');
  const [email, setEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedHipaa, setAcceptedHipaa] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'sms'>('totp');
  const [qrCode, setQrCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [tokenValidated, setTokenValidated] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  
  // Professional information (for doctors, nurses)
  const [licenseNumber, setLicenseNumber] = useState('');
  const [npiNumber, setNpiNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [requiresProfessionalInfo, setRequiresProfessionalInfo] = useState(false);

  /** Auth API headers for anonymous activation — tenant from token validation, never user-typed. */
  const activationAuthHeaders = () =>
    tenantId ? { 'X-Tenant-ID': tenantId } : undefined;

  // Validate activation token on page load
  useEffect(() => {
    const validateToken = async () => {
      const emailParam = searchParams.get('email');
      const tokenParam = searchParams.get('token');
      
      if (emailParam) {
        setEmail(emailParam);
      }
      
      if (!tokenParam) {
        setError('Invalid activation link. Token is missing.');
        setValidatingToken(false);
        return;
      }
      
      try {
        // Call notification service to validate the activation token
        const notificationServiceUrl = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:7073';
        const response = await fetch(`${notificationServiceUrl}/api/activation/validate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: tokenParam,
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          setTokenValidated(true);
          setUserId(data.userId);
          setEmail(data.email);
          if (data.tenantId) {
            setTenantId(String(data.tenantId));
          }
        } else {
          setError(data.error || 'Invalid or expired activation link');
        }
      } catch (err: any) {
        console.error('Token validation error:', err);
        setError(err.message || 'Activation link validation failed. Please request a new activation email.');
      } finally {
        setValidatingToken(false);
      }
    };
    
    validateToken();
  }, [searchParams]);

  const handleSendVerificationEmail = async () => {
    setLoading(true);
    setError('');
    
    try {
      const api = getApi();
      await api.post('/activation/send-email-verification', {
        email,
        userId,
      });
      
      alert('Verification email sent! Please check your inbox and click the verification link.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const notificationServiceUrl = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:7073';
      const response = await fetch(`${notificationServiceUrl}/api/activation/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: email,
          otp: activationCode,
        }),
      });
      
      const data = await response.json();
      console.log('OTP Verification Response:', { status: response.status, ok: response.ok, data });

      // Backend sends PascalCase properties (Success, Message, UserId)
      if (response.ok && data.Success) {
        console.log('OTP verified successfully, proceeding to password setup');
        setUserId(data.UserId);
        // User role will be determined later if needed
        // For now, skip professional info requirement check
        setStep('set-password');
      } else {
        console.error('OTP verification failed:', data);
        setError(data.Message || 'Invalid activation code. Please try again.');
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Invalid activation code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      const notificationServiceUrl = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:7073';
      const tokenParam = searchParams.get('token');
      const emailParam = searchParams.get('email');
      
      // First, validate the token to get userId
      const validateResponse = await fetch(`${notificationServiceUrl}/api/activation/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenParam,
        }),
      });
      
      const validateData = await validateResponse.json();
      
      console.log('Validate token response:', validateData);
      
      if (!validateResponse.ok || !validateData.success) {
        setError('Invalid activation link. Please request a new activation email.');
        return;
      }
      
      console.log('Sending OTP with:', {
        userId: validateData.userId,
        tenantId: validateData.tenantId,
        deliveryMethod: 'email',
        recipient: validateData.email || emailParam,
      });
      
      // Now send OTP with userId, tenantId, email, and delivery method
      const response = await fetch(`${notificationServiceUrl}/api/activation/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: validateData.userId,
          tenantId: validateData.tenantId,
          deliveryMethod: 'email',
          recipient: validateData.email || emailParam,
        }),
      });
      
      const data = await response.json();
      
      console.log('Send OTP response:', { status: response.status, ok: response.ok, data });
      
      // Backend sends PascalCase properties (Success, Message)
      if (response.ok && (data.Success || data.success)) {
        setActivationCode('');
        setError('');
        alert('A new activation code has been sent to your email.');
      } else {
        setError(data.error || data.Message || 'Failed to resend activation code. Please try again.');
      }
    } catch (err: any) {
      console.error('Resend OTP error:', err);
      setError('Failed to resend activation code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    setLoading(true);

    try {
      const api = getApi();
      const response = await api.post(
        `/users/${userId}/set-activation-password`,
        { password: password },
        { headers: activationAuthHeaders() },
      );
      
      console.log('Set password response:', { status: response.status, data: response.data });
      
      // Check for both PascalCase and camelCase response
      if (response.data.Success || response.data.success) {
        // Route based on role requirements
        if (requiresProfessionalInfo) {
          setStep('professional-info');
        } else {
          setStep('accept-terms');
        }
      } else {
        const errorMsg = response.data.Message || response.data.message || 'Failed to set password. Please try again.';
        const errors = response.data.Errors ? '\n' + response.data.Errors.join('\n') : '';
        setError(errorMsg + errors);
      }
    } catch (err: any) {
      console.error('Password setup error:', err);
      console.error('Error response:', err.response);
      
      // Show detailed validation errors if available
      const errors = err.response?.data?.Errors;
      const errorMessage = errors && errors.length > 0 
        ? errors.join('\n')
        : (err.response?.data?.Message || err.response?.data?.message || 'Failed to set password. Please try again.');
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleProfessionalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!licenseNumber || !specialization) {
      setError('License number and specialization are required.');
      return;
    }

    setLoading(true);

    try {
      const api = getApi();
      await api.post(
        `/users/${userId}/professional-info`,
        {
          licenseNumber,
          npiNumber: npiNumber || null,
          specialization,
          registrationDate: registrationDate || null,
        },
        { headers: activationAuthHeaders() },
      );
      
      setStep('accept-terms');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save professional information.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptedTerms || !acceptedPrivacy || !acceptedHipaa) {
      setError('You must accept all terms and policies to continue.');
      return;
    }

    setLoading(true);

    try {
      const api = getApi();
      await api.post(
        `/users/${userId}/accept-terms`,
        {
          acceptedTerms,
          acceptedPrivacy,
          acceptedHipaa,
          acceptedAt: new Date().toISOString(),
        },
        { headers: activationAuthHeaders() },
      );

      // MFA is now MANDATORY
      setStep('setup-mfa');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const notificationServiceUrl = process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:7073';
      
      if (mfaMethod === 'totp') {
        // If QR code exists and user entered code, verify it
        if (qrCode && totpCode) {
          const verifyResponse = await fetch(`${notificationServiceUrl}/api/mfa/enroll/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              UserId: userId,
              Code: totpCode,
              Method: 'totp',
            }),
          });

          const verifyText = await verifyResponse.text();
          console.log('TOTP Verification response text:', verifyText);
          
          const verifyData = verifyText ? JSON.parse(verifyText) : {};
          console.log('TOTP Verification data:', verifyData);

          if (!verifyResponse.ok || !(verifyData.Success || verifyData.success)) {
            throw new Error(verifyData.Error || verifyData.error || 'Invalid verification code');
          }

          // Persist authoritative active state in Auth (UI "complete" alone does not activate)
          const api = getApi();
          const completeResp = await api.post(
            `/users/${userId}/complete-activation`,
            {},
            { headers: activationAuthHeaders() },
          );
          if (!(completeResp.data?.success || completeResp.data?.Success)) {
            throw new Error(
              completeResp.data?.message ||
                completeResp.data?.Message ||
                'Failed to finalize account activation'
            );
          }

          setStep('complete');
          return;
        }

        // If no QR code yet, enroll to get QR code
        if (!qrCode) {
          const enrollResponse = await fetch(`${notificationServiceUrl}/api/mfa/enroll/totp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            UserId: userId,  // PascalCase for C# backend
          }),
        });

        console.log('TOTP Enrollment response status:', enrollResponse.status);
        
        // Check if response has content before parsing JSON
        const responseText = await enrollResponse.text();
        console.log('TOTP Enrollment response text:', responseText);
        
        let enrollData;
        try {
          enrollData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          throw new Error(`Server returned invalid response: ${responseText.substring(0, 100)}`);
        }

        console.log('TOTP Enrollment data:', enrollData);

        if (!enrollResponse.ok) {
          throw new Error(enrollData.error || enrollData.message || `Server error: ${enrollResponse.status}`);
        }

        // Check for QR code (handle both PascalCase and camelCase)
        const qrCodeData = enrollData.QrCodeDataUrl || enrollData.qrCodeDataUrl || enrollData.QrCodeUrl || enrollData.qrCodeUrl;
        if (qrCodeData) {
          console.log('QR Code received, length:', qrCodeData.length);
          setQrCode(qrCodeData);
          // Show QR code for user to scan, then they'll enter the code
          return; // Wait for user to scan and enter code
        }
        }
      } else {
        // SMS MFA enrollment is not fully implemented; do not claim activation complete.
        throw new Error('SMS MFA enrollment is not available. Please use Authenticator App (TOTP).');
      }
    } catch (err: any) {
      console.error('MFA setup error:', err);
      setError(err.message || 'Failed to setup MFA. You can configure it later in settings.');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleSkipMfa - MFA is now MANDATORY

  const handleLogin = () => {
    router.push('/auth/login');
  };

  // Show loading state while validating token
  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent mx-auto mb-4" style={{borderColor:'#10b981',borderTopColor:'transparent'}}></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Validating Activation Link</h2>
          <p className="text-sm text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  // Show error if token validation failed
  if (!tokenValidated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-xl mb-4" style={{backgroundColor:'rgba(239,68,68,0.1)'}}>
              <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Activation Link Invalid</h2>
            <p className="text-sm text-red-500 mb-5">{error}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">What to do next:</h3>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>Request a new activation email from your administrator</li>
                <li>Make sure you're using the latest email</li>
                <li>Activation links expire after 48 hours</li>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Account Activation</h1>
          <p className="text-sm text-gray-500 mt-1">HIPAA-Compliant Hospital Portal Setup</p>
        </div>

        {/* Progress Steps - Dynamic based on role */}
        <div className="flex justify-between mb-8 text-xs">
          <div className={`flex flex-col items-center ${step === 'verify-code' ? '' : 'text-gray-400'}`} style={step === 'verify-code' ? {color:'#10b981'} : {}}>
            <Mail className={`w-5 h-5 ${step !== 'verify-code' && 'opacity-40'}`} />
            <span className="mt-1">Verify</span>
          </div>
          <div className={`flex flex-col items-center ${step === 'set-password' ? '' : 'text-gray-400'}`} style={step === 'set-password' ? {color:'#10b981'} : {}}>
            <Lock className={`w-5 h-5 ${!['set-password', 'professional-info', 'accept-terms', 'setup-mfa', 'complete'].includes(step) && 'opacity-40'}`} />
            <span className="mt-1">Password</span>
          </div>
          {requiresProfessionalInfo && (
            <div className={`flex flex-col items-center ${step === 'professional-info' ? '' : 'text-gray-400'}`} style={step === 'professional-info' ? {color:'#10b981'} : {}}>
              <Briefcase className={`w-5 h-5 ${!['professional-info', 'accept-terms', 'setup-mfa', 'complete'].includes(step) && 'opacity-40'}`} />
              <span className="mt-1">Credentials</span>
            </div>
          )}
          <div className={`flex flex-col items-center ${step === 'accept-terms' ? '' : 'text-gray-400'}`} style={step === 'accept-terms' ? {color:'#10b981'} : {}}>
            <CheckCircle className={`w-5 h-5 ${!['accept-terms', 'setup-mfa', 'complete'].includes(step) && 'opacity-40'}`} />
            <span className="mt-1">Terms</span>
          </div>
          <div className={`flex flex-col items-center ${step === 'setup-mfa' ? '' : 'text-gray-400'}`} style={step === 'setup-mfa' ? {color:'#10b981'} : {}}>
            <Shield className={`w-5 h-5 ${!['setup-mfa', 'complete'].includes(step) && 'opacity-40'}`} />
            <span className="mt-1">MFA</span>
          </div>
          <div className={`flex flex-col items-center ${step === 'complete' ? 'text-emerald-500' : 'text-gray-400'}`}>
            <CheckCircle className={`w-5 h-5 ${step !== 'complete' && 'opacity-40'}`} />
            <span className="mt-1">Done</span>
          </div>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Step 1: Verify Activation Code */}
        {step === 'verify-code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activation Code</label>
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.replace(/\s/g, ''))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Check your email for the activation code</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{backgroundColor:'#10b981'}}
            >
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Sending...' : 'Resend Code'}
            </button>
          </form>
        )}

        {/* Step 2: Set Password */}
        {step === 'set-password' && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 12 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Must include uppercase, lowercase, number, and special character
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-xs text-yellow-800">
                <strong>HIPAA Compliance:</strong> Your password will expire in 90 days and must be changed regularly to protect patient data.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{backgroundColor:'#10b981'}}
            >
              {loading ? 'Setting Password…' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 3: Professional Information (for medical staff) */}
        {step === 'professional-info' && (
          <form onSubmit={handleProfessionalInfo} className="space-y-4">
            <div className="text-center mb-4">
              <Briefcase className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Professional Credentials</h3>
              <p className="text-sm text-gray-600">Required for medical staff to verify professional credentials</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical License Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g., MD123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NPI Number <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={npiNumber}
                onChange={(e) => setNpiNumber(e.target.value)}
                placeholder="10-digit National Provider Identifier"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                National Provider Identifier (if applicable)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialization <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g., Cardiology, Pediatrics, General Practice"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registration Date <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Date of professional registration
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>HIPAA Compliance:</strong> Professional credentials are required for healthcare providers to access protected health information (PHI).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{backgroundColor:'#10b981'}}
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 4: Accept Terms & Compliance */}
        {step === 'accept-terms' && (
          <form onSubmit={handleAcceptTerms} className="space-y-4">
            <div className="text-center mb-4">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Legal & Compliance</h3>
              <p className="text-sm text-gray-600">Required for accessing patient health information</p>
            </div>

            <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  required
                />
                <label htmlFor="acceptTerms" className="ml-3 block text-sm text-gray-700">
                  I accept the <a href="/terms" target="_blank" className="text-emerald-600 hover:underline">Terms of Service</a>
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="acceptPrivacy"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  required
                />
                <label htmlFor="acceptPrivacy" className="ml-3 block text-sm text-gray-700">
                  I accept the <a href="/privacy" target="_blank" className="text-emerald-600 hover:underline">Privacy Policy</a>
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="acceptHipaa"
                  checked={acceptedHipaa}
                  onChange={(e) => setAcceptedHipaa(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  required
                />
                <label htmlFor="acceptHipaa" className="ml-3 block text-sm text-gray-700">
                  <strong>I acknowledge HIPAA Security Training requirements:</strong>
                  <ul className="list-disc ml-5 mt-1 text-xs">
                    <li>I will protect patient health information (PHI)</li>
                    <li>I will not share passwords or access credentials</li>
                    <li>I will report any security incidents immediately</li>
                    <li>I understand violations may result in termination and legal action</li>
                  </ul>
                </label>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-xs text-red-800">
                <strong>⚠️ HIPAA Compliance Required:</strong> By checking these boxes, you legally certify your understanding of patient privacy laws and agree to complete required security training within 30 days of activation.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !acceptedTerms || !acceptedPrivacy || !acceptedHipaa}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{backgroundColor:'#10b981'}}
            >
              {loading ? 'Processing…' : 'Accept & Continue to MFA Setup'}
            </button>
          </form>
        )}

        {/* Step 4: Setup MFA (MANDATORY) */}
        {step === 'setup-mfa' && (
          <form onSubmit={handleSetupMfa} className="space-y-4">
            <div className="text-center mb-4">
              <Shield className="w-16 h-16 text-red-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Secure Your Account (Required)</h3>
              <p className="text-sm text-red-600 font-medium">⚠️ MFA is MANDATORY for HIPAA compliance</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mfaMethod"
                  value="totp"
                  checked={mfaMethod === 'totp'}
                  onChange={(e) => setMfaMethod('totp')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Smartphone className="w-5 h-5 ml-3 mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Authenticator App (Recommended)</span>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mfaMethod"
                  value="sms"
                  checked={mfaMethod === 'sms'}
                  onChange={(e) => setMfaMethod('sms')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <Mail className="w-5 h-5 ml-3 mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">SMS Text Message</span>
              </label>
            </div>

            {qrCode && mfaMethod === 'totp' && (
              <div className="mt-4">
                <div className="text-center">
                  <img src={qrCode} alt="QR Code" className="mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-3">Scan this QR code with your authenticator app</p>
                </div>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Enter 6-digit code from app"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  required
                />
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-xs text-yellow-800">
                <strong>HIPAA Requirement:</strong> Multi-factor authentication is mandatory for all users with access to patient health information. You cannot proceed without completing MFA setup.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || (mfaMethod === 'totp' && qrCode && !totpCode)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{backgroundColor:'#10b981'}}
            >
              {loading ? 'Setting up…' : qrCode ? 'Verify & Complete Activation' : 'Setup MFA'}
            </button>
          </form>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto" />
            <h3 className="text-2xl font-bold text-gray-900">Activation Complete!</h3>
            <p className="text-gray-600">
              Your account has been successfully activated. You can now login to the Hospital Portal.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{backgroundColor:'#10b981'}}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{borderColor:'#10b981',borderTopColor:'transparent'}} />
      </div>
    }>
      <ActivatePageContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import OpdBillForm to avoid SSR issues
const OpdBillForm = dynamic(
  () => import('@/components/billing/OpdBillForm'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )}
);

function OpdBillCreateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  const patientId = searchParams.get('patientId') || '';
  const patientName = searchParams.get('patientName') || '';
  const appointmentId = searchParams.get('appointmentId') || '';

  const handleSuccess = (billId: string) => {
    // Redirect to check-in page after bill is finalized
    router.push(`/dashboard/frontdesk/check-in?patientId=${patientId}&appointmentId=${appointmentId}&billId=${billId}`);
  };

  const handleClose = () => {
    router.push('/dashboard/patients');
  };

  if (!patientId || !patientName) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Missing Information</h2>
          <p className="text-gray-600 mb-4">Patient information is required to create a bill.</p>
          <button
            onClick={() => router.push('/dashboard/patients')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-950">
        Collection on this create form is disabled. After the bill is saved, open{' '}
        <Link href="/dashboard/billing/opd" className="underline font-medium">
          /dashboard/billing/opd
        </Link>
        {' '}and use Collect payment (CollectPaymentDrawer).
      </div>
      <OpdBillForm
        patientId={patientId}
        patientName={patientName}
        appointmentId={appointmentId}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function OpdBillCreatePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <OpdBillCreateContent />
    </Suspense>
  );
}
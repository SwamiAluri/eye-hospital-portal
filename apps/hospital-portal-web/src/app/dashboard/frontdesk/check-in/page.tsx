import { Suspense } from 'react';
import CheckInComponent from '@/components/frontdesk/CheckInComponent';

export default function CheckInPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading check-in…</div>}>
        <CheckInComponent />
      </Suspense>
    </div>
  );
}

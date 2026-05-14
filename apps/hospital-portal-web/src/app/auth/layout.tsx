import React from 'react';
import { Building2 } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - navy brand */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-10 flex-shrink-0"
        style={{ backgroundColor: '#0f1e3c' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#10b981' }}>
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Hospital Portal</span>
        </div>

        {/* Center text */}
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Comprehensive<br />Healthcare Management
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            HIPAA-compliant multi-tenant platform for hospitals, clinics, and specialty care centers.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3">
            {['Patient & OPD Management', 'Doctor Desk & Clinical Notes', 'Billing, Pharmacy & Inventory', 'Analytics & Compliance'].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.2)' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" style={{ color: '#10b981' }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          &copy; {new Date().getFullYear()} Hospital Portal. HIPAA Compliant.
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
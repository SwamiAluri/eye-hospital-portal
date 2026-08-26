/**
 * Camp Sponsor Info Widget
 * Displays zero-cost information for camp-sponsored patients
 */

'use client';

import React from 'react';
import { Users, Activity as Heart, CheckCircle, FileText, AlertCircle as Info, Activity as Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { useCounselingSession } from '@/hooks/use-counseling-sessions';
import { toast } from '@/lib/toast';

export default function CampSponsorInfoWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { data: session, isLoading } = useCounselingSession(sessionId || '', {
    enabled: !!sessionId,
  });

  // Mock camp sponsor data (in production, this would come from session or API)
  const campData = {
    sponsorName: 'Rotary Club Eye Care Camp 2026',
    campDate: '2026-02-15',
    campLocation: 'District Hospital, Bangalore',
    registrationNumber: 'CAMP202602150123',
    eligibilityStatus: 'Verified',
    coverageType: 'Full Coverage',
  };

  const requiredDocuments = [
    'Camp Registration Form',
    'Income Certificate (BPL)',
    'Aadhaar Card',
    'Camp Referral Letter',
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-6">
        <Loader className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading camp details...</p>
      </div>
    );
  }

  if (!sessionId || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Users className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No active session</p>
      </div>
    );
  }

  const isCompact = size === 'small' || isMinimized;
  if (isCompact) {
    return (
      <div className="space-y-2 p-3">
        <p className="text-xs text-gray-500 font-medium">Camp Sponsor</p>
        <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
          <p className="text-sm font-semibold text-pink-900 flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Zero Cost - Fully Sponsored
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
          <Users className="h-6 w-6 text-pink-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Camp Sponsored Patient</h3>
          <p className="text-sm text-gray-500">Free eye surgery under community eye care program</p>
        </div>
      </div>

      {/* Zero Cost Banner */}
      <div className="bg-gradient-to-r from-pink-100 to-pink-200 rounded-lg p-6 border-2 border-pink-300">
        <div className="text-center">
          <Heart className="h-12 w-12 text-pink-600 mx-auto mb-3" />
          <h4 className="text-2xl font-bold text-pink-900 mb-2">₹0 - Fully Sponsored</h4>
          <p className="text-sm text-pink-800">All surgery costs covered by camp sponsor</p>
        </div>
      </div>

      {/* Sponsor Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Sponsor Details
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Sponsor Name</span>
            <span className="text-sm font-medium text-gray-900">{campData.sponsorName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Camp Date</span>
            <span className="text-sm font-medium text-gray-900">{new Date(campData.campDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Camp Location</span>
            <span className="text-sm font-medium text-gray-900">{campData.campLocation}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Registration Number</span>
            <span className="text-sm font-medium text-gray-900 font-mono">{campData.registrationNumber}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-600">Eligibility Status</span>
            <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {campData.eligibilityStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Coverage Information */}
      <div className="bg-green-50 border-l-4 border-green-500 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-900 mb-2">Full Coverage Included</p>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• Free cataract surgery (both eyes if required)</li>
              <li>• Standard IOL implant included</li>
              <li>• All pre-operative tests covered</li>
              <li>• Post-operative medications provided</li>
              <li>• 3 follow-up visits included</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Required Documents Checklist */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Required Documents Checklist
        </h4>
        <div className="space-y-2">
          {requiredDocuments.map((doc, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
              <CheckCircle className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">{doc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Package Cost (for reference) */}
      {session?.packageAmount && session.packageAmount > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Package Value (Reference)</span>
            <span className="text-lg font-bold text-blue-600">₹{session.packageAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-gray-600">
            This is the standard package cost. <strong>Patient pays ₹0</strong> - entire amount sponsored by camp organizers.
          </p>
        </div>
      )}

      {/* Billing Note */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-900 mb-1">Billing Note</p>
            <p className="text-xs text-yellow-800">
              All costs billed to camp sponsor account. No payment collection required from patient. 
              Counselor to proceed directly with surgery scheduling after document verification.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            toast.success('Camp eligibility verified', {
              description: 'Proceeding with surgery scheduling',
            });
            onAction?.({
              type: 'CAMP_ELIGIBILITY_CONFIRMED',
              payload: {
                campData,
                packageAmount: session?.packageAmount || 0,
              },
              timestamp: new Date(),
            });
          }}
          className="w-full px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition font-medium flex items-center justify-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Verify Eligibility & Proceed to Scheduling
        </button>

        <button
          onClick={() => {
            const summary = `Camp Patient - ${campData.sponsorName}\nRegistration: ${campData.registrationNumber}\nCost: ₹0 (Fully Sponsored)`;
            navigator.clipboard.writeText(summary);
            toast.success('Camp details copied to clipboard');
          }}
          className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          Copy Camp Details
        </button>
      </div>
    </div>
  );
}

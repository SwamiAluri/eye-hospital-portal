'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Phone, Calendar } from 'lucide-react';
import { patientInsuranceApi, PatientInsurance } from '@/lib/api/patient-insurance.api';

interface InsuranceTabProps {
  patientId: string;
  profileInsurance?: {
    provider?: string | null;
    policyNumber?: string | null;
  };
}

export function InsuranceTab({ patientId, profileInsurance }: InsuranceTabProps) {
  const [policies, setPolicies] = useState<PatientInsurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsurance();
  }, [patientId]);

  const loadInsurance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await patientInsuranceApi.getByPatient(patientId);
      setPolicies(response.data || []);
    } catch (err: any) {
      console.error('Error loading insurance:', err);
      setError('Insurance data is temporarily unavailable.');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await patientInsuranceApi.verify(id);
      loadInsurance();
    } catch (err) {
      console.error('Error verifying insurance:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading insurance...</span>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800',
    pending_verification: 'bg-yellow-100 text-yellow-800',
  };

  const policyTypeLabels: Record<string, string> = {
    primary: 'Primary',
    secondary: 'Secondary',
    tertiary: 'Tertiary',
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {policies.map(policy => (
        <div key={policy.id} className={`border-2 rounded-lg overflow-hidden ${
          policy.policyType === 'primary' ? 'border-indigo-300' :
          policy.policyType === 'secondary' ? 'border-blue-200' : 'border-gray-200'
        }`}>
          {/* Header */}
          <div className={`px-4 py-3 flex items-center justify-between ${
            policy.policyType === 'primary' ? 'bg-indigo-50' :
            policy.policyType === 'secondary' ? 'bg-blue-50' : 'bg-gray-50'
          }`}>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <div>
                <h4 className="font-semibold text-gray-900">{policy.providerName}</h4>
                <p className="text-sm text-gray-500">{policyTypeLabels[policy.policyType] || policy.policyType} Insurance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[policy.status] || 'bg-gray-100'}`}>
                {policy.status?.replace(/_/g, ' ')}
              </span>
              {policy.status === 'pending_verification' && (
                <button onClick={() => handleVerify(policy.id)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verify
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Policy #</span>
                <p className="font-medium">{policy.policyNumber}</p>
              </div>
              {policy.groupNumber && (
                <div>
                  <span className="text-gray-500">Group #</span>
                  <p className="font-medium">{policy.groupNumber}</p>
                </div>
              )}
              {policy.planName && (
                <div>
                  <span className="text-gray-500">Plan</span>
                  <p className="font-medium">{policy.planName}</p>
                </div>
              )}
              {policy.subscriberName && (
                <div>
                  <span className="text-gray-500">Subscriber</span>
                  <p className="font-medium">{policy.subscriberName}</p>
                  {policy.subscriberRelation && <p className="text-xs text-gray-400">{policy.subscriberRelation}</p>}
                </div>
              )}
              {policy.startDate && (
                <div className="flex items-start gap-1">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-500">Coverage Period</span>
                    <p className="font-medium">{new Date(policy.startDate).toLocaleDateString()} - {policy.endDate ? new Date(policy.endDate).toLocaleDateString() : 'Ongoing'}</p>
                  </div>
                </div>
              )}
              {policy.contactPhone && (
                <div className="flex items-start gap-1">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-500">Contact</span>
                    <p className="font-medium">{policy.contactPhone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Financial */}
            {(policy.copayAmount != null || policy.deductibleAmount != null || policy.outOfPocketMax != null) && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Financial Summary</h5>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {policy.copayAmount != null && (
                    <div>
                      <span className="text-gray-500">Copay</span>
                      <p className="font-semibold text-gray-900">${policy.copayAmount.toFixed(2)}</p>
                    </div>
                  )}
                  {policy.deductibleAmount != null && (
                    <div>
                      <span className="text-gray-500">Deductible</span>
                      <p className="font-semibold text-gray-900">${(policy.deductibleMet || 0).toFixed(2)} / ${policy.deductibleAmount.toFixed(2)}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((policy.deductibleMet || 0) / policy.deductibleAmount) * 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                  {policy.outOfPocketMax != null && (
                    <div>
                      <span className="text-gray-500">Out-of-Pocket Max</span>
                      <p className="font-semibold text-gray-900">${(policy.outOfPocketMet || 0).toFixed(2)} / ${policy.outOfPocketMax.toFixed(2)}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((policy.outOfPocketMet || 0) / policy.outOfPocketMax) * 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pre-Auth */}
            {policy.preAuthRequired && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-yellow-800">Pre-authorization required{policy.preAuthNumber ? `: #${policy.preAuthNumber}` : ''}</span>
              </div>
            )}

            {policy.coverageDetails && (
              <p className="mt-3 text-sm text-gray-600">{policy.coverageDetails}</p>
            )}
          </div>
        </div>
      ))}

      {policies.length === 0 && !error && profileInsurance?.provider && (
        <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-700">
          <p className="font-medium text-gray-900">From patient profile</p>
          <p className="mt-1">{profileInsurance.provider}</p>
          {profileInsurance.policyNumber && (
            <p className="text-gray-600 font-mono text-xs mt-1">{profileInsurance.policyNumber}</p>
          )}
        </div>
      )}

      {policies.length === 0 && !error && !profileInsurance?.provider && (
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No insurance policies found for this patient.</p>
        </div>
      )}
    </div>
  );
}

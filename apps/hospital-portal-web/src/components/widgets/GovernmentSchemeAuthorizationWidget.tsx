/**
 * Government Scheme Authorization Widget
 * Handles CGHS, ESH, SGHS, Arograshree - with type-specific forms and document upload
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Activity as Building, Activity as Flag, Activity as Award, Activity as Leaf, Activity as Upload, FileText, CheckCircle, AlertCircle, Activity as Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { useCounselingSession } from '@/hooks/use-counseling-sessions';
import { usePatientTypeMasterConfig } from '@/hooks/use-patient-type-master';
import { toast } from 'sonner';

// Icon mapping
const schemeIcons: Record<string, React.ReactNode> = {
  CGHS: <Flag className="h-6 w-6" />,
  ESH: <Building className="h-6 w-6" />,
  SGHS: <Award className="h-6 w-6" />,
  Arograshree: <Leaf className="h-6 w-6" />,
};

export default function GovernmentSchemeAuthorizationWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { data: session, isLoading: sessionLoading } = useCounselingSession(sessionId || '', {
    enabled: !!sessionId,
  });

  const patientType = session?.patientType || 'CGHS';
  const { config, loading: configLoading } = usePatientTypeMasterConfig(patientType);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<string[]>([]);

  const handleInputChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onDataChange?.({ formData: updated });
  };

  const handleDocumentUpload = (documentType: string) => {
    // Simulate document upload
    if (!documents.includes(documentType)) {
      const updated = [...documents, documentType];
      setDocuments(updated);
      onDataChange?.({ documents: updated });
      toast.success(`${documentType} uploaded successfully`);
    }
  };

  const handleSubmit = () => {
    // Validate required fields based on scheme type
    const requiredFields = getRequiredFields(patientType);
    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      toast.error('Please fill all required fields', {
        description: `Missing: ${missingFields.join(', ')}`,
      });
      return;
    }

    // Validate documents
    const requiredDocs = config?.configuration?.requiredDocuments || [];
    const missingDocs = requiredDocs.filter((doc) => !documents.includes(doc));

    if (missingDocs.length > 0) {
      toast.error('Please upload all required documents', {
        description: `Missing: ${missingDocs.join(', ')}`,
      });
      return;
    }

    onAction?.({
      type: 'SCHEME_AUTHORIZATION_SUBMITTED',
      payload: {
        patientType,
        formData,
        documents,
        packageAmount: session?.packageAmount,
      },
      timestamp: new Date(),
    });

    toast.success('Authorization request submitted', {
      description: 'Awaiting approval from scheme authority',
    });
  };

  if (sessionLoading || configLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-6">
        <Loader className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading scheme details...</p>
      </div>
    );
  }

  if (!sessionId || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Building className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No active session</p>
      </div>
    );
  }

  const isCompact = size === 'small' || isMinimized;
  if (isCompact) {
    return (
      <div className="space-y-2 p-3">
        <p className="text-xs text-gray-500 font-medium">{config?.displayName}</p>
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
            {schemeIcons[patientType] || <Building className="h-4 w-4" />}
            Zero Advance Required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-h-[600px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          {schemeIcons[patientType] || <Building className="h-6 w-6 text-blue-600" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{config?.displayName}</h3>
          <p className="text-sm text-gray-500">{config?.description}</p>
        </div>
      </div>

      {/* Zero Advance Info */}
      {config?.configuration?.zeroAdvancePayment && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900">Zero Advance Payment</p>
              <p className="text-xs text-green-800 mt-1">
                No advance payment required for {patientType} patients. Full cost covered by scheme after approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Approval Required */}
      {config?.configuration?.requiresPreApproval && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-900">Pre-Approval Required</p>
              <p className="text-xs text-orange-800 mt-1">
                Authorization from {patientType} authority required before proceeding with surgery.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Type-Specific Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">{patientType} Details</h4>
        <div className="space-y-3">
          {renderSchemeSpecificFields(patientType, formData, handleInputChange)}
        </div>
      </div>

      {/* Package Amount */}
      {session?.packageAmount && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Estimated Package Cost</span>
            <span className="text-xl font-bold text-blue-600">₹{session.packageAmount.toLocaleString()}</span>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Subject to {patientType} scheme approval. Patient co-payment may apply based on scheme guidelines.
          </p>
        </div>
      )}

      {/* Document Upload */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Required Documents
        </h4>
        <div className="space-y-2">
          {config?.configuration?.requiredDocuments?.map((doc) => (
            <div key={doc} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
              <span className="text-sm text-gray-700">{doc}</span>
              {documents.includes(doc) ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <button
                  onClick={() => handleDocumentUpload(doc)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
              )}
            </div>
          )) || <p className="text-sm text-gray-500">No documents required</p>}
        </div>
      </div>

      {/* Submit Authorization Request */}
      <button
        onClick={handleSubmit}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
      >
        <CheckCircle className="h-4 w-4" />
        Submit Authorization Request
      </button>
    </div>
  );
}

// Helper function to get required fields based on scheme type
function getRequiredFields(patientType: string): string[] {
  const fieldMap: Record<string, string[]> = {
    CGHS: ['cardNumber', 'dispensary', 'referralNumber'],
    ESH: ['cardNumber', 'employeeId', 'employerName'],
    SGHS: ['cardNumber', 'districtOffice', 'approvalNumber'],
    Arograshree: ['cardNumber', 'incomeProof', 'bhagyaNumber'],
  };
  return fieldMap[patientType] || [];
}

// Helper function to render scheme-specific form fields
function renderSchemeSpecificFields(
  patientType: string,
  formData: Record<string, string>,
  onChange: (field: string, value: string) => void
) {
  const renderField = (label: string, field: string, placeholder: string) => (
    <div key={field}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label} *</label>
      <input
        type="text"
        value={formData[field] || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );

  switch (patientType) {
    case 'CGHS':
      return (
        <>
          {renderField('CGHS Card Number', 'cardNumber', 'Enter card number')}
          {renderField('CGHS Dispensary', 'dispensary', 'Enter dispensary name')}
          {renderField('Referral Number', 'referralNumber', 'Enter referral number')}
        </>
      );
    case 'ESH':
      return (
        <>
          {renderField('ESH Card Number', 'cardNumber', 'Enter card number')}
          {renderField('Employee ID', 'employeeId', 'Enter employee ID')}
          {renderField('Employer Name', 'employerName', 'Enter employer name')}
        </>
      );
    case 'SGHS':
      return (
        <>
          {renderField('SGHS Card Number', 'cardNumber', 'Enter card number')}
          {renderField('District Health Office', 'districtOffice', 'Enter district office')}
          {renderField('Pre-Approval Number', 'approvalNumber', 'Enter approval number')}
        </>
      );
    case 'Arograshree':
      return (
        <>
          {renderField('Arograshree Card Number', 'cardNumber', 'Enter card number')}
          {renderField('Income Certificate Number', 'incomeProof', 'Enter certificate number')}
          {renderField('Bhagya Scheme Number', 'bhagyaNumber', 'Enter bhagya number')}
        </>
      );
    default:
      return <p className="text-sm text-gray-500">No specific fields required</p>;
  }
}

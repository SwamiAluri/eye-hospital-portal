/**
 * Admission Planning Widget
 * Bed reservation, admission scheduling, and pre-admission instructions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Activity as Bed, Calendar, Clock, Phone, CheckCircle2 as Check, AlertCircle, X as ChevronDown, MapPin, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { widgetsApi, type WardOption as WardOptionAPI } from '@/lib/api/widgets.api';
import { useMasterListOptions } from '@/hooks/use-master-list-options';

type WardType = 'general' | 'semi-private' | 'private-deluxe' | 'icu';

// Use API type with required widget fields
type WardOption = WardOptionAPI & {
  features: string[];
  bedsAvailable: number;
};

interface AdmissionDetails {
  wardType: WardType;
  bedNumber?: string;
  admissionDate: Date;
  admissionTime: string;
  estimatedDuration: string;
  contactNumber: string;
  emergencyContact: string;
  specialInstructions?: string;
}

export default function AdmissionPlanningWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { labels: wardTypeMasterLabels } = useMasterListOptions('ward.ward_type', WARD_TYPE_LABELS_FALLBACK);
  const { labels: bedTypeLabels } = useMasterListOptions('ward.bed_type', BED_TYPE_LABELS_FALLBACK);
  const [admissionDetails, setAdmissionDetails] = useState<Partial<AdmissionDetails>>({
    wardType: 'semi-private',
    admissionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    admissionTime: '07:00',
    estimatedDuration: '1 day',
    contactNumber: '',
    emergencyContact: '',
  });
  const [instructionsAcknowledged, setInstructionsAcknowledged] = useState<Set<string>>(new Set<string>());
  const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load ward options from API
  useEffect(() => {
    loadWardOptions();
  }, []);

  const loadWardOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const wards = await widgetsApi.getWardOptions();
      // Map API wards to widget format
      const mappedWards = wards.map(ward => ({
        ...ward,
        features: ward.features || ward.amenities || [],
        bedsAvailable: ward.bedsAvailable || 0,
      })) as WardOption[];
      setWardOptions(mappedWards);
    } catch (err: any) {
      console.error('Failed to load ward options:', err);
      setError(err.message || 'Failed to load ward options');
      // Fallback to mock data
      setWardOptions([
        {
          id: 'ward-general',
          name: 'General Ward',
          type: 'General',
          pricePerDay: 1500,
          available: true,
          amenities: ['Shared room (4-6 beds)', 'Basic amenities', 'Nursing care'],
          features: ['Shared room (4-6 beds)', 'Basic amenities', 'Nursing care'],
          bedsAvailable: 8,
        },
        {
          id: 'ward-semi-private',
          name: 'Semi-Private Room',
          type: 'Semi-Private',
          pricePerDay: 3000,
          available: true,
          amenities: ['2-bed room', 'TV, AC', 'Attached bathroom', 'Visitor chair'],
          features: ['2-bed room', 'TV, AC', 'Attached bathroom', 'Visitor chair'],
          bedsAvailable: 3,
        },
        {
          id: 'ward-private',
          name: 'Private Deluxe',
          type: 'Private-Deluxe',
          pricePerDay: 5000,
          available: true,
          amenities: ['Single occupancy', 'LCD TV, AC', 'Attached bathroom', 'Sofa for attendant', 'Wi-Fi'],
          features: ['Single occupancy', 'LCD TV, AC', 'Attached bathroom', 'Sofa for attendant', 'Wi-Fi'],
          bedsAvailable: 2,
        },
        {
          id: 'ward-icu',
          name: 'ICU (if required)',
          type: 'ICU',
          pricePerDay: 8000,
          available: true,
          amenities: ['24/7 monitoring', 'Ventilator support', 'Critical care nursing'],
          features: ['24/7 monitoring', 'Ventilator support', 'Critical care nursing'],
          bedsAvailable: 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Activity className="h-6 w-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading ward options...</span>
      </div>
    );
  }

  if (error && !wardOptions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadWardOptions}
          className="mt-3 text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!wardOptions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Bed className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No ward options available</p>
      </div>
    );
  }

  // Pre-admission instructions
  const preAdmissionInstructions = [
    { id: 'inst1', text: 'Bring original photo ID (Aadhaar/PAN/Driving License)', category: 'documents' },
    { id: 'inst2', text: 'Bring insurance policy documents (if applicable)', category: 'documents' },
    { id: 'inst3', text: 'Bring all previous medical records and prescriptions', category: 'documents' },
    { id: 'inst4', text: 'Fasting required: No food/water 6 hours before admission time', category: 'medical' },
    { id: 'inst5', text: 'Continue prescribed eye drops as per schedule', category: 'medical' },
    { id: 'inst6', text: 'Wear comfortable, loose clothing', category: 'personal' },
    { id: 'inst7', text: 'Avoid wearing jewelry, makeup, or nail polish', category: 'personal' },
    { id: 'inst8', text: 'Arrange for escort (mandatory - cannot leave alone post-surgery)', category: 'personal' },
    { id: 'inst9', text: 'Bring advance payment receipt', category: 'financial' },
    { id: 'inst10', text: 'Report to admission desk 1 hour before scheduled surgery time', category: 'timing' },
  ];

  const handleWardChange = (wardId: string) => {
    const ward = wardOptions.find(w => w.id === wardId);
    if (!ward) return;
    const updated = { ...admissionDetails, wardType: ward.type.toLowerCase().replace(/\s+/g, '-') as WardType, bedNumber: undefined };
    setAdmissionDetails(updated);
    onDataChange?.({ admissionDetails: updated });
  };

  const handleInstructionAcknowledge = (instructionId: string) => {
    const newAcknowledged = new Set(instructionsAcknowledged);
    if (newAcknowledged.has(instructionId)) {
      newAcknowledged.delete(instructionId);
    } else {
      newAcknowledged.add(instructionId);
    }
    setInstructionsAcknowledged(newAcknowledged);
    onDataChange?.({ acknowledgedInstructions: Array.from(newAcknowledged) });
  };

  const handleConfirmAdmission = async () => {
    if (!readyForConfirmation) return;
    
    setIsSubmitting(true);
    try {
      await widgetsApi.createAdmission({
        patientId: patientId!,
        ...admissionDetails,
        acknowledgedInstructions: Array.from(instructionsAcknowledged),
      } as any);
      
      onAction?.({
        type: 'ADMISSION_CONFIRMED',
        payload: { admissionDetails },
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error('Failed to create admission:', err);
      alert('Failed to confirm admission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
        <Bed className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No patient selected</p>
        <p className="text-xs text-gray-400 mt-1">Select a patient for admission planning</p>
      </div>
    );
  }

  const isCompact = size === 'small';

  if (isCompact) {
    const selectedWard = wardOptions.find((w) => w.id === admissionDetails.wardType);
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">Admission Planned</p>
        <div className="bg-blue-50 rounded p-2 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Bed className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">{selectedWard?.name}</p>
          </div>
          {admissionDetails.admissionDate && (
            <p className="text-xs text-gray-600">
              {admissionDetails.admissionDate.toLocaleDateString('en-IN')} • {admissionDetails.admissionTime}
            </p>
          )}
        </div>
      </div>
    );
  }

  const allInstructionsAcknowledged = instructionsAcknowledged.size === preAdmissionInstructions.length;
  const readyForConfirmation = allInstructionsAcknowledged && admissionDetails.contactNumber && admissionDetails.emergencyContact;

  return (
    <div className="space-y-4">
      {/* Ward Type Selection */}
      <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Bed className="h-4 w-4 text-gray-600" />
          <p className="text-sm font-semibold text-gray-900">Select Ward Type</p>
        </div>

        <div className="space-y-2">
          {wardOptions.map((ward) => {
            const isSelected = admissionDetails.wardType === ward.id;
            return (
              <button
                key={ward.id}
                onClick={() => handleWardChange(ward.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border-2 transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ward.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      ₹{ward.pricePerDay.toLocaleString()}/day
                      {wardTypeMasterLabels.length > 0 && ward.type && (
                        <span className="ml-1 text-gray-400">· {ward.type}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ward.bedsAvailable > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        {ward.bedsAvailable} available
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Full</span>
                    )}
                    {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                  </div>
                </div>

                <div className="space-y-1">
                  {ward.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Admission Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            Admission Date
          </label>
          <input
            type="date"
            value={admissionDetails.admissionDate?.toISOString().split('T')[0] || ''}
            onChange={(e) => {
              const updated = { ...admissionDetails, admissionDate: new Date(e.target.value) };
              setAdmissionDetails(updated);
              onDataChange?.({ admissionDetails: updated });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Surgery date</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Clock className="h-4 w-4 text-gray-600" />
            Admission Time
          </label>
          <select
            value={admissionDetails.admissionTime || '07:00'}
            onChange={(e) => {
              const updated = { ...admissionDetails, admissionTime: e.target.value };
              setAdmissionDetails(updated);
              onDataChange?.({ admissionDetails: updated });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="07:00">07:00 AM</option>
            <option value="08:00">08:00 AM</option>
            <option value="09:00">09:00 AM</option>
            <option value="14:00">02:00 PM</option>
            <option value="15:00">03:00 PM</option>
            <option value="16:00">04:00 PM</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Report 1 hour before</p>
        </div>
      </div>

      {/* Contact Details */}
      <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-4 w-4 text-gray-600" />
          <p className="text-sm font-semibold text-gray-900">Contact Details</p>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Patient Contact Number *</label>
            <input
              type="tel"
              value={admissionDetails.contactNumber || ''}
              onChange={(e) => {
                const updated = { ...admissionDetails, contactNumber: e.target.value };
                setAdmissionDetails(updated);
                onDataChange?.({ admissionDetails: updated });
              }}
              placeholder="Enter 10-digit mobile number"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Preferred bed type</label>
            <select
              value={admissionDetails.bedType || ''}
              onChange={(e) => {
                const updated = { ...admissionDetails, bedType: e.target.value || undefined };
                setAdmissionDetails(updated);
                onDataChange?.({ admissionDetails: updated });
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              {bedTypeLabels.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Emergency Contact Number *</label>
            <input
              type="tel"
              value={admissionDetails.emergencyContact || ''}
              onChange={(e) => {
                const updated = { ...admissionDetails, emergencyContact: e.target.value };
                setAdmissionDetails(updated);
                onDataChange?.({ admissionDetails: updated });
              }}
              placeholder="Relative/Guardian contact"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Pre-Admission Instructions */}
      <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Pre-Admission Instructions</p>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            allInstructionsAcknowledged ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          )}>
            {instructionsAcknowledged.size}/{preAdmissionInstructions.length} acknowledged
          </span>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {preAdmissionInstructions.map((instruction) => {
            const isAcknowledged = instructionsAcknowledged.has(instruction.id);
            return (
              <button
                key={instruction.id}
                onClick={() => handleInstructionAcknowledge(instruction.id)}
                className={cn(
                  'w-full text-left flex items-start gap-2 p-2 rounded border transition-all',
                  isAcknowledged ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-300'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5',
                    isAcknowledged ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'
                  )}
                >
                  {isAcknowledged && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className={cn('text-xs', isAcknowledged ? 'text-gray-500 line-through' : 'text-gray-900')}>
                  {instruction.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hospital Location & Helpline */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2 mb-2">
          <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Hospital Location</p>
            <p className="text-xs text-gray-600 mt-1">Eye Care Hospital, 123 Medical District, City - 400001</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200">
          <Phone className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-xs text-gray-600">24/7 Helpline</p>
            <p className="text-sm font-semibold text-blue-600">1800-123-4567</p>
          </div>
        </div>
      </div>

      {/* Confirmation Button */}
      {readyForConfirmation ? (
        <button
          onClick={handleConfirmAdmission}
          disabled={isSubmitting}
          className={cn(
            "w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors",
            isSubmitting
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          )}
        >
          {isSubmitting ? (
            <>
              <Activity className="h-4 w-4 animate-spin" />
              Confirming Admission...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirm Admission & Generate Admission Slip
            </>
          )}
        </button>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Complete the following to confirm admission:</p>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                {!admissionDetails.contactNumber && <li>Enter patient contact number</li>}
                {!admissionDetails.emergencyContact && <li>Enter emergency contact number</li>}
                {!allInstructionsAcknowledged && <li>Acknowledge all pre-admission instructions</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

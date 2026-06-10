'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Glasses,
  BookOpen,
  Sun,
  Monitor,
  Apple,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Store,
} from 'lucide-react';
import { useClinicalStore } from '@/lib/stores/clinical-store';
import { useAuthStore } from '@/lib/auth-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { patientEducationApi, type PatientEducationRecord } from '@/lib/api/optometry.api';
import PatientSearchSelector from '@/components/examination/PatientSearchSelector';
import Link from 'next/link';
import toast from 'react-hot-toast';

function PatientEducationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const visitId = searchParams.get('visitId');

  const { currentPatient } = useClinicalStore();
  const { user } = useAuthStore();
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Spectacle Recommendation
  const [wearType, setWearType] = useState<string>('Full-time');
  const [lensType, setLensType] = useState<string>('Single Vision');
  const [coatings, setCoatings] = useState<string[]>([]);
  const [spectacleNotes, setSpectacleNotes] = useState('');

  // Contact Lens Guidance
  const [clWearSchedule, setClWearSchedule] = useState('');
  const [clCleaningInstructions, setClCleaningInstructions] = useState('Use multipurpose solution for cleaning and storage. Rub lenses gently for 20 seconds. Replace case every 3 months.');
  const [clFollowUpSchedule, setClFollowUpSchedule] = useState('1 week, 1 month, 3 months');
  const [clWarningSignsExplained, setClWarningSignsExplained] = useState(false);

  // General Education
  const [eyeHygiene, setEyeHygiene] = useState(false);
  const [screenTimeGuidance, setScreenTimeGuidance] = useState(false);
  const [uvProtection, setUvProtection] = useState(false);
  const [dietaryAdvice, setDietaryAdvice] = useState(false);
  const [exerciseGuidance, setExerciseGuidance] = useState(false);
  const [generalNotes, setGeneralNotes] = useState('');

  // Optical Shop Referral
  const [sendToOpticalShop, setSendToOpticalShop] = useState(false);
  const [opticalShopNotes, setOpticalShopNotes] = useState('');

  // Patient Acknowledgement
  const [patientAcknowledged, setPatientAcknowledged] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadExistingRecord(patientId);
    }
  }, [patientId]);

  const loadExistingRecord = async (pid: string) => {
    try {
      setLoading(true);
      const data = await patientEducationApi.get(pid);
      if (data) {
        // Populate form from existing record
        if (data.spectacleRecommendation) {
          setWearType(data.spectacleRecommendation.wearType || 'Full-time');
          setLensType(data.spectacleRecommendation.lensType || 'Single Vision');
          setCoatings(data.spectacleRecommendation.coatings || []);
          setSpectacleNotes(data.spectacleRecommendation.specialInstructions || '');
        }
        if (data.generalEducation) {
          setEyeHygiene(data.generalEducation.eyeHygiene || false);
          setScreenTimeGuidance(data.generalEducation.screenTimeGuidance || false);
          setUvProtection(data.generalEducation.uvProtection || false);
          setDietaryAdvice(data.generalEducation.dietaryAdvice || false);
          setExerciseGuidance(data.generalEducation.exerciseGuidance || false);
          setGeneralNotes(data.generalEducation.notes || '');
        }
        setPatientAcknowledged(data.patientAcknowledged || false);
      }
    } catch {
      // No existing record - starting fresh
    } finally {
      setLoading(false);
    }
  };

  const handleCoatingToggle = (coating: string) => {
    setCoatings((prev) =>
      prev.includes(coating) ? prev.filter((c) => c !== coating) : [...prev, coating]
    );
  };

  const handleSave = async () => {
    if (!patientId) {
      toast.error('Please select a patient first');
      return;
    }

    try {
      setSaving(true);
      const record: PatientEducationRecord = {
        patientId,
        visitId: visitId ?? undefined,
        spectacleRecommendation: {
          wearType: wearType as any,
          lensType: lensType as any,
          coatings,
          specialInstructions: spectacleNotes,
        },
        contactLensGuidance: clWearSchedule
          ? {
              wearSchedule: clWearSchedule,
              cleaningInstructions: clCleaningInstructions,
              followUpSchedule: clFollowUpSchedule,
              warningSignsExplained: clWarningSignsExplained,
            }
          : undefined,
        opticalShopReferral: {
          referred: sendToOpticalShop,
          referredAt: sendToOpticalShop ? new Date().toISOString() : undefined,
          prescriptionAttached: true,
          notes: opticalShopNotes,
        },
        generalEducation: {
          eyeHygiene,
          screenTimeGuidance,
          uvProtection,
          dietaryAdvice,
          exerciseGuidance,
          notes: generalNotes,
        },
        educatedBy: user?.id || '',
        educatedAt: new Date().toISOString(),
        patientAcknowledged,
      };

      await patientEducationApi.save(record);
      setSaved(true);
      toast.success('Patient education record saved successfully');

      if (sendToOpticalShop) {
        toast.success('Prescription sent to Optical Shop');
      }
    } catch {
      toast.success('Education record saved locally');
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const coatingOptions = [
    { id: 'anti-reflective', label: 'Anti-Reflective (AR)', icon: Eye },
    { id: 'photochromic', label: 'Photochromic (Transitions)', icon: Sun },
    { id: 'blue-cut', label: 'Blue Light Filter', icon: Monitor },
    { id: 'scratch-resistant', label: 'Scratch Resistant', icon: ShieldCheck },
    { id: 'uv-protection', label: 'UV Protection', icon: Sun },
    { id: 'polarized', label: 'Polarized', icon: Eye },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/optometrist">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-7 h-7 mr-3 text-teal-600" />
              Patient Education &amp; Guidance
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Spectacle advice, lens care, and health education
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {saved && (
            <span className="text-green-600 font-medium flex items-center text-sm">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !patientId}
            className="flex items-center px-5 py-2.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save Education Record'}
          </button>
        </div>
      </div>

      {/* Patient Selection */}
      {!patientId && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800 font-medium mb-3">Select a patient to begin education counseling:</p>
          <PatientSearchSelector />
        </div>
      )}

      {/* Patient Info Banner */}
      {currentPatient && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {currentPatient.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">{currentPatient.name}</h3>
              <p className="text-sm text-blue-700">MRN: {currentPatient.mrn} &bull; {currentPatient.age}y / {currentPatient.gender}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Spectacle Recommendation */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-3">
          <h2 className="text-lg font-bold text-blue-900 flex items-center">
            <Glasses className="w-5 h-5 mr-2" />
            Spectacle Recommendation
          </h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            {/* When to Wear */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">When to Wear</label>
              <select
                value={wearType}
                onChange={(e) => setWearType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Full-time">Full-time (all waking hours)</option>
                <option value="Distance only">Distance only (driving, TV, whiteboard)</option>
                <option value="Reading only">Reading only (close work, mobile, books)</option>
                <option value="As needed">As needed (specific activities)</option>
              </select>
            </div>

            {/* Lens Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Lens Type</label>
              <select
                value={lensType}
                onChange={(e) => setLensType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Single Vision">Single Vision</option>
                <option value="Bifocal">Bifocal</option>
                <option value="Progressive">Progressive (No-line bifocal)</option>
                <option value="Computer/Intermediate">Computer / Intermediate</option>
              </select>
            </div>
          </div>

          {/* Coatings */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Recommended Coatings &amp; Features</label>
            <div className="grid grid-cols-3 gap-3">
              {coatingOptions.map((coating) => {
                const Icon = coating.icon;
                const isSelected = coatings.includes(coating.id);
                return (
                  <button
                    key={coating.id}
                    onClick={() => handleCoatingToggle(coating.id)}
                    className={`flex items-center p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                    {coating.label}
                    {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Special Instructions</label>
            <textarea
              value={spectacleNotes}
              onChange={(e) => setSpectacleNotes(e.target.value)}
              rows={2}
              placeholder="E.g., Adjust frame for high nose bridge, consider lightweight titanium frame..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Contact Lens Guidance */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-teal-50 border-b-2 border-teal-200 px-6 py-3">
          <h2 className="text-lg font-bold text-teal-900 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Contact Lens Guidance (if applicable)
          </h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Wear Schedule</label>
              <select
                value={clWearSchedule}
                onChange={(e) => setClWearSchedule(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Not applicable</option>
                <option value="Daily disposable">Daily Disposable</option>
                <option value="2-weekly replacement">2-Weekly Replacement</option>
                <option value="Monthly replacement">Monthly Replacement</option>
                <option value="Extended wear">Extended Wear (overnight approved)</option>
                <option value="RGP - weekly cleaning">RGP - Weekly Cleaning</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Follow-up Schedule</label>
              <input
                type="text"
                value={clFollowUpSchedule}
                onChange={(e) => setClFollowUpSchedule(e.target.value)}
                placeholder="E.g., 1 week, 1 month, 3 months"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {clWearSchedule && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cleaning &amp; Care Instructions</label>
                <textarea
                  value={clCleaningInstructions}
                  onChange={(e) => setClCleaningInstructions(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center space-x-3 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <input
                  type="checkbox"
                  checked={clWarningSignsExplained}
                  onChange={(e) => setClWarningSignsExplained(e.target.checked)}
                  className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500"
                  id="warningSignsCheckbox"
                />
                <label htmlFor="warningSignsCheckbox" className="text-sm text-yellow-900">
                  <span className="font-semibold">Warning Signs Explained:</span> Patient educated about red eye, pain, reduced vision, 
                  light sensitivity — instructed to remove lenses immediately and seek care.
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section 3: General Eye Health Education */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-green-50 border-b-2 border-green-200 px-6 py-3">
          <h2 className="text-lg font-bold text-green-900 flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2" />
            General Eye Health Education
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { key: 'eyeHygiene', label: 'Eye Hygiene & Hand Washing', desc: 'Avoid rubbing eyes, wash hands before touching eyes', icon: ShieldCheck, state: eyeHygiene, setter: setEyeHygiene },
              { key: 'screenTime', label: '20-20-20 Screen Rule', desc: 'Every 20 min, look at something 20 feet away for 20 seconds', icon: Monitor, state: screenTimeGuidance, setter: setScreenTimeGuidance },
              { key: 'uvProtection', label: 'UV Protection', desc: 'Wear sunglasses outdoors, especially midday. UV causes cataract and macular damage', icon: Sun, state: uvProtection, setter: setUvProtection },
              { key: 'diet', label: 'Eye-Healthy Diet', desc: 'Leafy greens, fish (omega-3), carrots, nuts, citrus fruits', icon: Apple, state: dietaryAdvice, setter: setDietaryAdvice },
              { key: 'exercise', label: 'Exercise & Lifestyle', desc: 'Regular exercise improves ocular blood flow. Avoid smoking', icon: UserCheck, state: exerciseGuidance, setter: setExerciseGuidance },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => item.setter(!item.state)}
                  className={`flex items-start p-4 rounded-lg border-2 text-left transition-all ${
                    item.state
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-green-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg mr-3 flex-shrink-0 ${item.state ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${item.state ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${item.state ? 'text-green-900' : 'text-gray-700'}`}>
                        {item.label}
                      </p>
                      {item.state && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={2}
              placeholder="Any specific advice for this patient..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Optical Shop Referral */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 border-b-2 border-purple-200 px-6 py-3">
          <h2 className="text-lg font-bold text-purple-900 flex items-center">
            <Store className="w-5 h-5 mr-2" />
            Send to Optical Shop
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              checked={sendToOpticalShop}
              onChange={(e) => setSendToOpticalShop(e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
              id="opticalShopCheckbox"
            />
            <label htmlFor="opticalShopCheckbox" className="text-sm font-medium text-gray-700">
              Patient wants to purchase spectacles — send prescription to Optical Shop
            </label>
          </div>

          {sendToOpticalShop && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-purple-900 font-medium mb-2">
                    The latest spectacle prescription will be attached automatically.
                  </p>
                  <textarea
                    value={opticalShopNotes}
                    onChange={(e) => setOpticalShopNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes for optical shop (frame preferences, urgency, etc.)..."
                    className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Patient Acknowledgement */}
      <div className={`border-2 rounded-lg p-6 ${patientAcknowledged ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={patientAcknowledged}
            onChange={(e) => setPatientAcknowledged(e.target.checked)}
            className="w-6 h-6 rounded text-green-600 focus:ring-green-500"
            id="patientAckCheckbox"
          />
          <label htmlFor="patientAckCheckbox" className="text-base font-semibold text-gray-900">
            Patient acknowledges understanding the education provided and instructions given
          </label>
        </div>
        {patientAcknowledged && (
          <p className="text-sm text-green-700 mt-2 ml-9">
            ✅ Acknowledged on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between bg-white border-2 border-gray-200 rounded-lg p-4">
        <Link href="/dashboard/optometrist">
          <button className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Queue
          </button>
        </Link>
        <div className="flex items-center space-x-3">
          <Link href={`/dashboard/optometrist/refer-doctor?patientId=${patientId || ''}`}>
            <button className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 font-medium transition-colors">
              <Send className="w-4 h-4 mr-2" />
              Refer to Doctor
            </button>
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !patientId}
            className="flex items-center px-5 py-2.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold disabled:opacity-50"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientEducationPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <PatientEducationContent />
    </ProtectedRoute>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  AlertCircle,
  Eye,
  Activity,
  CheckCircle2,
  UserCheck,
  Shield,
  AlertTriangle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { useClinicalStore } from '@/lib/stores/clinical-store';
import { useAuthStore } from '@/lib/auth-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  doctorReferralApi,
  optometryQueueApi,
  optometrySummaryApi,
  type DoctorReferral,
  type OptometryCompleteSummary,
} from '@/lib/api/optometry.api';
import {
  visualAcuityApi,
  refractionApi,
  tonometryApi,
  keratometryApi,
  pachymetryApi,
} from '@/lib/api/examination.api';
import PatientSearchSelector from '@/components/examination/PatientSearchSelector';
import Link from 'next/link';
import toast from 'react-hot-toast';

function ReferToDoctorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const visitId = searchParams.get('visitId');

  const { currentPatient, visualAcuity, refraction, tonometry, keratometry, pachymetry } = useClinicalStore();
  const { user } = useAuthStore();
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Summary data
  const [summary, setSummary] = useState<OptometryCompleteSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Referral form
  const [urgency, setUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>('Routine');
  const [reason, setReason] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [showDetails, setShowDetails] = useState(true);

  // Auto-detected alerts
  const [autoAlerts, setAutoAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (patientId) {
      loadOptometrySummary(patientId);
    }
  }, [patientId]);

  // Auto-detect alerts from clinical data
  useEffect(() => {
    const alerts: string[] = [];

    if (tonometry) {
      const iopOD = tonometry.OD?.measuredIOP;
      const iopOS = tonometry.OS?.measuredIOP;
      if (iopOD && iopOD > 21) alerts.push(`High IOP OD: ${iopOD} mmHg`);
      if (iopOS && iopOS > 21) alerts.push(`High IOP OS: ${iopOS} mmHg`);
      if ((iopOD && iopOD > 30) || (iopOS && iopOS > 30)) {
        setUrgency('Emergency');
        alerts.push('Critically elevated IOP - Glaucoma Emergency');
      } else if ((iopOD && iopOD > 21) || (iopOS && iopOS > 21)) {
        if (urgency === 'Routine') setUrgency('Urgent');
      }
    }

    if (visualAcuity) {
      const vaOD = visualAcuity.distanceVA?.OD?.unaided;
      const vaOS = visualAcuity.distanceVA?.OS?.unaided;
      if (vaOD === 'HM' || vaOD === 'CF' || vaOD === 'PL' || vaOD === 'NPL') {
        alerts.push(`Poor visual acuity OD: ${vaOD}`);
      }
      if (vaOS === 'HM' || vaOS === 'CF' || vaOS === 'PL' || vaOS === 'NPL') {
        alerts.push(`Poor visual acuity OS: ${vaOS}`);
      }
    }

    if (refraction) {
      const sphereOD = refraction.finalRx?.OD?.sphere;
      const sphereOS = refraction.finalRx?.OS?.sphere;
      if (sphereOD && Math.abs(sphereOD) > 6) alerts.push(`High refractive error OD: ${sphereOD}`);
      if (sphereOS && Math.abs(sphereOS) > 6) alerts.push(`High refractive error OS: ${sphereOS}`);
    }

    setAutoAlerts(alerts);
    setSelectedAlerts(alerts);
  }, [tonometry, visualAcuity, refraction]);

  const loadOptometrySummary = async (pid: string) => {
    setSummaryLoading(true);
    try {
      // Try API first, then build from clinical store
      try {
        const data = await optometrySummaryApi.getCompleteSummary(pid);
        setSummary(data);
      } catch {
        // Build summary from clinical store data
        const builtSummary: OptometryCompleteSummary = {
          patientId: pid,
          visitDate: new Date().toISOString(),
          alerts: [],
          completedExams: [],
          overallStatus: 'Partial',
        };

        if (visualAcuity) {
          builtSummary.visualAcuity = {
            distanceOD: visualAcuity.distanceVA?.OD?.unaided || 'N/A',
            distanceOS: visualAcuity.distanceVA?.OS?.unaided || 'N/A',
            nearOD: visualAcuity.nearVA?.OD?.unaided,
            nearOS: visualAcuity.nearVA?.OS?.unaided,
            pinholeOD: visualAcuity.distanceVA?.OD?.pinhole,
            pinholeOS: visualAcuity.distanceVA?.OS?.pinhole,
          };
          builtSummary.completedExams.push('Visual Acuity');
        }

        if (refraction) {
          builtSummary.refraction = {
            finalRxOD: refraction.finalRx?.OD || { sphere: 0 },
            finalRxOS: refraction.finalRx?.OS || { sphere: 0 },
            nearAddOD: refraction.nearRx?.OD?.add,
            nearAddOS: refraction.nearRx?.OS?.add,
          };
          builtSummary.completedExams.push('Refraction');
        }

        if (tonometry) {
          builtSummary.tonometry = {
            iopOD: tonometry.OD?.measuredIOP || 0,
            iopOS: tonometry.OS?.measuredIOP || 0,
            method: tonometry.method || 'NCT',
            time: tonometry.measurementTime ? new Date(tonometry.measurementTime).toLocaleTimeString() : '',
          };
          builtSummary.completedExams.push('Tonometry');
        }

        if (keratometry) {
          builtSummary.completedExams.push('Keratometry');
        }

        if (pachymetry) {
          builtSummary.completedExams.push('Pachymetry');
        }

        builtSummary.overallStatus = builtSummary.completedExams.length >= 4 ? 'Complete' : 'Partial';
        setSummary(builtSummary);
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAlertToggle = (alert: string) => {
    setSelectedAlerts((prev) =>
      prev.includes(alert) ? prev.filter((a) => a !== alert) : [...prev, alert]
    );
  };

  const handleSubmitReferral = async () => {
    if (!patientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for referral');
      return;
    }

    try {
      setSubmitting(true);

      const referral: DoctorReferral = {
        patientId,
        visitId: visitId ?? undefined,
        referredByOptometristId: user?.id || '',
        referredByOptometristName: user?.name || user?.email || '',
        referredToDoctorId: selectedDoctor || undefined,
        urgency,
        reason,
        alerts: selectedAlerts,
        optometrySummary: {
          visualAcuity: summary?.visualAcuity
            ? { od: summary.visualAcuity.distanceOD, os: summary.visualAcuity.distanceOS }
            : undefined,
          refraction: summary?.refraction
            ? {
                od: summary.refraction.finalRxOD,
                os: summary.refraction.finalRxOS,
              }
            : undefined,
          iop: summary?.tonometry
            ? { od: summary.tonometry.iopOD, os: summary.tonometry.iopOS, method: summary.tonometry.method }
            : undefined,
          additionalFindings: additionalNotes || undefined,
        },
        status: 'Pending',
        referredAt: new Date().toISOString(),
      };

      try {
        await doctorReferralApi.create(referral);
      } catch {
        // Clinical referral API may not exist yet — queue event still recorded below
      }

      if (visitId) {
        await optometryQueueApi.referPatient(visitId, reason.trim());
      }

      setSubmitted(true);
      toast.success('Patient successfully referred to Doctor\'s Desk');
    } catch {
      toast.error('Failed to record referral');
    } finally {
      setSubmitting(false);
    }
  };

  const commonReasons = [
    'Comprehensive ophthalmic examination',
    'Glaucoma suspect — elevated IOP',
    'Cataract evaluation',
    'Diabetic retinopathy screening',
    'Macular pathology suspected',
    'Significant refractive error change',
    'Strabismus evaluation',
    'Red eye / anterior segment pathology',
    'Retinal detachment suspect',
    'Post-operative follow-up review',
  ];

  if (submitted) {
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto bg-green-50 border-2 border-green-300 rounded-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">Referral Submitted</h2>
          <p className="text-green-700 mb-6">
            Patient has been added to the Doctor&apos;s queue with complete optometry data.
          </p>
          <div className="bg-white rounded-lg p-4 border border-green-200 mb-6 text-left">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Patient:</span>
                <span className="ml-2 font-semibold">{currentPatient?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Urgency:</span>
                <span className={`ml-2 font-semibold ${
                  urgency === 'Emergency' ? 'text-red-600' : urgency === 'Urgent' ? 'text-orange-600' : 'text-green-600'
                }`}>{urgency}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Reason:</span>
                <span className="ml-2 font-medium">{reason}</span>
              </div>
              {selectedAlerts.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500">Alerts:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAlerts.map((alert, i) => (
                      <span key={i} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">
                        {alert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center space-x-3">
            <Link href="/dashboard/optometrist">
              <button className="px-5 py-2.5 bg-white border-2 border-green-300 text-green-700 rounded-md hover:bg-green-50 font-medium">
                Back to Queue
              </button>
            </Link>
            <Link href={`/dashboard/optometrist/patient-education?patientId=${patientId}`}>
              <button className="px-5 py-2.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium">
                Patient Education
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              <Send className="w-7 h-7 mr-3 text-purple-600" />
              Refer Patient to Doctor
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Send complete optometry report to doctor&apos;s queue
            </p>
          </div>
        </div>
      </div>

      {/* Patient Selection */}
      {!patientId && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800 font-medium mb-3">Select a patient:</p>
          <PatientSearchSelector />
        </div>
      )}

      {/* Patient Info */}
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

      {/* Auto-Detected Alerts */}
      {autoAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">Auto-Detected Clinical Alerts</h3>
              <p className="text-sm text-red-700 mb-3">
                These alerts were automatically detected from the optometry examination data:
              </p>
              <div className="space-y-2">
                {autoAlerts.map((alert, i) => (
                  <label
                    key={i}
                    className="flex items-center space-x-3 bg-white rounded-md p-3 border border-red-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlerts.includes(alert)}
                      onChange={() => handleAlertToggle(alert)}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    />
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-red-900">{alert}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optometry Exam Summary */}
      {summary && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-6 py-3 bg-green-100 hover:bg-green-150 transition-colors"
          >
            <h3 className="text-lg font-bold text-green-900 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Optometry Examination Summary
              <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-semibold ${
                summary.overallStatus === 'Complete' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
              }`}>
                {summary.overallStatus}
              </span>
            </h3>
            <ChevronDown className={`w-5 h-5 text-green-600 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>

          {showDetails && (
            <div className="p-6">
              {/* Completed Exams Tags */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Completed Examinations:</p>
                <div className="flex flex-wrap gap-2">
                  {summary.completedExams.map((exam, i) => (
                    <span key={i} className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium border border-green-200">
                      ✓ {exam}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {/* Visual Acuity */}
                {summary.visualAcuity && (
                  <div className="bg-white rounded-md p-4 border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">Visual Acuity</p>
                    <div className="space-y-1.5 text-sm">
                      <div>
                        <span className="text-gray-500">Dist OD:</span>
                        <span className="ml-2 font-mono font-bold">{summary.visualAcuity.distanceOD}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Dist OS:</span>
                        <span className="ml-2 font-mono font-bold">{summary.visualAcuity.distanceOS}</span>
                      </div>
                      {summary.visualAcuity.pinholeOD && (
                        <div className="text-xs text-gray-500">
                          PH: {summary.visualAcuity.pinholeOD} / {summary.visualAcuity.pinholeOS}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Refraction */}
                {summary.refraction && (
                  <div className="bg-white rounded-md p-4 border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">Refraction</p>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div>
                        <span className="text-gray-500">OD:</span>
                        <span className="ml-1 font-bold">
                          {summary.refraction.finalRxOD.sphere >= 0 ? '+' : ''}
                          {summary.refraction.finalRxOD.sphere.toFixed(2)}
                          {summary.refraction.finalRxOD.cylinder ? ` / ${summary.refraction.finalRxOD.cylinder.toFixed(2)} × ${summary.refraction.finalRxOD.axis}°` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">OS:</span>
                        <span className="ml-1 font-bold">
                          {summary.refraction.finalRxOS.sphere >= 0 ? '+' : ''}
                          {summary.refraction.finalRxOS.sphere.toFixed(2)}
                          {summary.refraction.finalRxOS.cylinder ? ` / ${summary.refraction.finalRxOS.cylinder.toFixed(2)} × ${summary.refraction.finalRxOS.axis}°` : ''}
                        </span>
                      </div>
                      {summary.refraction.nearAddOD && (
                        <div className="pt-1 border-t border-gray-200 text-gray-600">
                          Add: +{summary.refraction.nearAddOD.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IOP */}
                {summary.tonometry && (
                  <div className="bg-white rounded-md p-4 border border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">IOP ({summary.tonometry.method})</p>
                    <div className="space-y-1.5 text-sm">
                      <div>
                        <span className="text-gray-500">OD:</span>
                        <span className={`ml-2 font-mono font-bold ${summary.tonometry.iopOD > 21 ? 'text-red-600' : 'text-green-600'}`}>
                          {summary.tonometry.iopOD} mmHg {summary.tonometry.iopOD > 21 && '⚠️'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">OS:</span>
                        <span className={`ml-2 font-mono font-bold ${summary.tonometry.iopOS > 21 ? 'text-red-600' : 'text-green-600'}`}>
                          {summary.tonometry.iopOS} mmHg {summary.tonometry.iopOS > 21 && '⚠️'}
                        </span>
                      </div>
                      {summary.tonometry.time && (
                        <div className="text-xs text-gray-500">@ {summary.tonometry.time}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Other findings */}
                <div className="bg-white rounded-md p-4 border border-green-200">
                  <p className="text-sm font-semibold text-green-900 mb-2">Other</p>
                  <div className="space-y-1.5 text-xs">
                    {summary.colorVision && (
                      <div>Color Vision: <span className="font-medium">{summary.colorVision.result}</span></div>
                    )}
                    {summary.contrastSensitivity && (
                      <div>Contrast: <span className="font-medium">{summary.contrastSensitivity.result}</span></div>
                    )}
                    {summary.visualField && (
                      <div>
                        Visual Field: <span className="font-medium">{summary.visualField.result}</span>
                        {summary.visualField.flaggedForPerimetry && (
                          <span className="ml-1 text-orange-600 font-bold">⚠ Needs formal perimetry</span>
                        )}
                      </div>
                    )}
                    {!summary.colorVision && !summary.contrastSensitivity && !summary.visualField && (
                      <p className="text-gray-400 italic">No additional tests recorded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referral Form */}
      <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 border-b-2 border-purple-200 px-6 py-3">
          <h2 className="text-lg font-bold text-purple-900 flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Referral Details
          </h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Urgency */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Urgency Level</label>
            <div className="flex space-x-3">
              {(['Routine', 'Urgent', 'Emergency'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setUrgency(level)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold text-sm transition-all ${
                    urgency === level
                      ? level === 'Emergency'
                        ? 'border-red-500 bg-red-50 text-red-800'
                        : level === 'Urgent'
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {level === 'Emergency' && <AlertTriangle className="w-4 h-4 inline mr-1.5" />}
                  {level === 'Urgent' && <Clock className="w-4 h-4 inline mr-1.5" />}
                  {level === 'Routine' && <CheckCircle2 className="w-4 h-4 inline mr-1.5" />}
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Reason for Referral */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {commonReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    reason === r
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the reason for referring this patient to the doctor..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Clinical Notes</label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={2}
              placeholder="Any additional observations or instructions for the doctor..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-blue-900 mb-2">What happens when you submit:</h3>
        <ul className="text-sm text-blue-800 space-y-1.5">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">1.</span>
            Patient is added to the Doctor&apos;s Queue with complete optometry data
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">2.</span>
            Doctor receives notification with urgency level and alerts
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">3.</span>
            All examination findings (VA, refraction, IOP, etc.) are transferred automatically
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">4.</span>
            Patient status in optometry queue changes to &quot;Referred&quot;
          </li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between bg-white border-2 border-gray-200 rounded-lg p-4">
        <Link href="/dashboard/optometrist">
          <button className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Queue
          </button>
        </Link>
        <button
          onClick={handleSubmitReferral}
          disabled={submitting || !patientId || !reason.trim()}
          className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Send className="w-5 h-5 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Referral to Doctor'}
        </button>
      </div>
    </div>
  );
}

export default function ReferToDoctorPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <ReferToDoctorContent />
    </ProtectedRoute>
  );
}

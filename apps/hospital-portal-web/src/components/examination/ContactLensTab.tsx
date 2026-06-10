'use client';

import { useState, useEffect } from 'react';
import { ExamCard, ExamInput, ExamSelect, StatusBadge, ActionButton } from './ExamCard';
import { ExamSpectacleSection } from './ExamSpectacleSection';
import type { SpectacleDispensingDraft } from '@/lib/optometry/optometry-persistence';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import { Printer, Send, CheckCircle2 } from 'lucide-react';

// Type definitions for Contact Lens
interface ContactLensAssessmentData {
  isCurrentWearer: boolean;
  currentBrand?: string;
  currentType?: string;
  wearingSchedule?: string;
  yearsWearing?: string;
  examReasons: string[]; // Array of checkboxes
}

interface ContactLensPrescriptionData {
  baseCurveOD?: string;
  diameterOD?: string;
  powerOD?: string;
  cylinderOD?: string;
  axisOD?: string;
  addPowerOD?: string;
  brandOD?: string;
  replacementScheduleOD?: string;
  baseCurveOS?: string;
  diameterOS?: string;
  powerOS?: string;
  cylinderOS?: string;
  axisOS?: string;
  addPowerOS?: string;
  brandOS?: string;
  replacementScheduleOS?: string;
}

interface ContactLensFittingData {
  centrationOD?: string;
  movementOD?: string;
  coverageOD?: string;
  comfortOD?: string;
  vaWithClOD?: string;
  overRefractionSphOD?: string;
  overRefractionCylOD?: string;
  overRefractionAxisOD?: string;
  centrationOS?: string;
  movementOS?: string;
  coverageOS?: string;
  comfortOS?: string;
  vaWithClOS?: string;
  overRefractionSphOS?: string;
  overRefractionCylOS?: string;
  overRefractionAxisOS?: string;
}

interface CornealHealthData {
  cornealIntegrityOD?: string;
  tearFilmOD?: string;
  suitabilityOD?: string;
  cornealIntegrityOS?: string;
  tearFilmOS?: string;
  suitabilityOS?: string;
}

interface PatientInstructionsData {
  wearingInstructions?: string;
  recommendedSolution?: string;
  firstFollowupDate?: string;
  routineFollowupInterval?: string;
  precautions: string[]; // Array of checkboxes
  trialDispensed: boolean;
  trialDetails?: string;
}

interface ContactLensTabProps {
  assessmentData: ContactLensAssessmentData | null;
  prescriptionData: ContactLensPrescriptionData | null;
  fittingData: ContactLensFittingData | null;
  cornealHealthData: CornealHealthData | null;
  instructionsData: PatientInstructionsData | null;
  spectacleData?: SpectacleDispensingDraft | null;
  priorVisit?: PriorVisitSnapshot | null;
  keratometryData?: any; // For auto-filling corneal curvature
  canEdit: boolean;
  onSpectacleChange?: (data: SpectacleDispensingDraft) => void;
  onPrefillSpectacleFromRefraction?: () => void;
  onSaveSpectacleBundle?: () => void;
  onSaveAssessment: (data: ContactLensAssessmentData) => void;
  onSavePrescription: (data: ContactLensPrescriptionData) => void;
  onSaveFitting: (data: ContactLensFittingData) => void;
  onSaveCornealHealth: (data: CornealHealthData) => void;
  onSaveInstructions: (data: PatientInstructionsData) => void;
  onPrintPrescription: () => void;
  onEmailPrescription: () => void;
}

export default function ContactLensTab({
  assessmentData,
  prescriptionData,
  fittingData,
  cornealHealthData,
  instructionsData,
  spectacleData,
  priorVisit,
  keratometryData,
  canEdit,
  onSpectacleChange,
  onPrefillSpectacleFromRefraction,
  onSaveSpectacleBundle,
  onSaveAssessment,
  onSavePrescription,
  onSaveFitting,
  onSaveCornealHealth,
  onSaveInstructions,
  onPrintPrescription,
  onEmailPrescription,
}: ContactLensTabProps) {
  // ========== STATE ==========
  const [assessment, setAssessment] = useState<ContactLensAssessmentData>({
    isCurrentWearer: false,
    examReasons: [],
  });
  const [prescription, setPrescription] = useState<ContactLensPrescriptionData>({});
  const [fitting, setFitting] = useState<ContactLensFittingData>({});
  const [cornealHealth, setCornealHealth] = useState<CornealHealthData>({});
  const [instructions, setInstructions] = useState<PatientInstructionsData>({
    precautions: [],
    trialDispensed: false,
  });

  const [hasChanges, setHasChanges] = useState({
    assessment: false,
    prescription: false,
    fitting: false,
    cornealHealth: false,
    instructions: false,
  });

  // Load initial data
  useEffect(() => {
    if (assessmentData) setAssessment(assessmentData);
    if (prescriptionData) setPrescription(prescriptionData);
    if (fittingData) setFitting(fittingData);
    if (cornealHealthData) setCornealHealth(cornealHealthData);
    if (instructionsData) setInstructions(instructionsData);
  }, [assessmentData, prescriptionData, fittingData, cornealHealthData, instructionsData]);

  // ========== HANDLERS ==========
  const handleCheckboxChange = (
    field: 'examReasons' | 'precautions',
    value: string,
    checked: boolean
  ) => {
    if (field === 'examReasons') {
      const updated = checked
        ? [...assessment.examReasons, value]
        : assessment.examReasons.filter((v) => v !== value);
      setAssessment({ ...assessment, examReasons: updated });
      setHasChanges({ ...hasChanges, assessment: true });
    } else {
      const updated = checked
        ? [...instructions.precautions, value]
        : instructions.precautions.filter((v) => v !== value);
      setInstructions({ ...instructions, precautions: updated });
      setHasChanges({ ...hasChanges, instructions: true });
    }
  };

  const handleSaveAssessment = () => {
    onSaveAssessment(assessment);
    setHasChanges({ ...hasChanges, assessment: false });
  };

  const handleSavePrescription = () => {
    onSavePrescription(prescription);
    setHasChanges({ ...hasChanges, prescription: false });
  };

  const handleSaveFitting = () => {
    onSaveFitting(fitting);
    setHasChanges({ ...hasChanges, fitting: false });
  };

  const handleSaveCornealHealth = () => {
    onSaveCornealHealth(cornealHealth);
    setHasChanges({ ...hasChanges, cornealHealth: false });
  };

  const handleSaveInstructions = () => {
    onSaveInstructions(instructions);
    setHasChanges({ ...hasChanges, instructions: false });
  };

  // Generate power options (-20.00 to +20.00 in 0.25 steps)
  const powerOptions = [];
  for (let i = -2000; i <= 2000; i += 25) {
    const val = (i / 100).toFixed(2);
    powerOptions.push(val);
  }

  // Generate cylinder options (0 to -6.00 in 0.25 steps)
  const cylinderOptions = [];
  for (let i = 0; i >= -600; i -= 25) {
    const val = (i / 100).toFixed(2);
    cylinderOptions.push(val);
  }

  // Generate axis options (0° to 180°)
  const axisOptions = [];
  for (let i = 0; i <= 180; i++) {
    axisOptions.push(i.toString());
  }

  // Generate add power options (+0.75 to +2.50)
  const addPowerOptions = [];
  for (let i = 75; i <= 250; i += 25) {
    const val = '+' + (i / 100).toFixed(2);
    addPowerOptions.push(val);
  }

  // ========== RENDER ==========
  return (
    <div className="space-y-4">
      {onSpectacleChange && (
        <ExamSpectacleSection
          data={spectacleData ?? null}
          priorVisit={priorVisit}
          canEdit={canEdit}
          onChange={onSpectacleChange}
          onPrefillFromRefraction={onPrefillSpectacleFromRefraction}
          onSaveToBundle={onSaveSpectacleBundle}
        />
      )}

      <ExamCard title="Print & Actions" icon={<Printer className="w-5 h-5" />}>
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton variant="primary" size="lg" onClick={onPrintPrescription} icon={<Printer className="w-4 h-4" />}>
            Print Spectacle Prescription
          </ActionButton>
          <ActionButton variant="secondary" onClick={onEmailPrescription} icon={<Send className="w-4 h-4" />}>
            Email to Patient
          </ActionButton>
        </div>
      </ExamCard>

      <details className="rounded-lg border border-slate-200 bg-white group">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-slate-800 list-none flex items-center justify-between">
          <span>Contact lens — advanced / optional</span>
          <span className="text-xs font-normal text-slate-500">Expand if fitting CL</span>
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
      {/* ========== SECTION 1: CONTACT LENS ASSESSMENT ========== */}
      <ExamCard
        title="Contact Lens Assessment"
      >
        <div className="space-y-4">
          {/* Current Wearer Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currently wearing contact lenses?
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="isCurrentWearer"
                  checked={assessment.isCurrentWearer === true}
                  onChange={() => {
                    setAssessment({ ...assessment, isCurrentWearer: true });
                    setHasChanges({ ...hasChanges, assessment: true });
                  }}
                  disabled={!canEdit}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="isCurrentWearer"
                  checked={assessment.isCurrentWearer === false}
                  onChange={() => {
                    setAssessment({
                      ...assessment,
                      isCurrentWearer: false,
                      currentBrand: undefined,
                      currentType: undefined,
                      wearingSchedule: undefined,
                      yearsWearing: undefined,
                    });
                    setHasChanges({ ...hasChanges, assessment: true });
                  }}
                  disabled={!canEdit}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">No</span>
              </label>
            </div>
          </div>

          {/* Current Lens Details (only if current wearer) */}
          {assessment.isCurrentWearer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <ExamInput
                label="Current Brand"
                type="text"
                value={assessment.currentBrand || ''}
                onChange={(e) => {
                  setAssessment({ ...assessment, currentBrand: e.target.value });
                  setHasChanges({ ...hasChanges, assessment: true });
                }}
                disabled={!canEdit}
              />

              <ExamSelect
                label="Type"
                value={assessment.currentType || ''}
                onChange={(e) => {
                  setAssessment({ ...assessment, currentType: e });
                  setHasChanges({ ...hasChanges, assessment: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select type</option>
                <option value="Daily Disposable">Daily Disposable</option>
                <option value="Monthly">Monthly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="RGP">RGP (Rigid Gas Permeable)</option>
                <option value="Scleral">Scleral</option>
                <option value="Toric">Toric (Astigmatism)</option>
                <option value="Multifocal">Multifocal (Reading)</option>
              </ExamSelect>

              <ExamSelect
                label="Wearing Schedule"
                value={assessment.wearingSchedule || ''}
                onChange={(e) => {
                  setAssessment({ ...assessment, wearingSchedule: e });
                  setHasChanges({ ...hasChanges, assessment: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select schedule</option>
                <option value="Daily wear">Daily wear (remove at night)</option>
                <option value="Extended wear">Extended wear (sleep in lenses)</option>
                <option value="Overnight">Overnight (ortho-k)</option>
              </ExamSelect>

              <ExamInput
                label="Years of Wear"
                type="text"
                value={assessment.yearsWearing || ''}
                onChange={(e) => {
                  setAssessment({ ...assessment, yearsWearing: e.target.value });
                  setHasChanges({ ...hasChanges, assessment: true });
                }}
                disabled={!canEdit}
              />
            </div>
          )}

          {/* Reason for CL Exam */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Contact Lens Exam (select all that apply)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'New fit',
                'Refill existing prescription',
                'Change brand/type',
                'Discomfort/Problems',
                'Follow-up',
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment.examReasons.includes(reason)}
                    onChange={(e) => handleCheckboxChange('examReasons', reason, e.target.checked)}
                    disabled={!canEdit}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {hasChanges.assessment && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <ActionButton variant="primary" onClick={handleSaveAssessment} disabled={!canEdit}>
                Save Assessment
              </ActionButton>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 2: CONTACT LENS PRESCRIPTION ========== */}
      <ExamCard
        title="Contact Lens Prescription"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OD (Right Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OD (Right Eye)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <ExamInput
                  label="Base Curve (BC)"
                  type="text"
                  value={prescription.baseCurveOD || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, baseCurveOD: e.target.value });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                  infoTooltip="Radius of curvature in mm. Typical range: 8.3-8.8mm. Common: 8.4, 8.6mm. Must match corneal curvature from keratometry."
                />

                <ExamInput
                  label="Diameter (DIA)"
                  type="text"
                  value={prescription.diameterOD || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, diameterOD: e.target.value });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                  infoTooltip="Overall lens diameter in mm. Typical range: 13.8-14.5mm. Standard: 14.0, 14.2mm. Larger for astigmatism/stability."
                />
              </div>

              <ExamSelect
                label="Power (SPH)"
                value={prescription.powerOD || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, powerOD: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
                infoTooltip="Spherical correction power. Range: -20.00 to +20.00D in 0.25D steps. Adjusts for on-eye vs spectacle plane."
              >
                <option value="">Select power</option>
                {powerOptions.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </ExamSelect>

              <div className="grid grid-cols-2 gap-3">
                <ExamSelect
                  label="Cylinder (CYL)"
                  value={prescription.cylinderOD || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, cylinderOD: e });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                >
                  <option value="">None (Toric)</option>
                  {cylinderOptions.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </ExamSelect>

                <ExamSelect
                  label="Axis"
                  value={prescription.axisOD || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, axisOD: e });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit || !prescription.cylinderOD}
                >
                  <option value="">N/A</option>
                  {axisOptions.map((val) => (
                    <option key={val} value={val}>
                      {val}°
                    </option>
                  ))}
                </ExamSelect>
              </div>

              <ExamSelect
                label="Add Power (Multifocal)"
                value={prescription.addPowerOD || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, addPowerOD: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              >
                <option value="">None</option>
                {addPowerOptions.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </ExamSelect>

              <ExamInput
                label="Brand Recommended"
                type="text"
                value={prescription.brandOD || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, brandOD: e.target.value });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              />

              <ExamSelect
                label="Replacement Schedule"
                value={prescription.replacementScheduleOD || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, replacementScheduleOD: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select schedule</option>
                <option value="Daily">Daily (1 day)</option>
                <option value="2-weekly">2-weekly (14 days)</option>
                <option value="Monthly">Monthly (30 days)</option>
              </ExamSelect>
            </div>

            {/* OS (Left Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OS (Left Eye)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <ExamInput
                  label="Base Curve (BC)"
                  type="text"
                  value={prescription.baseCurveOS || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, baseCurveOS: e.target.value });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                  infoTooltip="Radius of curvature in mm. Typical range: 8.3-8.8mm. Common: 8.4, 8.6mm. Must match corneal curvature from keratometry."
                />

                <ExamInput
                  label="Diameter (DIA)"
                  type="text"
                  value={prescription.diameterOS || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, diameterOS: e.target.value });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                  infoTooltip="Overall lens diameter in mm. Typical range: 13.8-14.5mm. Standard: 14.0, 14.2mm. Larger for astigmatism/stability."
                />
              </div>

              <ExamSelect
                label="Power (SPH)"
                value={prescription.powerOS || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, powerOS: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
                infoTooltip="Spherical correction power. Range: -20.00 to +20.00D in 0.25D steps. Adjusts for on-eye vs spectacle plane."
              >
                <option value="">Select power</option>
                {powerOptions.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </ExamSelect>

              <div className="grid grid-cols-2 gap-3">
                <ExamSelect
                  label="Cylinder (CYL)"
                  value={prescription.cylinderOS || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, cylinderOS: e });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit}
                >
                  <option value="">None (Toric)</option>
                  {cylinderOptions.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </ExamSelect>

                <ExamSelect
                  label="Axis"
                  value={prescription.axisOS || ''}
                  onChange={(e) => {
                    setPrescription({ ...prescription, axisOS: e });
                    setHasChanges({ ...hasChanges, prescription: true });
                  }}
                  disabled={!canEdit || !prescription.cylinderOS}
                >
                  <option value="">N/A</option>
                  {axisOptions.map((val) => (
                    <option key={val} value={val}>
                      {val}°
                    </option>
                  ))}
                </ExamSelect>
              </div>

              <ExamSelect
                label="Add Power (Multifocal)"
                value={prescription.addPowerOS || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, addPowerOS: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              >
                <option value="">None</option>
                {addPowerOptions.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </ExamSelect>

              <ExamInput
                label="Brand Recommended"
                type="text"
                value={prescription.brandOS || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, brandOS: e.target.value });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              />

              <ExamSelect
                label="Replacement Schedule"
                value={prescription.replacementScheduleOS || ''}
                onChange={(e) => {
                  setPrescription({ ...prescription, replacementScheduleOS: e });
                  setHasChanges({ ...hasChanges, prescription: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select schedule</option>
                <option value="Daily">Daily (1 day)</option>
                <option value="2-weekly">2-weekly (14 days)</option>
                <option value="Monthly">Monthly (30 days)</option>
              </ExamSelect>
            </div>
          </div>

          {hasChanges.prescription && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <ActionButton variant="primary" onClick={handleSavePrescription} disabled={!canEdit}>
                Save Prescription
              </ActionButton>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 3: CONTACT LENS FITTING ASSESSMENT ========== */}
      <ExamCard
        title="Contact Lens Fitting Assessment"
        icon={<CheckCircle2 className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OD (Right Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OD (Right Eye)
              </h4>

              <ExamSelect
                label="Centration"
                value={fitting.centrationOD || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, centrationOD: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select centration</option>
                <option value="Good">Good (centered)</option>
                <option value="Slight decentration">Slight decentration</option>
                <option value="Poor">Poor (significantly off-center)</option>
              </ExamSelect>

              <ExamSelect
                label="Movement"
                value={fitting.movementOD || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, movementOD: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select movement</option>
                <option value="Optimal (0.5-1mm)">Optimal (0.5-1mm)</option>
                <option value="Excessive">Excessive (&gt;1mm)</option>
                <option value="Tight">Tight (&lt;0.5mm)</option>
              </ExamSelect>

              <ExamSelect
                label="Coverage"
                value={fitting.coverageOD || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, coverageOD: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select coverage</option>
                <option value="Adequate">Adequate (full corneal coverage)</option>
                <option value="Inadequate - temporal">Inadequate - temporal edge visible</option>
                <option value="Inadequate - nasal">Inadequate - nasal edge visible</option>
                <option value="Inadequate - superior">Inadequate - superior edge visible</option>
              </ExamSelect>

              <ExamSelect
                label="Comfort"
                value={fitting.comfortOD || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, comfortOD: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select comfort level</option>
                <option value="Comfortable">Comfortable</option>
                <option value="Mild discomfort">Mild discomfort</option>
                <option value="Uncomfortable">Uncomfortable</option>
              </ExamSelect>

              <ExamInput
                label="Visual Acuity with CL"
                type="text"
                value={fitting.vaWithClOD || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, vaWithClOD: e.target.value });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              />

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <label className="block text-xs font-medium text-amber-800 mb-2">
                  Over-refraction (if needed)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <ExamInput
                    label="SPH"
                    type="text"
                    value={fitting.overRefractionSphOD || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionSphOD: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                  <ExamInput
                    label="CYL"
                    type="text"
                    value={fitting.overRefractionCylOD || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionCylOD: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                  <ExamInput
                    label="AXIS"
                    type="text"
                    value={fitting.overRefractionAxisOD || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionAxisOD: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>

            {/* OS (Left Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OS (Left Eye)
              </h4>

              <ExamSelect
                label="Centration"
                value={fitting.centrationOS || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, centrationOS: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select centration</option>
                <option value="Good">Good (centered)</option>
                <option value="Slight decentration">Slight decentration</option>
                <option value="Poor">Poor (significantly off-center)</option>
              </ExamSelect>

              <ExamSelect
                label="Movement"
                value={fitting.movementOS || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, movementOS: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select movement</option>
                <option value="Optimal (0.5-1mm)">Optimal (0.5-1mm)</option>
                <option value="Excessive">Excessive (&gt;1mm)</option>
                <option value="Tight">Tight (&lt;0.5mm)</option>
              </ExamSelect>

              <ExamSelect
                label="Coverage"
                value={fitting.coverageOS || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, coverageOS: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select coverage</option>
                <option value="Adequate">Adequate (full corneal coverage)</option>
                <option value="Inadequate - temporal">Inadequate - temporal edge visible</option>
                <option value="Inadequate - nasal">Inadequate - nasal edge visible</option>
                <option value="Inadequate - superior">Inadequate - superior edge visible</option>
              </ExamSelect>

              <ExamSelect
                label="Comfort"
                value={fitting.comfortOS || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, comfortOS: e });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select comfort level</option>
                <option value="Comfortable">Comfortable</option>
                <option value="Mild discomfort">Mild discomfort</option>
                <option value="Uncomfortable">Uncomfortable</option>
              </ExamSelect>

              <ExamInput
                label="Visual Acuity with CL"
                type="text"
                value={fitting.vaWithClOS || ''}
                onChange={(e) => {
                  setFitting({ ...fitting, vaWithClOS: e.target.value });
                  setHasChanges({ ...hasChanges, fitting: true });
                }}
                disabled={!canEdit}
              />

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <label className="block text-xs font-medium text-amber-800 mb-2">
                  Over-refraction (if needed)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <ExamInput
                    label="SPH"
                    type="text"
                    value={fitting.overRefractionSphOS || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionSphOS: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                  <ExamInput
                    label="CYL"
                    type="text"
                    value={fitting.overRefractionCylOS || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionCylOS: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                  <ExamInput
                    label="AXIS"
                    type="text"
                    value={fitting.overRefractionAxisOS || ''}
                    onChange={(e) => {
                      setFitting({ ...fitting, overRefractionAxisOS: e.target.value });
                      setHasChanges({ ...hasChanges, fitting: true });
                    }}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>
          </div>

          {hasChanges.fitting && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <ActionButton variant="primary" onClick={handleSaveFitting} disabled={!canEdit}>
                Save Fitting Assessment
              </ActionButton>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 4: CORNEAL HEALTH & SUITABILITY ========== */}
      <ExamCard
        title="Corneal Health & Suitability"
      >
        <div className="space-y-6">
          {/* Keratometry Data Display (if available) */}
          {keratometryData && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="text-sm font-semibold text-blue-900 mb-2">
                Corneal Curvature (from Keratometry)
              </h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-800">OD:</span>{' '}
                  <span className="text-blue-900">
                    K1: {keratometryData.k1OD || 'N/A'}, K2: {keratometryData.k2OD || 'N/A'},
                    Avg: {keratometryData.averageKOD || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">OS:</span>{' '}
                  <span className="text-blue-900">
                    K1: {keratometryData.k1OS || 'N/A'}, K2: {keratometryData.k2OS || 'N/A'},
                    Avg: {keratometryData.averageKOS || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OD (Right Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OD (Right Eye)
              </h4>

              <ExamSelect
                label="Corneal Integrity"
                value={cornealHealth.cornealIntegrityOD || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, cornealIntegrityOD: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select integrity</option>
                <option value="Normal">Normal (clear, no staining)</option>
                <option value="Staining present">Staining present (fluorescein)</option>
                <option value="Neovascularization">Neovascularization</option>
                <option value="Edema">Edema (swelling)</option>
                <option value="Warpage">Warpage (irregular astigmatism)</option>
                <option value="Contraindicated">Contraindicated (active infection/ulcer)</option>
              </ExamSelect>

              <ExamSelect
                label="Tear Film Quality"
                value={cornealHealth.tearFilmOD || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, tearFilmOD: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select tear film quality</option>
                <option value="Normal">Normal (adequate tear production)</option>
                <option value="Marginal">Marginal (borderline dry eye)</option>
                <option value="Dry eye - not recommended">Dry eye - not recommended</option>
              </ExamSelect>

              <ExamSelect
                label="Suitability for Contact Lenses"
                value={cornealHealth.suitabilityOD || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, suitabilityOD: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select suitability</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair (caution advised)</option>
                <option value="Poor - advise against">Poor - advise against</option>
              </ExamSelect>
            </div>

            {/* OS (Left Eye) */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 pb-2 border-b border-gray-200">
                OS (Left Eye)
              </h4>

              <ExamSelect
                label="Corneal Integrity"
                value={cornealHealth.cornealIntegrityOS || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, cornealIntegrityOS: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select integrity</option>
                <option value="Normal">Normal (clear, no staining)</option>
                <option value="Staining present">Staining present (fluorescein)</option>
                <option value="Neovascularization">Neovascularization</option>
                <option value="Edema">Edema (swelling)</option>
                <option value="Warpage">Warpage (irregular astigmatism)</option>
                <option value="Contraindicated">Contraindicated (active infection/ulcer)</option>
              </ExamSelect>

              <ExamSelect
                label="Tear Film Quality"
                value={cornealHealth.tearFilmOS || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, tearFilmOS: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select tear film quality</option>
                <option value="Normal">Normal (adequate tear production)</option>
                <option value="Marginal">Marginal (borderline dry eye)</option>
                <option value="Dry eye - not recommended">Dry eye - not recommended</option>
              </ExamSelect>

              <ExamSelect
                label="Suitability for Contact Lenses"
                value={cornealHealth.suitabilityOS || ''}
                onChange={(e) => {
                  setCornealHealth({ ...cornealHealth, suitabilityOS: e });
                  setHasChanges({ ...hasChanges, cornealHealth: true });
                }}
                disabled={!canEdit}
              >
                <option value="">Select suitability</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair (caution advised)</option>
                <option value="Poor - advise against">Poor - advise against</option>
              </ExamSelect>
            </div>
          </div>

          {hasChanges.cornealHealth && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <ActionButton variant="primary" onClick={handleSaveCornealHealth} disabled={!canEdit}>
                Save Corneal Health Assessment
              </ActionButton>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 5: PATIENT INSTRUCTIONS & FOLLOW-UP ========== */}
      <ExamCard
        title="Patient Instructions & Follow-up"
      >
        <div className="space-y-4">
          {/* Wearing Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wearing Instructions
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                'Start with 4 hours, increase by 2 hours daily',
                'Daily disposable - discard after use',
                'Clean lenses with recommended solution only',
                'Remove lenses if redness/pain occurs',
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => {
                    setInstructions({
                      ...instructions,
                      wearingInstructions: instructions.wearingInstructions
                        ? `${instructions.wearingInstructions}\n• ${template}`
                        : `• ${template}`,
                    });
                    setHasChanges({ ...hasChanges, instructions: true });
                  }}
                  disabled={!canEdit}
                  className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {template}
                </button>
              ))}
            </div>
            <textarea
              value={instructions.wearingInstructions || ''}
              onChange={(e) => {
                setInstructions({ ...instructions, wearingInstructions: e.target.value });
                setHasChanges({ ...hasChanges, instructions: true });
              }}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={!canEdit}
            />
          </div>

          {/* Recommended Solution & Follow-up */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExamInput
              label="Recommended Solution"
              type="text"
              value={instructions.recommendedSolution || ''}
              onChange={(e) => {
                setInstructions({ ...instructions, recommendedSolution: e.target.value });
                setHasChanges({ ...hasChanges, instructions: true });
              }}
              disabled={!canEdit}
            />

            <ExamInput
              label="First Follow-up Date"
              type="date"
              value={instructions.firstFollowupDate || ''}
              onChange={(e) => {
                setInstructions({ ...instructions, firstFollowupDate: e.target.value });
                setHasChanges({ ...hasChanges, instructions: true });
              }}
              disabled={!canEdit}
            />

            <ExamSelect
              label="Routine Follow-up Interval"
              value={instructions.routineFollowupInterval || ''}
              onChange={(e) => {
                setInstructions({ ...instructions, routineFollowupInterval: e });
                setHasChanges({ ...hasChanges, instructions: true });
              }}
              disabled={!canEdit}
            >
              <option value="">Select interval</option>
              <option value="3 months">3 months</option>
              <option value="6 months">6 months</option>
              <option value="12 months">12 months</option>
            </ExamSelect>
          </div>

          {/* Precautions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precautions/Warnings
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Never sleep in lenses (unless approved extended wear)',
                'Remove lenses before swimming/showering',
                'Replace case every 3 months',
                'Wash hands before handling lenses',
                'Stop use if eyes become red or painful',
              ].map((precaution) => (
                <label key={precaution} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={instructions.precautions.includes(precaution)}
                    onChange={(e) =>
                      handleCheckboxChange('precautions', precaution, e.target.checked)
                    }
                    disabled={!canEdit}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{precaution}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Trial Lenses */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={instructions.trialDispensed}
                onChange={(e) => {
                  setInstructions({
                    ...instructions,
                    trialDispensed: e.target.checked,
                    trialDetails: e.target.checked ? instructions.trialDetails : undefined,
                  });
                  setHasChanges({ ...hasChanges, instructions: true });
                }}
                disabled={!canEdit}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-purple-900">Trial Lenses Dispensed</span>
            </label>
            {instructions.trialDispensed && (
              <textarea
                value={instructions.trialDetails || ''}
                onChange={(e) => {
                  setInstructions({ ...instructions, trialDetails: e.target.value });
                  setHasChanges({ ...hasChanges, instructions: true });
                }}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={!canEdit}
              />
            )}
          </div>

          {hasChanges.instructions && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <ActionButton variant="primary" onClick={handleSaveInstructions} disabled={!canEdit}>
                Save Instructions
              </ActionButton>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 6: PRINT & ACTIONS ========== */}
      <ExamCard
        title="Print & Actions"
        icon={<Printer className="w-5 h-5" />}
      >
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            variant="primary"
            size="lg"
            onClick={onPrintPrescription}
            icon={<Printer className="w-4 h-4" />}
          >
            Print CL Prescription
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onEmailPrescription}
            icon={<Send className="w-4 h-4" />}
          >
            Email to Patient
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => {
              alert('Lens ordering integration coming soon');
            }}
            icon={<Send className="w-4 h-4" />}
          >
            Order Lenses
          </ActionButton>
        </div>
      </ExamCard>
        </div>
      </details>
    </div>
  );
}

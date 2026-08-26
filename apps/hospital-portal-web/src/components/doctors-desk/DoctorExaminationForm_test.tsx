'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  History,
  Droplet,
  Target,
  Stethoscope,
  FileText,
  ArrowRight,
  Save,
  CheckCircle,
} from 'lucide-react';
import AlertBanner, { Alert } from './AlertBanner';
import OptometrySummaryPanel, { OptometryData } from './OptometrySummaryPanel';

interface DoctorExaminationFormProps {
  patientId: string;
  patientData: any;
  optometryData: any;
  onSave: (data: any) => void;
  canEdit: boolean;
}

export default function DoctorExaminationForm({
  patientId,
  patientData,
  optometryData,
  onSave,
  canEdit,
}: DoctorExaminationFormProps) {
  const [activeSection, setActiveSection] = useState('history');
  
  // History Section
  const [chiefComplaint, setChiefComplaint] = useState(patientData.chiefComplaint || '');
  const [historyPresentIllness, setHistoryPresentIllness] = useState('');
  const [pastOcularHistory, setPastOcularHistory] = useState('');
  const [systemicHistory, setSystemicHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [allergies, setAllergies] = useState('');

  // Slit Lamp Examination
  const [slitLampOD, setSlitLampOD] = useState({
    lids: 'Normal',
    lidsNotes: '',
    conjunctiva: 'Normal',
    conjunctivaNotes: '',
    cornea: 'Clear',
    corneaNotes: '',
    anteriorChamber: 'Deep & Quiet',
    acNotes: '',
    iris: 'Normal',
    irisNotes: '',
    pupil: 'Round, Regular, Reactive',
    pupilNotes: '',
    lens: 'Clear',
    lensNotes: '',
    vitreous: 'Clear',
    vitreousNotes: '',
  });

  const [slitLampOS, setSlitLampOS] = useState({
    lids: 'Normal',
    lidsNotes: '',
    conjunctiva: 'Normal',
    conjunctivaNotes: '',
    cornea: 'Clear',
    corneaNotes: '',
    anteriorChamber: 'Deep & Quiet',
    acNotes: '',
    iris: 'Normal',
    irisNotes: '',
    pupil: 'Round, Regular, Reactive',
    pupilNotes: '',
    lens: 'Clear',
    lensNotes: '',
    vitreous: 'Clear',
    vitreousNotes: '',
  });

  // Fundus Examination
  const [fundusOD, setFundusOD] = useState({
    opticDisc: 'Normal',
    cdRatio: '0.3',
    discNotes: '',
    macula: 'Normal',
    maculaNotes: '',
    vessels: 'Normal',
    vesselsNotes: '',
    retina: 'Normal',
    retinaNotes: '',
    periphery: 'Normal',
    peripheryNotes: '',
  });

  const [fundusOS, setFundusOS] = useState({
    opticDisc: 'Normal',
    cdRatio: '0.3',
    discNotes: '',
    macula: 'Normal',
    maculaNotes: '',
    vessels: 'Normal',
    vesselsNotes: '',
    retina: 'Normal',
    retinaNotes: '',
    periphery: 'Normal',
    peripheryNotes: '',
  });

  // Diagnosis & Assessment
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [primaryDiagnosisICD10, setPrimaryDiagnosisICD10] = useState('');
  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState<string[]>([]);
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState('');
  const [severity, setSeverity] = useState('Mild');

  // Treatment Plan
  const [treatmentPlan, setTreatmentPlan] = useState({
    medicalManagement: false,
    medications: '',
    opticalPrescription: false,
    opticalType: '',
    specialtyReferral: false,
    specialtyClinic: '',
    surgeryRecommendation: false,
    surgeryType: '',
    investigations: [] as string[],
    followUpDate: '',
    followUpNotes: '',
  });

  // Helper function to check VA drop
  const checkVADrop = (previous: string | undefined, current: string | undefined): boolean => {
    if (!previous || !current) return false;
    
    const snellenValues: Record<string, number> = {
      '20/20': 1.0, '20/25': 0.8, '20/30': 0.67, '20/40': 0.5,
      '20/50': 0.4, '20/60': 0.33, '20/80': 0.25, '20/100': 0.2,
      '20/200': 0.1, '20/400': 0.05,
    };

    const prevValue = snellenValues[previous] || 0;
    const currValue = snellenValues[current] || 0;

    return prevValue > currValue && (prevValue - currValue) >= 0.25; // 2+ Snellen lines drop
  };

  // Generate alerts based on optometry data - temporarily simplified
  const alerts: Alert[] = [];

  const handleSave = () => {
    const formData = {
      patientId,
      chiefComplaint,
      historyPresentIllness,
      pastOcularHistory,
      systemicHistory,
      familyHistory,
      allergies,
      slitLampOD,
      slitLampOS,
      fundusOD,
      fundusOS,
      primaryDiagnosis,
      primaryDiagnosisICD10,
      secondaryDiagnoses,
      differentialDiagnoses,
      severity,
      treatmentPlan,
    };

    onSave(formData);
  };

  // Define options for dropdowns
  const lidsOptions = ['Normal', 'Blepharitis', 'Chalazion', 'Stye', 'Entropion', 'Ectropion', 'Ptosis', 'Trichiasis'];
  const conjunctivaOptions = ['Normal', 'Conjunctivitis', 'Injection', 'Chemosis', 'Pterygium', 'Pinguecula', 'Hemorrhage'];
  const corneaOptions = ['Clear', 'Edema', 'Opacity', 'Scar', 'Ulcer', 'Abrasion', 'Keratoconus', 'Dystrophy'];
  const acOptions = ['Deep & Quiet', 'Shallow', 'Cells', 'Flare', 'Hyphema', 'Hypopyon'];
  const irisOptions = ['Normal', 'Atrophy', 'Neovascularization', 'Synechiae', 'Heterochromia'];
  const pupilOptions = ['Round, Regular, Reactive', 'RAPD Present', 'Fixed Dilated', 'Fixed Constricted', 'Irregular'];
  const lensOptions = ['Clear', 'Nuclear Sclerosis', 'Cortical Cataract', 'PSC', 'Mature Cataract', 'Pseudophakia', 'Aphakia'];
  const vitreousOptions = ['Clear', 'Hemorrhage', 'Floaters', 'Syneresis', 'PVD'];

  const opticDiscOptions = ['Normal', 'Cupping', 'Pallor', 'Edema', 'Hemorrhages', 'Neovascularization'];
  const maculaOptions = ['Normal', 'Drusen', 'Edema', 'Hemorrhage', 'Scar', 'Hole', 'Degeneration'];
  const vesselsOptions = ['Normal', 'Narrowing', 'Tortuosity', 'Hemorrhages', 'Exudates', 'Cotton Wool Spots'];
  const retinaOptions = ['Normal', 'Detachment', 'Tears', 'Degeneration', 'Diabetic Retinopathy', 'Vascular Occlusion'];
  const peripheryOptions = ['Normal', 'Lattice Degeneration', 'Holes', 'Breaks', 'Pigmentary Changes'];

  const diagnosisOptions = [
    'Cataract',
    'Glaucoma - Primary Open Angle',
    'Glaucoma - Angle Closure',
    'Diabetic Retinopathy',
    'Age-Related Macular Degeneration',
    'Refractive Error',
    'Dry Eye Syndrome',
    'Conjunctivitis',
    'Corneal Ulcer',
    'Retinal Detachment',
    'Macular Hole',
    'Epiretinal Membrane',
    'Pterygium',
    'Chalazion',
    'Blepharitis',
    'Uveitis',
    'Optic Neuritis',
  ];

  const specialtyClinics = [
    'Retina Clinic',
    'Glaucoma Clinic',
    'Cataract Clinic',
    'Cornea Clinic',
    'Pediatric Clinic',
    'Neuro-Ophthalmology',
    'Oculoplasty',
    'Low Vision Clinic',
  ];

  const investigationOptions = [
    'OCT - Macula',
    'OCT - Optic Nerve',
    'Visual Field (Perimetry)',
    'Fundus Photography',
    'Fluorescein Angiography',
    'OCT Angiography',
    'Corneal Topography',
    'Ultrasound B-Scan',
    'Gonioscopy',
  ];

  const sections = [
    { id: 'history', label: 'History', icon: History },
    { id: 'slit-lamp', label: 'Slit Lamp', icon: Eye },
    { id: 'fundus', label: 'Fundus', icon: Droplet },
    { id: 'diagnosis', label: 'Diagnosis', icon: Target },
    { id: 'treatment', label: 'Treatment', icon: Stethoscope },
  ];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
      {/* Section Navigation */}
      <div className="flex border-b-2 border-gray-200 bg-gray-50">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 py-4 px-6 font-semibold text-sm transition-all flex items-center justify-center space-x-2 ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white border-b-4 border-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="p-6">
        {/* Alert Banner */}
        <AlertBanner alerts={alerts} />

        {/* Optometry Summary Panel */}
        <OptometrySummaryPanel
          data={optometryData}
          editable={canEdit}
          loading={false}
          onEdit={() => {
            // TODO: Implement override functionality - allow doctor to edit optometry values
            console.log('Override optometry values');
          }}
        />

        {/* History Section */}
        {activeSection === 'history' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <History className="w-6 h-6 mr-2 text-blue-600" />
              Patient History
            </h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Chief Complaint
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={3}
                disabled={!canEdit}
                className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Patient's main presenting complaint..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                History of Present Illness (HPI)
              </label>
              <textarea
                value={historyPresentIllness}
                onChange={(e) => setHistoryPresentIllness(e.target.value)}
                rows={4}
                disabled={!canEdit}
                className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Onset, duration, progression, associated symptoms..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Past Ocular History
                </label>
                <textarea
                  value={pastOcularHistory}
                  onChange={(e) => setPastOcularHistory(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Previous eye surgeries, trauma, treatments..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Systemic History
                </label>
                <textarea
                  value={systemicHistory}
                  onChange={(e) => setSystemicHistory(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Diabetes, hypertension, medications..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Family History
                </label>
                <textarea
                  value={familyHistory}
                  onChange={(e) => setFamilyHistory(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Glaucoma, retinal diseases, inherited conditions..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergies
                </label>
                <textarea
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Drug allergies, environmental allergies..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Slit Lamp Examination */}
        {activeSection === 'slit-lamp' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Eye className="w-6 h-6 mr-2 text-blue-600" />
              Slit Lamp Biomicroscopy
            </h3>

            {/* Side-by-Side OD/OS Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OD (Right Eye) - Left Column */}
              <div className="border-r lg:border-r-2 border-gray-300 lg:pr-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-blue-900 mb-4">OD (Right Eye)</h4>
                  
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lids & Lashes</label>
                      <select
                        value={slitLampOD.lids}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, lids: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {lidsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.lidsNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, lidsNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Conjunctiva & Sclera</label>
                      <select
                        value={slitLampOD.conjunctiva}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, conjunctiva: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {conjunctivaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.conjunctivaNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, conjunctivaNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cornea</label>
                      <select
                        value={slitLampOD.cornea}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, cornea: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {corneaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.corneaNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, corneaNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Anterior Chamber</label>
                      <select
                        value={slitLampOD.anteriorChamber}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, anteriorChamber: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {acOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.acNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, acNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Iris</label>
                      <select
                        value={slitLampOD.iris}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, iris: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {irisOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.irisNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, irisNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Pupil</label>
                      <select
                        value={slitLampOD.pupil}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, pupil: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {pupilOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.pupilNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, pupilNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lens</label>
                      <select
                        value={slitLampOD.lens}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, lens: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {lensOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.lensNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, lensNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vitreous</label>
                      <select
                        value={slitLampOD.vitreous}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, vitreous: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {vitreousOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOD.vitreousNotes}
                        onChange={(e) => setSlitLampOD({ ...slitLampOD, vitreousNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>
                </div>
              </div>

              {/* OS (Left Eye) - Right Column */}
              <div className="lg:pl-6">
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-green-900 mb-4">OS (Left Eye)</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lids & Lashes</label>
                      <select
                        value={slitLampOS.lids}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, lids: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {lidsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.lidsNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, lidsNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Conjunctiva & Sclera</label>
                      <select
                        value={slitLampOS.conjunctiva}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, conjunctiva: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {conjunctivaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.conjunctivaNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, conjunctivaNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cornea</label>
                      <select
                        value={slitLampOS.cornea}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, cornea: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {corneaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.corneaNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, corneaNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Anterior Chamber</label>
                      <select
                        value={slitLampOS.anteriorChamber}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, anteriorChamber: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {acOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.acNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, acNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Iris</label>
                      <select
                        value={slitLampOS.iris}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, iris: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {irisOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.irisNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, irisNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Pupil</label>
                      <select
                        value={slitLampOS.pupil}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, pupil: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {pupilOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.pupilNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, pupilNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Lens</label>
                      <select
                        value={slitLampOS.lens}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, lens: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {lensOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.lensNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, lensNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vitreous</label>
                      <select
                        value={slitLampOS.vitreous}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, vitreous: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {vitreousOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={slitLampOS.vitreousNotes}
                        onChange={(e) => setSlitLampOS({ ...slitLampOS, vitreousNotes: e.target.value })}
                        rows={1}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fundus Examination */}
        {activeSection === 'fundus' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Droplet className="w-6 h-6 mr-2 text-blue-600" />
              Fundus Examination (Dilated)
            </h3>

            {/* Side-by-Side OD/OS Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OD (Right Eye) - Left Column */}
              <div className="border-r lg:border-r-2 border-gray-300 lg:pr-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-blue-900 mb-4">OD (Right Eye)</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Optic Disc</label>
                      <select
                        value={fundusOD.opticDisc}
                        onChange={(e) => setFundusOD({ ...fundusOD, opticDisc: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {opticDiscOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <div className="mt-2">
                        <label className="text-xs text-gray-600">C/D Ratio</label>
                        <input
                          type="text"
                          value={fundusOD.cdRatio}
                          onChange={(e) => setFundusOD({ ...fundusOD, cdRatio: e.target.value })}
                          disabled={!canEdit}
                          className="w-full border border-gray-300 rounded-md p-2 text-sm"
                          placeholder="0.3"
                        />
                      </div>
                      <textarea
                        value={fundusOD.discNotes}
                        onChange={(e) => setFundusOD({ ...fundusOD, discNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Macula</label>
                      <select
                        value={fundusOD.macula}
                        onChange={(e) => setFundusOD({ ...fundusOD, macula: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {maculaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOD.maculaNotes}
                        onChange={(e) => setFundusOD({ ...fundusOD, maculaNotes: e.target.value })}
                        rows={3}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Blood Vessels</label>
                      <select
                        value={fundusOD.vessels}
                        onChange={(e) => setFundusOD({ ...fundusOD, vessels: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {vesselsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOD.vesselsNotes}
                        onChange={(e) => setFundusOD({ ...fundusOD, vesselsNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Retina</label>
                      <select
                        value={fundusOD.retina}
                        onChange={(e) => setFundusOD({ ...fundusOD, retina: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {retinaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOD.retinaNotes}
                        onChange={(e) => setFundusOD({ ...fundusOD, retinaNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Periphery</label>
                      <select
                        value={fundusOD.periphery}
                        onChange={(e) => setFundusOD({ ...fundusOD, periphery: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                      >
                        {peripheryOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOD.peripheryNotes}
                        onChange={(e) => setFundusOD({ ...fundusOD, peripheryNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* OS (Left Eye) - Right Column */}
              <div className="lg:pl-6">
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-green-900 mb-4">OS (Left Eye)</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Optic Disc</label>
                      <select
                        value={fundusOS.opticDisc}
                        onChange={(e) => setFundusOS({ ...fundusOS, opticDisc: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {opticDiscOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <div className="mt-2">
                        <label className="text-xs text-gray-600">C/D Ratio</label>
                        <input
                          type="text"
                          value={fundusOS.cdRatio}
                          onChange={(e) => setFundusOS({ ...fundusOS, cdRatio: e.target.value })}
                          disabled={!canEdit}
                          className="w-full border border-gray-300 rounded-md p-2 text-sm"
                          placeholder="0.3"
                        />
                      </div>
                      <textarea
                        value={fundusOS.discNotes}
                        onChange={(e) => setFundusOS({ ...fundusOS, discNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Macula</label>
                      <select
                        value={fundusOS.macula}
                        onChange={(e) => setFundusOS({ ...fundusOS, macula: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {maculaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOS.maculaNotes}
                        onChange={(e) => setFundusOS({ ...fundusOS, maculaNotes: e.target.value })}
                        rows={3}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Blood Vessels</label>
                      <select
                        value={fundusOS.vessels}
                        onChange={(e) => setFundusOS({ ...fundusOS, vessels: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {vesselsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOS.vesselsNotes}
                        onChange={(e) => setFundusOS({ ...fundusOS, vesselsNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Retina</label>
                      <select
                        value={fundusOS.retina}
                        onChange={(e) => setFundusOS({ ...fundusOS, retina: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {retinaOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOS.retinaNotes}
                        onChange={(e) => setFundusOS({ ...fundusOS, retinaNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Periphery</label>
                      <select
                        value={fundusOS.periphery}
                        onChange={(e) => setFundusOS({ ...fundusOS, periphery: e.target.value })}
                        disabled={!canEdit}
                        className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-green-500"
                      >
                        {peripheryOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <textarea
                        value={fundusOS.peripheryNotes}
                        onChange={(e) => setFundusOS({ ...fundusOS, peripheryNotes: e.target.value })}
                        rows={2}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-md p-2 mt-2 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagnosis & Assessment */}
        {activeSection === 'diagnosis' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Target className="w-6 h-6 mr-2 text-blue-600" />
              Diagnosis & Assessment
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primary Diagnosis
                </label>
                <select
                  value={primaryDiagnosis}
                  onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                >
                  <option value="">Select diagnosis...</option>
                  {diagnosisOptions.map((diag) => (
                    <option key={diag} value={diag}>{diag}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ICD-10 Code
                </label>
                <input
                  type="text"
                  value={primaryDiagnosisICD10}
                  onChange={(e) => setPrimaryDiagnosisICD10(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                  placeholder="e.g., H25.1 (Age-related cataract)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-2 focus:border-blue-500"
                >
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Differential Diagnoses
                </label>
                <textarea
                  value={differentialDiagnoses}
                  onChange={(e) => setDifferentialDiagnoses(e.target.value)}
                  rows={3}
                  disabled={!canEdit}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500"
                  placeholder="List alternative diagnoses to consider..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Treatment Plan */}
        {activeSection === 'treatment' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Stethoscope className="w-6 h-6 mr-2 text-blue-600" />
              Treatment Plan & Routing
            </h3>

            <div className="space-y-4">
              {/* Medical Management */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={treatmentPlan.medicalManagement}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, medicalManagement: e.target.checked })}
                    disabled={!canEdit}
                    className="w-5 h-5 text-purple-600"
                  />
                  <span className="font-bold text-purple-900">Medical Management (Route to Pharmacy)</span>
                </label>
                {treatmentPlan.medicalManagement && (
                  <textarea
                    value={treatmentPlan.medications}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, medications: e.target.value })}
                    rows={3}
                    disabled={!canEdit}
                    className="w-full border-2 border-purple-300 rounded-lg p-3"
                    placeholder="Medications, dosage, duration..."
                  />
                )}
              </div>

              {/* Optical Prescription */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={treatmentPlan.opticalPrescription}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, opticalPrescription: e.target.checked })}
                    disabled={!canEdit}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="font-bold text-blue-900">Optical Prescription (Route to Spectacles/Contact Lens)</span>
                </label>
                {treatmentPlan.opticalPrescription && (
                  <select
                    value={treatmentPlan.opticalType}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, opticalType: e.target.value })}
                    disabled={!canEdit}
                    className="w-full border-2 border-blue-300 rounded-lg p-2"
                  >
                    <option value="">Select type...</option>
                    <option value="Spectacles">Spectacles</option>
                    <option value="ContactLens">Contact Lens</option>
                  </select>
                )}
              </div>

              {/* Specialty Referral */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={treatmentPlan.specialtyReferral}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, specialtyReferral: e.target.checked })}
                    disabled={!canEdit}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="font-bold text-green-900">Specialty Clinic Referral</span>
                </label>
                {treatmentPlan.specialtyReferral && (
                  <select
                    value={treatmentPlan.specialtyClinic}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, specialtyClinic: e.target.value })}
                    disabled={!canEdit}
                    className="w-full border-2 border-green-300 rounded-lg p-2"
                  >
                    <option value="">Select clinic...</option>
                    {specialtyClinics.map((clinic) => (
                      <option key={clinic} value={clinic}>{clinic}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Surgery Recommendation */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={treatmentPlan.surgeryRecommendation}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, surgeryRecommendation: e.target.checked })}
                    disabled={!canEdit}
                    className="w-5 h-5 text-red-600"
                  />
                  <span className="font-bold text-red-900">Surgery Recommendation (Route to Counselor)</span>
                </label>
                {treatmentPlan.surgeryRecommendation && (
                  <input
                    type="text"
                    value={treatmentPlan.surgeryType}
                    onChange={(e) => setTreatmentPlan({ ...treatmentPlan, surgeryType: e.target.value })}
                    disabled={!canEdit}
                    className="w-full border-2 border-red-300 rounded-lg p-2"
                    placeholder="Type of surgery recommended..."
                  />
                )}
              </div>

              {/* Investigations */}
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <p className="font-bold text-yellow-900 mb-3">Investigations Required</p>
                <div className="grid grid-cols-3 gap-3">
                  {investigationOptions.map((inv) => (
                    <label key={inv} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={treatmentPlan.investigations.includes(inv)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTreatmentPlan({
                              ...treatmentPlan,
                              investigations: [...treatmentPlan.investigations, inv],
                            });
                          } else {
                            setTreatmentPlan({
                              ...treatmentPlan,
                              investigations: treatmentPlan.investigations.filter((i) => i !== inv),
                            });
                          }
                        }}
                        disabled={!canEdit}
                        className="w-4 h-4 text-yellow-600"
                      />
                      <span className="text-sm">{inv}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Follow-up */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                <p className="font-bold text-gray-900 mb-3">Follow-up</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={treatmentPlan.followUpDate}
                      onChange={(e) => setTreatmentPlan({ ...treatmentPlan, followUpDate: e.target.value })}
                      disabled={!canEdit}
                      className="w-full border-2 border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Follow-up Notes
                    </label>
                    <input
                      type="text"
                      value={treatmentPlan.followUpNotes}
                      onChange={(e) => setTreatmentPlan({ ...treatmentPlan, followUpNotes: e.target.value })}
                      disabled={!canEdit}
                      className="w-full border-2 border-gray-300 rounded-lg p-2"
                      placeholder="e.g., Post-op review, IOP check"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="bg-gray-50 border-t-2 border-gray-200 p-6 flex justify-end space-x-4">
        <button
          onClick={handleSave}
          disabled={!canEdit}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          <span>Save & Route Patient</span>
        </button>
      </div>
    </div>
  );
}

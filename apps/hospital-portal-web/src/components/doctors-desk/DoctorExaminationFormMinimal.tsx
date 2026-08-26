'use client';

import { useState, useMemo } from 'react';
import { Save, History, Eye, Droplet, Target, Stethoscope } from 'lucide-react';
import AlertBanner, { Alert } from './AlertBanner';
import OptometrySummaryPanel from './OptometrySummaryPanel';

interface DoctorExaminationFormProps {
  patientId: string;
  patientData: any;
  optometryData: any;
  onSave: (data: any) => void;
  canEdit: boolean;
}

export default function DoctorExaminationFormMinimal({
  patientId,
  patientData,
  optometryData,
  onSave,
  canEdit,
}: DoctorExaminationFormProps) {
  const [activeSection, setActiveSection] = useState('history');
  const [chiefComplaint, setChiefComplaint] = useState(patientData?.chiefComplaint || '');
  const [historyPresentIllness, setHistoryPresentIllness] = useState('');
  
  // Slit Lamp state
  const [slitLampOD, setSlitLampOD] = useState({
    lids: 'Normal',
    conjunctiva: 'Normal',
    cornea: 'Clear',
    lens: 'Clear',
  });
  
  const [slitLampOS, setSlitLampOS] = useState({
    lids: 'Normal',
    conjunctiva: 'Normal',
    cornea: 'Clear',
    lens: 'Clear',
  });
  
  // Fundus state
  const [fundusOD, setFundusOD] = useState({
    opticDisc: 'Normal',
    macula: 'Normal',
    vessels: 'Normal',
    retina: 'Normal',
  });
  
  const [fundusOS, setFundusOS] = useState({
    opticDisc: 'Normal',
    macula: 'Normal',
    vessels: 'Normal',
    retina: 'Normal',
  });

  // Generate alerts based on optometry data
  const alerts = useMemo(() => {
    if (!optometryData) return [];
    const generatedAlerts: Alert[] = [];

    // High IOP alert
    if (optometryData.iop) {
      if (optometryData.iop.od && optometryData.iop.od > 21) {
        generatedAlerts.push({
          id: 'high-iop-od',
          severity: 'critical',
          message: `High IOP detected in right eye: ${optometryData.iop.od} mmHg`,
          details: 'Immediate evaluation required.',
        });
      }
      if (optometryData.iop.os && optometryData.iop.os > 21) {
        generatedAlerts.push({
          id: 'high-iop-os',
          severity: 'critical',
          message: `High IOP detected in left eye: ${optometryData.iop.os} mmHg`,
          details: 'Immediate evaluation required.',
        });
      }
    }

    return generatedAlerts;
  }, [optometryData]);

  const sections = [
    { id: 'history', label: 'History', icon: History },
    { id: 'slit-lamp', label: 'Slit Lamp', icon: Eye },
    { id: 'fundus', label: 'Fundus', icon: Droplet },
    { id: 'diagnosis', label: 'Diagnosis', icon: Target },
    { id: 'treatment', label: 'Treatment', icon: Stethoscope },
  ];

  const handleSave = () => {
    onSave({ 
      patientId, 
      chiefComplaint, 
      historyPresentIllness,
      slitLampOD,
      slitLampOS,
      fundusOD,
      fundusOS,
    });
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="p-6 pb-0">
          <AlertBanner alerts={alerts} />
        </div>
      )}

      {/* Optometry Summary Panel */}
      {optometryData && (
        <div className="p-6 pb-0">
          <OptometrySummaryPanel
            data={optometryData}
            onEdit={() => console.log('Edit optometry data')}
            editable={false}
          />
        </div>
      )}

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
              <Icon className="w-5 h-5" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="p-6">
        {activeSection === 'history' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Patient History</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">Chief Complaint</label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="Patient's main complaint..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">History of Present Illness</label>
              <textarea
                value={historyPresentIllness}
                onChange={(e) => setHistoryPresentIllness(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="Onset, duration, associated symptoms..."
              />
            </div>
          </div>
        )}

        {activeSection === 'slit-lamp' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Slit Lamp Examination</h3>
            
            {/* Side-by-side OD/OS Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OD (Right Eye) */}
              <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-blue-900 mb-3">OD (Right Eye)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Lids</label>
                    <select
                      value={slitLampOD.lids}
                      onChange={(e) => setSlitLampOD({...slitLampOD, lids: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Blepharitis</option>
                      <option>Ptosis</option>
                      <option>Chalazion</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Conjunctiva</label>
                    <select
                      value={slitLampOD.conjunctiva}
                      onChange={(e) => setSlitLampOD({...slitLampOD, conjunctiva: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Injection</option>
                      <option>Chemosis</option>
                      <option>Pterygium</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Cornea</label>
                    <select
                      value={slitLampOD.cornea}
                      onChange={(e) => setSlitLampOD({...slitLampOD, cornea: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Clear</option>
                      <option>Edema</option>
                      <option>Opacity</option>
                      <option>Ulcer</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Lens</label>
                    <select
                      value={slitLampOD.lens}
                      onChange={(e) => setSlitLampOD({...slitLampOD, lens: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Clear</option>
                      <option>Nuclear Sclerosis</option>
                      <option>Cortical Cataract</option>
                      <option>PSC</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* OS (Left Eye) */}
              <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                <h4 className="font-semibold text-green-900 mb-3">OS (Left Eye)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Lids</label>
                    <select
                      value={slitLampOS.lids}
                      onChange={(e) => setSlitLampOS({...slitLampOS, lids: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Blepharitis</option>
                      <option>Ptosis</option>
                      <option>Chalazion</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Conjunctiva</label>
                    <select
                      value={slitLampOS.conjunctiva}
                      onChange={(e) => setSlitLampOS({...slitLampOS, conjunctiva: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Injection</option>
                      <option>Chemosis</option>
                      <option>Pterygium</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Cornea</label>
                    <select
                      value={slitLampOS.cornea}
                      onChange={(e) => setSlitLampOS({...slitLampOS, cornea: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Clear</option>
                      <option>Edema</option>
                      <option>Opacity</option>
                      <option>Ulcer</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Lens</label>
                    <select
                      value={slitLampOS.lens}
                      onChange={(e) => setSlitLampOS({...slitLampOS, lens: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Clear</option>
                      <option>Nuclear Sclerosis</option>
                      <option>Cortical Cataract</option>
                      <option>PSC</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'fundus' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Fundus Examination</h3>
            
            {/* Side-by-side OD/OS Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OD (Right Eye) */}
              <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-blue-900 mb-3">OD (Right Eye)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Optic Disc</label>
                    <select
                      value={fundusOD.opticDisc}
                      onChange={(e) => setFundusOD({...fundusOD, opticDisc: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Cupping</option>
                      <option>Pallor</option>
                      <option>Edema</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Macula</label>
                    <select
                      value={fundusOD.macula}
                      onChange={(e) => setFundusOD({...fundusOD, macula: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Drusen</option>
                      <option>Edema</option>
                      <option>Hemorrhage</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Vessels</label>
                    <select
                      value={fundusOD.vessels}
                      onChange={(e) => setFundusOD({...fundusOD, vessels: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Narrowing</option>
                      <option>Tortuosity</option>
                      <option>Hemorrhages</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Retina</label>
                    <select
                      value={fundusOD.retina}
                      onChange={(e) => setFundusOD({...fundusOD, retina: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Detachment</option>
                      <option>Tears</option>
                      <option>Diabetic Retinopathy</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* OS (Left Eye) */}
              <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                <h4 className="font-semibold text-green-900 mb-3">OS (Left Eye)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Optic Disc</label>
                    <select
                      value={fundusOS.opticDisc}
                      onChange={(e) => setFundusOS({...fundusOS, opticDisc: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Cupping</option>
                      <option>Pallor</option>
                      <option>Edema</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Macula</label>
                    <select
                      value={fundusOS.macula}
                      onChange={(e) => setFundusOS({...fundusOS, macula: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Drusen</option>
                      <option>Edema</option>
                      <option>Hemorrhage</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Vessels</label>
                    <select
                      value={fundusOS.vessels}
                      onChange={(e) => setFundusOS({...fundusOS, vessels: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Narrowing</option>
                      <option>Tortuosity</option>
                      <option>Hemorrhages</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Retina</label>
                    <select
                      value={fundusOS.retina}
                      onChange={(e) => setFundusOS({...fundusOS, retina: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Normal</option>
                      <option>Detachment</option>
                      <option>Tears</option>
                      <option>Diabetic Retinopathy</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'diagnosis' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Diagnosis & Assessment</h3>
            <p className="text-gray-500">Diagnosis form will be added here...</p>
          </div>
        )}

        {activeSection === 'treatment' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Treatment Plan</h3>
            <p className="text-gray-500">Treatment plan form will be added here...</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="bg-gray-50 border-t-2 border-gray-200 p-6 flex justify-end">
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

'use client';

import { useState } from 'react';
import { useEpTypes } from '@/hooks/use-lab-masters';

interface ElectrophysiologyData {
  patientId: string;
  examinationDate: Date;
  examinerId: string;
  testType: 'ERG' | 'VEP' | 'EOG' | 'Multifocal ERG' | 'Pattern ERG';
  device: {
    manufacturer: string;
    model: string;
  };
  ERG?: {
    OD: {
      scotopicResponse: { amplitude: number; latency: number };
      photopicResponse: { amplitude: number; latency: number };
      flickerResponse: { amplitude: number; latency: number };
      interpretation: string;
    };
    OS: {
      scotopicResponse: { amplitude: number; latency: number };
      photopicResponse: { amplitude: number; latency: number };
      flickerResponse: { amplitude: number; latency: number };
      interpretation: string;
    };
  };
  VEP?: {
    OD: { p100Latency: number; p100Amplitude: number; interpretation: string };
    OS: { p100Latency: number; p100Amplitude: number; interpretation: string };
  };
  EOG?: {
    OD: { lightPeak: number; darkTrough: number; ardenRatio: number; interpretation: string };
    OS: { lightPeak: number; darkTrough: number; ardenRatio: number; interpretation: string };
  };
  notes?: string;
}

interface ElectrophysiologyFormProps {
  patientId: string;
  initialData?: Partial<ElectrophysiologyData> | null;
  onSave: (data: ElectrophysiologyData) => Promise<void>;
  readOnly?: boolean;
}

export default function ElectrophysiologyForm({ patientId, initialData, onSave, readOnly = false }: ElectrophysiologyFormProps) {
  const { types: epTypes } = useEpTypes();
  const [formData, setFormData] = useState<ElectrophysiologyData>({
    patientId,
    examinationDate: initialData?.examinationDate || new Date(),
    examinerId: initialData?.examinerId || '',
    testType: initialData?.testType || 'ERG',
    device: initialData?.device || { manufacturer: 'LKC Technologies', model: 'RETeval' },
    notes: initialData?.notes || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      alert('Failed to save electrophysiology data');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow rounded-lg p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
            <select
              value={formData.testType}
              onChange={(e) => setFormData({ ...formData, testType: e.target.value as ElectrophysiologyData['testType'] })}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {epTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              {formData.testType &&
                !epTypes.some((t) => t.value === formData.testType) && (
                  <option value={formData.testType}>{formData.testType}</option>
                )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
            <select value={`${formData.device.manufacturer}|${formData.device.model}`} onChange={e => { const [manufacturer, model] = e.target.value.split('|'); setFormData({ ...formData, device: { manufacturer, model } }); }} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="LKC Technologies|RETeval">LKC RETeval (Portable ERG)</option>
              <option value="Diagnosys|Espion E3">Diagnosys Espion E3</option>
              <option value="Roland Consult|RETI-port">Roland RETI-port</option>
              <option value="Metrovision|MonPackONE">Metrovision MonPackONE (VEP)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>ERG</strong>: Measures retinal electrical activity (rods, cones, bipolar cells)<br/>
          <strong>VEP</strong>: Visual Evoked Potential - tests optic nerve and visual cortex function<br/>
          <strong>EOG</strong>: Electrooculography - measures retinal pigment epithelium function<br/>
          Full implementation with amplitude/latency measurements coming soon.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} disabled={readOnly} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Document test conditions, patient cooperation, findings..." />
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
            {isSaving ? 'Saving...' : 'Save Electrophysiology Test'}
          </button>
        </div>
      )}
    </form>
  );
}

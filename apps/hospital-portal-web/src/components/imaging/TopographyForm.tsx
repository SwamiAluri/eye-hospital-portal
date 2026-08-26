'use client';

import { useState } from 'react';

interface TopographyData {
  patientId: string;
  examinationDate: Date;
  examinerId: string;
  device: { manufacturer: string; model: string; type: 'Placido' | 'Scheimpflug' | 'OCT' };
  OD: {
    simK1: number; simK2: number; axis: number;
    keratoconusIndices?: { kmax?: number; ISValue?: number; KISA?: number };
    interpretation: string;
  };
  OS: {
    simK1: number; simK2: number; axis: number;
    keratoconusIndices?: { kmax?: number; ISValue?: number; KISA?: number };
    interpretation: string;
  };
  notes?: string;
}

interface TopographyFormProps {
  patientId: string;
  initialData?: Partial<TopographyData> | null;
  onSave: (data: TopographyData) => Promise<void>;
  readOnly?: boolean;
}

export default function TopographyForm({ patientId, initialData, onSave, readOnly = false }: TopographyFormProps) {
  const [formData, setFormData] = useState<TopographyData>({
    patientId,
    examinationDate: initialData?.examinationDate || new Date(),
    examinerId: initialData?.examinerId || '',
    device: initialData?.device || { manufacturer: 'CSO', model: 'Sirius', type: 'Scheimpflug' },
    OD: initialData?.OD || { simK1: 43.0, simK2: 44.0, axis: 90, interpretation: '' },
    OS: initialData?.OS || { simK1: 43.0, simK2: 44.0, axis: 90, interpretation: '' },
    notes: initialData?.notes || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      alert('Failed to save topography data');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow rounded-lg p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imaging Type</label>
            <select value={formData.device.type} onChange={e => setFormData({ ...formData, device: { ...formData.device, type: e.target.value as any } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option>Placido</option>
              <option>Scheimpflug</option>
              <option>OCT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
            <select value={`${formData.device.manufacturer}|${formData.device.model}`} onChange={e => { const [manufacturer, model] = e.target.value.split('|'); setFormData({ ...formData, device: { ...formData.device, manufacturer, model } }); }} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="CSO|Sirius">CSO Sirius (Scheimpflug)</option>
              <option value="Oculus|Pentacam HR">Oculus Pentacam HR (Scheimpflug)</option>
              <option value="Topcon|CA-800">Topcon CA-800 (Placido)</option>
              <option value="Zeiss|Atlas">Zeiss Atlas (Placido)</option>
              <option value="Optovue|iVue">Optovue iVue (OCT)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>Placido</strong>: Corneal curvature surface analysis<br/>
          <strong>Scheimpflug</strong>: 3D corneal thickness, anterior chamber depth, lens analysis<br/>
          <strong>Keratoconus Indices</strong>: Kmax (&gt;47D suspect), I-S value (&gt;1.4D suspect), KISA% (&gt;100% high risk)<br/>
          Full keratoconus screening implementation with corneal maps coming soon.
        </p>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Right Eye (OD)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sim K1 (D)</label>
            <input type="number" step="0.01" value={formData.OD.simK1} onChange={e => setFormData({ ...formData, OD: { ...formData.OD, simK1: parseFloat(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sim K2 (D)</label>
            <input type="number" step="0.01" value={formData.OD.simK2} onChange={e => setFormData({ ...formData, OD: { ...formData.OD, simK2: parseFloat(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
            <input type="number" value={formData.OD.axis} onChange={e => setFormData({ ...formData, OD: { ...formData.OD, axis: parseInt(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Left Eye (OS)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sim K1 (D)</label>
            <input type="number" step="0.01" value={formData.OS.simK1} onChange={e => setFormData({ ...formData, OS: { ...formData.OS, simK1: parseFloat(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sim K2 (D)</label>
            <input type="number" step="0.01" value={formData.OS.simK2} onChange={e => setFormData({ ...formData, OS: { ...formData.OS, simK2: parseFloat(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
            <input type="number" value={formData.OS.axis} onChange={e => setFormData({ ...formData, OS: { ...formData.OS, axis: parseInt(e.target.value) || 0 } })} disabled={readOnly} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} disabled={readOnly} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Document corneal irregularities, keratoconus risk, refractive surgery candidacy..." />
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
            {isSaving ? 'Saving...' : 'Save Topography'}
          </button>
        </div>
      )}
    </form>
  );
}

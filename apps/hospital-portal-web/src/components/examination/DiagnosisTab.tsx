'use client';

import { useState, useEffect } from 'react';
import { ExamCard, ExamInput, ExamSelect, StatusBadge, ActionButton } from './ExamCard';
import { Stethoscope, Plus, Edit2, Trash2, Star, Printer, Copy, Eye, ChevronDown, ChevronUp, Search, Scissors } from 'lucide-react';
import { ICD10SearchPanel } from '@/components/clinical/ICD10SearchPanel';
import SurgeryRecommendationDialog from '@/components/doctors-desk/SurgeryRecommendationDialog';
import type { DiagnosisCode } from '@/types/diagnosis';
import { createSurgeryRecommendation } from '@/lib/surgery-api';
import type { SurgeryRecommendationDto } from '@/lib/surgery-api';
import toast from 'react-hot-toast';

// Type definitions for Diagnosis
interface Diagnosis {
  id: string;
  icd10Code: string;
  description: string;
  laterality: string;
  severity: string;
  status: string;
  isPrimary: boolean;
  clinicalNotes?: string;
}

interface DiagnosisTabProps {
  diagnoses: Diagnosis[] | null;
  canEdit: boolean;
  onSaveDiagnoses: (diagnoses: Diagnosis[]) => void;
  onCopyPreviousDiagnoses: () => void;
  onPrintSummary: () => void;
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
}

export default function DiagnosisTab({
  diagnoses,
  canEdit,
  onSaveDiagnoses,
  onCopyPreviousDiagnoses,
  onPrintSummary,
  patientId,
  patientName,
  patientAge,
  patientGender,
}: DiagnosisTabProps) {
  // ========== STATE ==========
  const [diagnosisList, setDiagnosisList] = useState<Diagnosis[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [icdPanelExpanded, setIcdPanelExpanded] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<Diagnosis | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Surgery recommendation state
  const [showSurgeryDialog, setShowSurgeryDialog] = useState(false);
  const [selectedDiagnosisForSurgery, setSelectedDiagnosisForSurgery] = useState<Diagnosis | null>(null);

  // New diagnosis form
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIcd10, setSelectedIcd10] = useState<{ code: string; description: string } | null>(
    null
  );
  const [newDiagnosis, setNewDiagnosis] = useState<Partial<Diagnosis>>({
    laterality: 'Both Eyes (Bilateral)',
    severity: 'Not Applicable',
    status: 'New',
    isPrimary: false,
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Load initial data
  useEffect(() => {
    if (diagnoses) {
      setDiagnosisList(diagnoses);
    }
  }, [diagnoses]);

  useEffect(() => {
    if (canEdit && diagnosisList.length === 0) {
      setIcdPanelExpanded(true);
    }
  }, [canEdit, diagnosisList.length]);

  // ========== COMMON ICD-10 CODES ==========
  const commonIcd10Codes = [
    { code: 'H40.11', description: 'Primary Open-Angle Glaucoma' },
    { code: 'H25.9', description: 'Unspecified Age-Related Cataract' },
    { code: 'H52.0', description: 'Hyperopia' },
    { code: 'H52.1', description: 'Myopia' },
    { code: 'H52.2', description: 'Astigmatism' },
    { code: 'H52.4', description: 'Presbyopia' },
    { code: 'H43.1', description: 'Vitreous Hemorrhage' },
    { code: 'H35.3', description: 'Degeneration of Macula and Posterior Pole' },
    { code: 'E11.3', description: 'Type 2 Diabetes with Diabetic Retinopathy' },
    { code: 'E10.3', description: 'Type 1 Diabetes with Diabetic Retinopathy' },
    { code: 'H16.0', description: 'Corneal Ulcer' },
    { code: 'H10.1', description: 'Acute Conjunctivitis' },
    { code: 'H04.12', description: 'Dry Eye Syndrome' },
    { code: 'H26.9', description: 'Unspecified Cataract' },
    { code: 'H35.31', description: 'Age-Related Macular Degeneration (Dry)' },
    { code: 'H35.32', description: 'Age-Related Macular Degeneration (Wet)' },
    { code: 'H53.2', description: 'Diplopia (Double Vision)' },
    { code: 'H53.1', description: 'Subjective Visual Disturbances' },
    { code: 'H44.2', description: 'Degenerative Myopia' },
    { code: 'H02.0', description: 'Entropion and Trichiasis' },
  ];

  // ========== HELPERS ==========
  const generateId = () => Math.random().toString(36).substring(2, 11);

  const getFilteredIcd10Codes = () => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return commonIcd10Codes.filter(
      (item) =>
        item.code.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
    );
  };

  const handleICD10DialogSelect = (
    code: DiagnosisCode,
    laterality: 'OD' | 'OS' | 'OU',
    isPrimary: boolean
  ) => {
    // Map laterality to display format
    const lateralityMap = {
      OD: 'OD only (Right Eye)',
      OS: 'OS only (Left Eye)',
      OU: 'Both Eyes (Bilateral)',
    };

    const diagnosis: Diagnosis = {
      id: generateId(),
      icd10Code: code.code,
      description: code.description,
      laterality: lateralityMap[laterality],
      severity: 'Not Applicable',
      status: 'New',
      isPrimary: isPrimary,
      clinicalNotes: code.clinicalNotes,
    };

    let updated = [...diagnosisList, diagnosis];

    // If this diagnosis is marked as primary, unmark all others
    if (diagnosis.isPrimary) {
      updated = updated.map((d) =>
        d.id === diagnosis.id ? d : { ...d, isPrimary: false }
      );
    }

    setDiagnosisList(updated);
    onSaveDiagnoses(updated);
  };

  const getExistingDiagnosisCodes = (): DiagnosisCode[] => {
    return diagnosisList.map((d) => ({
      id: d.id,
      code: d.icd10Code,
      description: d.description,
      category: '',
      icdVersion: 'ICD-10',
      isOphthalmology: true,
    }));
  };

  const handleSelectCommonChip = (item: { code: string; description: string }) => {
    setSelectedIcd10(item);
    setNewDiagnosis({ ...newDiagnosis, icd10Code: item.code, description: item.description });
    setShowAddForm(true);
  };

  const handleSelectIcd10 = (item: { code: string; description: string }) => {
    setSelectedIcd10(item);
    setNewDiagnosis({ ...newDiagnosis, icd10Code: item.code, description: item.description });
    setSearchTerm('');
  };

  const handleAddDiagnosis = () => {
    if (!selectedIcd10 || !newDiagnosis.description) {
      alert('Please select an ICD-10 code and description');
      return;
    }

    const diagnosis: Diagnosis = {
      id: editingDiagnosis?.id || generateId(),
      icd10Code: selectedIcd10.code,
      description: newDiagnosis.description!,
      laterality: newDiagnosis.laterality!,
      severity: newDiagnosis.severity!,
      status: newDiagnosis.status!,
      isPrimary: newDiagnosis.isPrimary!,
      clinicalNotes: newDiagnosis.clinicalNotes,
    };

    let updated: Diagnosis[];

    if (editingDiagnosis) {
      updated = diagnosisList.map((d) => (d.id === editingDiagnosis.id ? diagnosis : d));
    } else {
      updated = [...diagnosisList, diagnosis];
    }

    // If this diagnosis is marked as primary, unmark all others
    if (diagnosis.isPrimary) {
      updated = updated.map((d) =>
        d.id === diagnosis.id ? d : { ...d, isPrimary: false }
      );
    }

    setDiagnosisList(updated);
    onSaveDiagnoses(updated);
    resetForm();
    setHasChanges(false);
  };

  const resetForm = () => {
    setNewDiagnosis({
      laterality: 'Both Eyes (Bilateral)',
      severity: 'Not Applicable',
      status: 'New',
      isPrimary: false,
    });
    setSelectedIcd10(null);
    setSearchTerm('');
    setShowAddForm(false);
    setEditingDiagnosis(null);
  };

  const handleEditDiagnosis = (diagnosis: Diagnosis) => {
    setEditingDiagnosis(diagnosis);
    setSelectedIcd10({ code: diagnosis.icd10Code, description: diagnosis.description });
    setNewDiagnosis(diagnosis);
    setShowAddForm(true);
  };

  const handleDeleteDiagnosis = (id: string) => {
    if (confirm('Delete this diagnosis?')) {
      const updated = diagnosisList.filter((d) => d.id !== id);
      setDiagnosisList(updated);
      onSaveDiagnoses(updated);
    }
  };

  const handleTogglePrimary = (id: string) => {
    const updated = diagnosisList.map((d) =>
      d.id === id ? { ...d, isPrimary: !d.isPrimary } : { ...d, isPrimary: false }
    );
    setDiagnosisList(updated);
    onSaveDiagnoses(updated);
  };

  const toggleNotes = (id: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNotes(newExpanded);
  };

  // Check if diagnosis qualifies for surgery recommendation
  const qualifiesForSurgery = (icd10Code: string): boolean => {
    const code = icd10Code.toUpperCase();
    // H25/H26 - Cataract
    if (code.startsWith('H25') || code.startsWith('H26')) return true;
    // H40 - Glaucoma
    if (code.startsWith('H40')) return true;
    // H33/H35 - Retinal conditions
    if (code.startsWith('H33') || code.startsWith('H35')) return true;
    // H16-H18 - Corneal conditions
    if (code.startsWith('H16') || code.startsWith('H17') || code.startsWith('H18')) return true;
    return false;
  };

  const getSurgeryType = (icd10Code: string): 'Cataract' | 'Glaucoma' | 'Vitreoretinal' | 'Corneal' => {
    const code = icd10Code.toUpperCase();
    if (code.startsWith('H25') || code.startsWith('H26')) return 'Cataract';
    if (code.startsWith('H40')) return 'Glaucoma';
    if (code.startsWith('H33') || code.startsWith('H35')) return 'Vitreoretinal';
    if (code.startsWith('H16') || code.startsWith('H17') || code.startsWith('H18')) return 'Corneal';
    return 'Cataract'; // Default
  };

  const handleRecommendSurgery = (diagnosis: Diagnosis) => {
    setSelectedDiagnosisForSurgery(diagnosis);
    setShowSurgeryDialog(true);
  };

  const handleSurgerySubmit = async (recommendation: any) => {
    if (!patientId) {
      toast.error('Patient ID not available');
      return;
    }

    try {
      // Map the surgery recommendation to the API format
      const surgeryRecommendation: SurgeryRecommendationDto = {
        patientId,
        surgeryType: recommendation.surgeryType,
        procedureType: recommendation.subType || '',
        eye: recommendation.eye,
        diagnosisCode: selectedDiagnosisForSurgery?.icd10Code,
        diagnosisDescription: selectedDiagnosisForSurgery?.description,
        packageType: recommendation.packageType,
        packagePrice: recommendation.packagePrice,
        iolFormula: recommendation.iolFormula,
        iolPower: recommendation.iolPower,
        preOpChecklist: recommendation.preOpChecklist,
        urgency: recommendation.urgency === 'Routine' ? 'routine' : recommendation.urgency === 'Urgent' ? 'urgent' : 'emergency',
        notes: recommendation.notes,
        specialInstructions: recommendation.counselorNotes,
        preferredDate: recommendation.surgeryDate?.toISOString(),
      };

      await createSurgeryRecommendation(surgeryRecommendation);
      toast.success('Surgery recommendation created successfully! Referred to counselor.');
      setShowSurgeryDialog(false);
      setSelectedDiagnosisForSurgery(null);
    } catch (error: any) {
      console.error('Error creating surgery recommendation:', error);
      toast.error(error.response?.data?.message || 'Failed to create surgery recommendation');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'mild':
        return 'emerald';
      case 'moderate':
        return 'amber';
      case 'severe':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'blue';
      case 'existing':
        return 'gray';
      case 'worsening':
        return 'orange';
      case 'improving':
        return 'emerald';
      case 'resolved':
        return 'green';
      default:
        return 'gray';
    }
  };

  const groupDiagnosesByLaterality = () => {
    const groups: { [key: string]: Diagnosis[] } = {
      'Both Eyes (Bilateral)': [],
      'OD only (Right Eye)': [],
      'OS only (Left Eye)': [],
      'Not Applicable': [],
    };

    diagnosisList.forEach((d) => {
      if (groups[d.laterality]) {
        groups[d.laterality].push(d);
      }
    });

    return groups;
  };

  // ========== RENDER ==========
  const filteredCodes = getFilteredIcd10Codes();
  const groupedDiagnoses = groupDiagnosesByLaterality();

  return (
    <div className="space-y-4">
      {/* ========== SECTION 1: CLINICAL DIAGNOSIS ========== */}
      <ExamCard
        title="Clinical Diagnosis"

        icon={<Stethoscope className="w-5 h-5" />}
      >
        <div className="space-y-3">
          {!showAddForm && !icdPanelExpanded && canEdit && (
            <button
              type="button"
              onClick={() => setIcdPanelExpanded(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search ICD-10
            </button>
          )}

          {!showAddForm && canEdit && (
            <ICD10SearchPanel
              expanded={icdPanelExpanded}
              onDone={() => setIcdPanelExpanded(false)}
              onSelect={handleICD10DialogSelect}
              patientId={patientId}
              patientAge={patientAge}
              patientGender={patientGender}
              existingDiagnoses={getExistingDiagnosisCodes()}
            />
          )}

          {/* Legacy search - kept for backward compatibility but hidden by default */}
          {!showAddForm && false && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search ICD-10 Code or Description (Legacy)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search diagnosis..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={!canEdit}
                />
                {filteredCodes.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCodes.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          handleSelectIcd10(item);
                          setShowAddForm(true);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-semibold text-emerald-700">{item.code}</span>
                        <span className="text-gray-600 ml-2">- {item.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Common ICD-10 Quick Select */}
          {!showAddForm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Common Eye Conditions (Quick Select)
              </label>
              <div className="flex flex-wrap gap-2">
                {commonIcd10Codes.slice(0, 10).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelectCommonChip(item)}
                    disabled={!canEdit}
                    className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {item.code} - {item.description}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Diagnosis Entry Form - Shows only when diagnosis is selected */}
          {showAddForm && selectedIcd10 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-blue-900">
                  {editingDiagnosis ? 'Edit Diagnosis' : 'Add New Diagnosis'}
                </h5>
                <button
                  onClick={resetForm}
                  className="text-sm text-blue-700 hover:text-blue-800"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ICD-10 Code
                  </label>
                  <div className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold">
                    {selectedIcd10.code}
                  </div>
                </div>

                <ExamInput
                  label="Description"
                  type="text"
                  value={newDiagnosis.description || ''}
                  onChange={(e) =>
                    setNewDiagnosis({ ...newDiagnosis, description: e.target.value })
                  }
                  disabled={!canEdit}
                />

                <ExamSelect
                  label="Laterality"
                  value={newDiagnosis.laterality || ''}
                  onChange={(value) =>
                    setNewDiagnosis({ ...newDiagnosis, laterality: value })
                  }
                  disabled={!canEdit}
                >
                  <option value="Both Eyes (Bilateral)">Both Eyes (Bilateral)</option>
                  <option value="OD only (Right Eye)">OD only (Right Eye)</option>
                  <option value="OS only (Left Eye)">OS only (Left Eye)</option>
                  <option value="Not Applicable">Not Applicable (Systemic)</option>
                </ExamSelect>

                <ExamSelect
                  label="Severity"
                  value={newDiagnosis.severity || ''}
                  onChange={(value) => setNewDiagnosis({ ...newDiagnosis, severity: value })}
                  disabled={!canEdit}
                >
                  <option value="Not Applicable">Not Applicable</option>
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </ExamSelect>

                <ExamSelect
                  label="Status"
                  value={newDiagnosis.status || ''}
                  onChange={(value) => setNewDiagnosis({ ...newDiagnosis, status: value })}
                  disabled={!canEdit}
                >
                  <option value="New">New (newly diagnosed today)</option>
                  <option value="Existing">Existing (previously diagnosed)</option>
                  <option value="Worsening">Worsening (getting worse)</option>
                  <option value="Improving">Improving (getting better)</option>
                  <option value="Resolved">Resolved</option>
                </ExamSelect>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDiagnosis.isPrimary}
                      onChange={(e) =>
                        setNewDiagnosis({ ...newDiagnosis, isPrimary: e.target.checked })
                      }
                      disabled={!canEdit}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Mark as Primary Diagnosis
                    </span>
                  </label>
                </div>
              </div>

              <ExamInput
                label="Clinical Notes"
                value={newDiagnosis.clinicalNotes || ''}
                onChange={(e) =>
                  setNewDiagnosis({ ...newDiagnosis, clinicalNotes: e.target.value })
                }
                disabled={!canEdit}
                className="md:col-span-3"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-300 md:col-span-3">
                <ActionButton variant="secondary" onClick={resetForm}>
                  Cancel
                </ActionButton>
                <ActionButton variant="primary" onClick={handleAddDiagnosis} disabled={!canEdit}>
                  {editingDiagnosis ? 'Update' : 'Add Diagnosis'}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </ExamCard>

      {/* ========== SECTION 2: DIAGNOSIS SUMMARY (THIS VISIT) ========== */}
      <ExamCard
        title="Diagnosis Summary (This Visit)"
        icon={<Stethoscope className="w-5 h-5" />}
        badge={
          diagnosisList.length > 0
            ? { text: `${diagnosisList.length} Diagnosis(es)`, variant: 'success' }
            : { text: 'None', variant: 'neutral' }
        }
      >
        {diagnosisList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Stethoscope className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No diagnoses added yet</p>
            <p className="text-xs text-gray-400 mt-1">Add diagnoses using the form above</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Diagnosis Groups */}
            {Object.entries(groupedDiagnoses).map(([laterality, diagnoses]) => {
              if (diagnoses.length === 0) return null;

              return (
                <div key={laterality}>
                  <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    {laterality === 'Both Eyes (Bilateral)' && <Eye className="w-4 h-4" />}
                    {laterality === 'OD only (Right Eye)' && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">OD</span>
                    )}
                    {laterality === 'OS only (Left Eye)' && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">OS</span>
                    )}
                    {laterality}
                  </h5>
                  <div className="space-y-3">
                    {diagnoses.map((diagnosis) => (
                      <div
                        key={diagnosis.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          diagnosis.isPrimary
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-white border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {diagnosis.isPrimary && (
                                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                              )}
                              <span className="font-semibold text-gray-900">
                                {diagnosis.icd10Code}
                              </span>
                              <span className="text-gray-600">-</span>
                              <span className="text-gray-900">{diagnosis.description}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-2">
                              {diagnosis.laterality !== laterality && (
                                <StatusBadge text={diagnosis.laterality} variant="info" />
                              )}
                              <StatusBadge
                                text={diagnosis.severity}
                                variant={getSeverityColor(diagnosis.severity) as any}
                              />
                              <StatusBadge
                                text={diagnosis.status}
                                variant={getStatusColor(diagnosis.status) as any}
                              />
                              {diagnosis.isPrimary && (
                                <StatusBadge text="PRIMARY" variant="warning" />
                              )}
                            </div>

                            {diagnosis.clinicalNotes && (
                              <div className="mt-2">
                                <button
                                  onClick={() => toggleNotes(diagnosis.id)}
                                  className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800"
                                >
                                  {expandedNotes.has(diagnosis.id) ? (
                                    <>
                                      <ChevronUp className="w-3 h-3" />
                                      Hide Notes
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      Show Notes
                                    </>
                                  )}
                                </button>
                                {expandedNotes.has(diagnosis.id) && (
                                  <p className="text-sm text-gray-700 mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                                    {diagnosis.clinicalNotes}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {canEdit && (
                            <div className="flex gap-2 ml-4">
                              {qualifiesForSurgery(diagnosis.icd10Code) && (
                                <button
                                  onClick={() => handleRecommendSurgery(diagnosis)}
                                  className="text-purple-600 hover:text-purple-700"
                                  title="Recommend surgery for this diagnosis"
                                >
                                  <Scissors className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleTogglePrimary(diagnosis.id)}
                                className={`${
                                  diagnosis.isPrimary
                                    ? 'text-amber-600 hover:text-amber-700'
                                    : 'text-gray-400 hover:text-amber-600'
                                }`}
                                title={
                                  diagnosis.isPrimary
                                    ? 'Unmark as primary'
                                    : 'Mark as primary diagnosis'
                                }
                              >
                                <Star
                                  className={`w-4 h-4 ${diagnosis.isPrimary ? 'fill-amber-500' : ''}`}
                                />
                              </button>
                              <button
                                onClick={() => handleEditDiagnosis(diagnosis)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Edit diagnosis"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDiagnosis(diagnosis.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Delete diagnosis"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-200">
              <ActionButton
                variant="secondary"
                onClick={onCopyPreviousDiagnoses}
                icon={<Copy className="w-4 h-4" />}
              >
                Copy Previous Diagnoses
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={onPrintSummary}
                icon={<Printer className="w-4 h-4" />}
              >
                Print Diagnosis Summary
              </ActionButton>
            </div>
          </div>
        )}
      </ExamCard>

      {/* Surgery Recommendation Dialog */}
      {selectedDiagnosisForSurgery && patientId && (
        <SurgeryRecommendationDialog
          isOpen={showSurgeryDialog}
          onClose={() => {
            setShowSurgeryDialog(false);
            setSelectedDiagnosisForSurgery(null);
          }}
          patientId={patientId}
          patientName={patientName || 'Patient'}
          diagnosis={{
            id: selectedDiagnosisForSurgery.id,
            code: selectedDiagnosisForSurgery.icd10Code,
            description: selectedDiagnosisForSurgery.description,
            category: '',
            icdVersion: 'ICD-10',
            isOphthalmology: true,
            laterality: selectedDiagnosisForSurgery.laterality.includes('OD only')
              ? 'OD'
              : selectedDiagnosisForSurgery.laterality.includes('OS only')
              ? 'OS'
              : 'OU',
          }}
          onRefer={handleSurgerySubmit}
        />
      )}
    </div>
  );
}

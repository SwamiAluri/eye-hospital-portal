'use client';

import { useState, useEffect } from 'react';
import { ExamCard, ExamInput, ExamSelect, StatusBadge, ActionButton } from './ExamCard';
import { useMasterValues } from '@/hooks/use-master-values';
import { useImagingModalities } from '@/hooks/use-lab-masters';
import { UserPlus, FileImage, MessageSquare, Edit2, Trash2, Printer, Plus } from 'lucide-react';

// Type definitions for Referrals & Orders
interface DoctorReferral {
  id: string;
  referralType: string;
  referTo: string;
  externalClinic?: string;
  reason: string;
  priority: string;
  relevantFindings?: string;
  attachReports: string[];
  status: string;
}

interface ImagingOrder {
  id: string;
  orderType: string;
  eye: string;
  indication: string;
  priority: string;
  specialInstructions?: string;
  status: string;
}

interface ReceptionReferral {
  id: string;
  reasons: string[];
  followupTimeframe?: string;
  followupDate?: string;
  notes?: string;
  priorityFlag: boolean;
  status: string;
}

interface ReferralOrdersTabProps {
  doctorReferrals: DoctorReferral[] | null;
  imagingOrders: ImagingOrder[] | null;
  receptionReferrals: ReceptionReferral[] | null;
  canEdit: boolean;
  onSaveDoctorReferral: (referrals: DoctorReferral[]) => void;
  onSaveImagingOrders: (orders: ImagingOrder[]) => void;
  onSaveReceptionReferral: (referrals: ReceptionReferral[]) => void;
  onPrintReferral: (id: string, type: string) => void;
}

export default function ReferralOrdersTab({
  doctorReferrals,
  imagingOrders,
  receptionReferrals,
  canEdit,
  onSaveDoctorReferral,
  onSaveImagingOrders,
  onSaveReceptionReferral,
  onPrintReferral,
}: ReferralOrdersTabProps) {
  const { options: scanTypeOptions } = useMasterValues('clinical.scan_type');
  const { choices: imagingModalityChoices } = useImagingModalities();
  const { options: eyeNotationOptions } = useMasterValues('clinical.eye_notation');

  // ========== STATE ==========
  const [doctors, setDoctors] = useState<DoctorReferral[]>([]);
  const [imaging, setImaging] = useState<ImagingOrder[]>([]);
  const [reception, setReception] = useState<ReceptionReferral[]>([]);

  // Forms are always visible - removed toggle states

  const [editingDoctor, setEditingDoctor] = useState<DoctorReferral | null>(null);
  const [editingImaging, setEditingImaging] = useState<ImagingOrder | null>(null);
  const [editingReception, setEditingReception] = useState<ReceptionReferral | null>(null);

  // New referral/order forms
  const [newDoctor, setNewDoctor] = useState<Partial<DoctorReferral>>({
    referralType: 'Same hospital - different department',
    priority: 'Routine (within 1 month)',
    attachReports: [],
    status: 'Pending',
  });

  const [newImaging, setNewImaging] = useState<Partial<ImagingOrder>>({
    eye: 'Both',
    priority: 'Routine',
    status: 'Pending',
  });

  const [newReception, setNewReception] = useState<Partial<ReceptionReferral>>({
    reasons: [],
    priorityFlag: false,
    status: 'Pending',
  });

  const [hasChanges, setHasChanges] = useState({
    doctors: false,
    imaging: false,
    reception: false,
  });

  // Load initial data
  useEffect(() => {
    if (doctorReferrals) setDoctors(doctorReferrals);
    if (imagingOrders) setImaging(imagingOrders);
    if (receptionReferrals) setReception(receptionReferrals);
  }, [doctorReferrals, imagingOrders, receptionReferrals]);

  // ========== HELPERS ==========
  const generateId = () => Math.random().toString(36).substring(2, 11);

  const handleCheckboxChange = (
    field: 'attachReports' | 'reasons',
    value: string,
    checked: boolean,
    section: 'doctor' | 'reception'
  ) => {
    if (section === 'doctor' && field === 'attachReports') {
      const updated = checked
        ? [...(newDoctor.attachReports || []), value]
        : (newDoctor.attachReports || []).filter((v) => v !== value);
      setNewDoctor({ ...newDoctor, attachReports: updated });
    } else if (section === 'reception' && field === 'reasons') {
      const updated = checked
        ? [...(newReception.reasons || []), value]
        : (newReception.reasons || []).filter((v) => v !== value);
      setNewReception({ ...newReception, reasons: updated });
    }
  };

  // ========== DOCTOR REFERRAL HANDLERS ==========
  const handleAddDoctorReferral = () => {
    if (!newDoctor.referTo || !newDoctor.reason) {
      alert('Please fill in specialist and reason');
      return;
    }

    const referral: DoctorReferral = {
      id: editingDoctor?.id || generateId(),
      referralType: newDoctor.referralType!,
      referTo: newDoctor.referTo!,
      externalClinic: newDoctor.externalClinic,
      reason: newDoctor.reason!,
      priority: newDoctor.priority!,
      relevantFindings: newDoctor.relevantFindings,
      attachReports: newDoctor.attachReports || [],
      status: newDoctor.status!,
    };

    const updated = editingDoctor
      ? doctors.map((r) => (r.id === editingDoctor.id ? referral : r))
      : [...doctors, referral];

    setDoctors(updated);
    onSaveDoctorReferral(updated);
    resetDoctorForm();
    setHasChanges({ ...hasChanges, doctors: false });
  };

  const resetDoctorForm = () => {
    setNewDoctor({
      referralType: 'Same hospital - different department',
      priority: 'Routine (within 1 month)',
      attachReports: [],
      status: 'Pending',
    });
    setEditingDoctor(null);
  };

  const handleEditDoctorReferral = (referral: DoctorReferral) => {
    setEditingDoctor(referral);
    setNewDoctor(referral);
  };

  const handleDeleteDoctorReferral = (id: string) => {
    if (confirm('Delete this referral?')) {
      const updated = doctors.filter((r) => r.id !== id);
      setDoctors(updated);
      onSaveDoctorReferral(updated);
    }
  };

  // ========== IMAGING ORDER HANDLERS ==========
  const handleAddImagingOrder = () => {
    if (!newImaging.orderType || !newImaging.indication) {
      alert('Please fill in order type and indication');
      return;
    }

    const order: ImagingOrder = {
      id: editingImaging?.id || generateId(),
      orderType: newImaging.orderType!,
      eye: newImaging.eye!,
      indication: newImaging.indication!,
      priority: newImaging.priority!,
      specialInstructions: newImaging.specialInstructions,
      status: newImaging.status!,
    };

    const updated = editingImaging
      ? imaging.map((o) => (o.id === editingImaging.id ? order : o))
      : [...imaging, order];

    setImaging(updated);
    onSaveImagingOrders(updated);
    resetImagingForm();
    setHasChanges({ ...hasChanges, imaging: false });
  };

  const resetImagingForm = () => {
    setNewImaging({
      eye: 'Both',
      priority: 'Routine',
      status: 'Pending',
    });
    setEditingImaging(null);
  };

  const handleEditImagingOrder = (order: ImagingOrder) => {
    setEditingImaging(order);
    setNewImaging(order);
  };

  const handleDeleteImagingOrder = (id: string) => {
    if (confirm('Delete this order?')) {
      const updated = imaging.filter((o) => o.id !== id);
      setImaging(updated);
      onSaveImagingOrders(updated);
    }
  };

  // ========== RECEPTION REFERRAL HANDLERS ==========
  const handleAddReceptionReferral = () => {
    if (newReception.reasons?.length === 0) {
      alert('Please select at least one reason');
      return;
    }

    const referral: ReceptionReferral = {
      id: editingReception?.id || generateId(),
      reasons: newReception.reasons!,
      followupTimeframe: newReception.followupTimeframe,
      followupDate: newReception.followupDate,
      notes: newReception.notes,
      priorityFlag: newReception.priorityFlag!,
      status: newReception.status!,
    };

    const updated = editingReception
      ? reception.map((r) => (r.id === editingReception.id ? referral : r))
      : [...reception, referral];

    setReception(updated);
    onSaveReceptionReferral(updated);
    resetReceptionForm();
    setHasChanges({ ...hasChanges, reception: false });
  };

  const resetReceptionForm = () => {
    setNewReception({
      reasons: [],
      priorityFlag: false,
      status: 'Pending',
    });
    setEditingReception(null);
  };

  const handleEditReceptionReferral = (referral: ReceptionReferral) => {
    setEditingReception(referral);
    setNewReception(referral);
  };

  const handleDeleteReceptionReferral = (id: string) => {
    if (confirm('Delete this reception referral?')) {
      const updated = reception.filter((r) => r.id !== id);
      setReception(updated);
      onSaveReceptionReferral(updated);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'amber';
      case 'completed':
        return 'emerald';
      case 'cancelled':
        return 'gray';
      default:
        return 'blue';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority.includes('Emergency') || priority === 'ASAP') return 'red';
    if (priority.includes('Urgent')) return 'orange';
    return 'blue';
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-4">
      {/* ========== SECTION 1: REFER TO DOCTOR/SPECIALIST ========== */}
      <ExamCard
        title="Refer to Doctor/Specialist"
        icon={<UserPlus className="w-5 h-5" />}
        badge={
          doctors.length > 0
            ? { text: `${doctors.length} Referral(s)`, variant: 'info' }
            : undefined
        }
      >
        <div className="space-y-2">
            <ExamSelect
              label="Referral Type"
              value={newDoctor.referralType || ''}
              onChange={(value) => {
                setNewDoctor({ ...newDoctor, referralType: value, referTo: '', externalClinic: undefined });
              }}
              disabled={!canEdit}
            >
              <option value="Same hospital - different department">Same hospital - different department</option>
              <option value="External specialist">External specialist</option>
              <option value="Emergency referral">Emergency referral</option>
            </ExamSelect>

            {newDoctor.referralType === 'Same hospital - different department' ? (
              <ExamSelect
                label="Refer To"
                value={newDoctor.referTo || ''}
                onChange={(value) => setNewDoctor({ ...newDoctor, referTo: value })}
                disabled={!canEdit}
              >
                <option value="">Select specialist</option>
                <option value="Ophthalmologist - General">Ophthalmologist - General</option>
                <option value="Glaucoma Specialist">Glaucoma Specialist</option>
                <option value="Retina Specialist">Retina Specialist</option>
                <option value="Pediatric Ophthalmologist">Pediatric Ophthalmologist</option>
                <option value="Neuro-Ophthalmologist">Neuro-Ophthalmologist</option>
                <option value="Oculoplastics">Oculoplastics (Eyelid/Orbit)</option>
                <option value="Cornea Specialist">Cornea Specialist</option>
                <option value="Uveitis Specialist">Uveitis Specialist</option>
                <option value="Low Vision Specialist">Low Vision Specialist</option>
              </ExamSelect>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ExamInput
                  label="Specialist Name"
                  type="text"
                  value={newDoctor.referTo || ''}
                  onChange={(e) => setNewDoctor({ ...newDoctor, referTo: e.target.value })}
                  disabled={!canEdit}
                />
                <ExamInput
                  label="Clinic/Hospital"
                  type="text"
                  value={newDoctor.externalClinic || ''}
                  onChange={(e) => setNewDoctor({ ...newDoctor, externalClinic: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <ExamSelect
                label="Reason for Referral *"
                value={newDoctor.reason || ''}
                onChange={(value) => setNewDoctor({ ...newDoctor, reason: value })}
                disabled={!canEdit}
              >
                <option value="">Select reason</option>
                <option value="Glaucoma evaluation">Glaucoma evaluation</option>
                <option value="Retinal examination">Retinal examination</option>
                <option value="Cataract surgery consultation">Cataract surgery consultation</option>
                <option value="Diabetic retinopathy follow-up">Diabetic retinopathy follow-up</option>
                <option value="Macular degeneration">Macular degeneration</option>
                <option value="Corneal disease">Corneal disease</option>
                <option value="Dry eye management">Dry eye management</option>
                <option value="Pediatric vision assessment">Pediatric vision assessment</option>
                <option value="Neuro-ophthalmic evaluation">Neuro-ophthalmic evaluation</option>
                <option value="Oculoplastic consultation">Oculoplastic consultation</option>
                <option value="Low vision assessment">Low vision assessment</option>
                <option value="Emergency - acute vision loss">Emergency - acute vision loss</option>
                <option value="Emergency - eye trauma">Emergency - eye trauma</option>
                <option value="Second opinion">Second opinion</option>
              </ExamSelect>

              <ExamSelect
                label="Priority"
                value={newDoctor.priority || ''}
                onChange={(value) => setNewDoctor({ ...newDoctor, priority: value })}
                disabled={!canEdit}
              >
                <option value="Routine (within 1 month)">Routine (within 1 month)</option>
                <option value="Urgent (within 1 week)">Urgent (within 1 week)</option>
                <option value="Emergency (same/next day)">Emergency (same/next day)</option>
              </ExamSelect>
            </div>

            <ExamSelect
              label="Relevant Findings"
              value={newDoctor.relevantFindings || ''}
              onChange={(value) => setNewDoctor({ ...newDoctor, relevantFindings: value })}
              disabled={!canEdit}
            >
              <option value="">Select findings (optional)</option>
              <option value="Elevated IOP">Elevated IOP</option>
              <option value="Optic nerve cupping">Optic nerve cupping</option>
              <option value="Macular changes">Macular changes</option>
              <option value="Retinal hemorrhages">Retinal hemorrhages</option>
              <option value="Cotton wool spots">Cotton wool spots</option>
              <option value="Cataract progression">Cataract progression</option>
              <option value="Corneal abnormalities">Corneal abnormalities</option>
              <option value="Visual field defects">Visual field defects</option>
              <option value="Decreased visual acuity">Decreased visual acuity</option>
              <option value="Diplopia">Diplopia</option>
              <option value="Ptosis">Ptosis</option>
            </ExamSelect>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Attach Reports
              </label>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                  'Include Visual Field report',
                  'Include OCT images',
                  'Include Fundus photos',
                  'Include full examination summary',
                ].map((report) => (
                  <label key={report} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDoctor.attachReports?.includes(report)}
                      onChange={(e) =>
                        handleCheckboxChange('attachReports', report, e.target.checked, 'doctor')
                      }
                      disabled={!canEdit}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs text-gray-700">{report}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              {!editingDoctor && (
                <ActionButton variant="secondary" onClick={resetDoctorForm}>
                  Clear
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={handleAddDoctorReferral} disabled={!canEdit}>
                {editingDoctor ? 'Update' : 'Add Referral'}
              </ActionButton>
            </div>
          </div>

        {/* List of Doctor Referrals */}
        {doctors.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            {doctors.map((ref) => (
              <div
                key={ref.id}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{ref.referTo}</h4>
                      <StatusBadge text={ref.referralType} variant="info" />
                      <StatusBadge text={ref.priority} variant={getPriorityColor(ref.priority) as any} />
                      <StatusBadge text={ref.status} variant={getStatusColor(ref.status) as any} />
                    </div>
                    {ref.externalClinic && (
                      <p className="text-xs text-gray-500 mb-1">Clinic: {ref.externalClinic}</p>
                    )}
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Reason:</span> {ref.reason}
                    </p>
                    {ref.relevantFindings && (
                      <p className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Findings:</span> {ref.relevantFindings}
                      </p>
                    )}
                    {ref.attachReports.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ref.attachReports.map((report) => (
                          <span
                            key={report}
                            className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                          >
                            {report.replace('Include ', '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => onPrintReferral(ref.id, 'doctor')}
                        className="text-emerald-600 hover:text-emerald-700"
                        title="Print referral letter"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditDoctorReferral(ref)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit referral"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoctorReferral(ref.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete referral"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ExamCard>

      {/* ========== SECTION 2: IMAGING & DIAGNOSTIC ORDERS ========== */}
      <ExamCard
        title="Imaging & Diagnostic Orders"
        icon={<FileImage className="w-5 h-5" />}
        badge={
          imaging.length > 0 ? { text: `${imaging.length} Order(s)`, variant: 'info' } : undefined
        }
      >
        <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <ExamSelect
                label="Order Type *"
                value={newImaging.orderType || ''}
                onChange={(value) => setNewImaging({ ...newImaging, orderType: value })}
                disabled={!canEdit}
              >
                <option value="">
                  {imagingModalityChoices.length === 0 && scanTypeOptions.length === 0
                    ? 'No imaging types configured'
                    : 'Select imaging type'}
                </option>
                {imagingModalityChoices.map((o) => (
                  <option key={o.value} value={o.label}>{o.label}</option>
                ))}
                {imagingModalityChoices.length === 0 &&
                  scanTypeOptions.map((o) => (
                    <option key={o.value} value={o.label}>{o.label}</option>
                  ))}
              </ExamSelect>
              <ExamSelect
                label="Eye(s)"
                value={newImaging.eye || ''}
                onChange={(value) => setNewImaging({ ...newImaging, eye: value })}
                disabled={!canEdit}
              >
                <option value="">{eyeNotationOptions.length === 0 ? 'No eye options' : 'Select eye'}</option>
                {eyeNotationOptions.map((o) => (
                  <option key={o.value} value={o.label}>{o.label}</option>
                ))}
              </ExamSelect>

              <ExamSelect
                label="Priority"
                value={newImaging.priority || ''}
                onChange={(value) => setNewImaging({ ...newImaging, priority: value })}
                disabled={!canEdit}
              >
                <option value="Routine">Routine</option>
                <option value="Urgent">Urgent</option>
                <option value="ASAP">ASAP</option>
              </ExamSelect>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <ExamSelect
                label="Indication *"
                value={newImaging.indication || ''}
                onChange={(value) => setNewImaging({ ...newImaging, indication: value })}
                disabled={!canEdit}
              >
                <option value="">Select indication</option>
                <option value="Glaucoma monitoring">Glaucoma monitoring</option>
                <option value="Diabetic retinopathy screening">Diabetic retinopathy screening</option>
                <option value="Macular degeneration assessment">Macular degeneration assessment</option>
                <option value="Retinal tear/detachment">Retinal tear/detachment</option>
                <option value="Central serous retinopathy">Central serous retinopathy</option>
                <option value="Macular edema">Macular edema</option>
                <option value="Optic nerve evaluation">Optic nerve evaluation</option>
                <option value="Pre-operative assessment">Pre-operative assessment</option>
                <option value="Post-operative follow-up">Post-operative follow-up</option>
                <option value="Corneal disease evaluation">Corneal disease evaluation</option>
                <option value="Visual field defect">Visual field defect</option>
                <option value="Uveitis monitoring">Uveitis monitoring</option>
                <option value="Posterior vitreous detachment">Posterior vitreous detachment</option>
              </ExamSelect>

              <ExamSelect
                label="Special Instructions"
                value={newImaging.specialInstructions || ''}
                onChange={(value) => setNewImaging({ ...newImaging, specialInstructions: value })}
                disabled={!canEdit}
              >
                <option value="">None</option>
                <option value="Dilate pupils before imaging">Dilate pupils before imaging</option>
                <option value="Fasting required">Fasting required</option>
                <option value="Patient on anticoagulants">Patient on anticoagulants</option>
                <option value="Compare with previous images">Compare with previous images</option>
                <option value="Focus on macula">Focus on macula</option>
                <option value="Focus on optic disc">Focus on optic disc</option>
                <option value="Wide-field imaging needed">Wide-field imaging needed</option>
                <option value="Patient has difficulty fixating">Patient has difficulty fixating</option>
              </ExamSelect>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              {!editingImaging && (
                <ActionButton variant="secondary" onClick={resetImagingForm}>
                  Clear
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={handleAddImagingOrder} disabled={!canEdit}>
                {editingImaging ? 'Update' : 'Add Order'}
              </ActionButton>
            </div>
          </div>

        {/* List of Imaging Orders */}
        {imaging.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            {imaging.map((order) => (
              <div
                key={order.id}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{order.orderType}</h4>
                      <StatusBadge text={order.eye} variant="info" />
                      <StatusBadge text={order.priority} variant={getPriorityColor(order.priority) as any} />
                      <StatusBadge text={order.status} variant={getStatusColor(order.status) as any} />
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Indication:</span> {order.indication}
                    </p>
                    {order.specialInstructions && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Instructions:</span> {order.specialInstructions}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditImagingOrder(order)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit order"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteImagingOrder(order.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ExamCard>

      {/* ========== SECTION 3: REFER TO RECEPTION ========== */}
      <ExamCard
        title="Refer to Reception"
        icon={<MessageSquare className="w-5 h-5" />}
        badge={
          reception.length > 0
            ? { text: `${reception.length} Reception Task(s)`, variant: 'info' }
            : undefined
        }
      >
        <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                  'Schedule follow-up appointment',
                  'Book imaging appointment',
                  'Payment/billing clarification',
                  'Collect reports',
                  'Schedule surgery consultation',
                  'Insurance authorization needed',
                  'Other (specify in notes)',
                ].map((reason) => (
                  <label key={reason} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newReception.reasons?.includes(reason)}
                      onChange={(e) =>
                        handleCheckboxChange('reasons', reason, e.target.checked, 'reception')
                      }
                      disabled={!canEdit}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs text-gray-700">{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {newReception.reasons?.includes('Schedule follow-up appointment') && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <label className="block text-xs font-medium text-blue-900 mb-1.5">
                  Follow-up Details
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ExamSelect
                    label="Timeframe"
                    value={newReception.followupTimeframe || ''}
                    onChange={(value) =>
                      setNewReception({ ...newReception, followupTimeframe: value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Select timeframe</option>
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="3 months">3 months</option>
                    <option value="6 months">6 months</option>
                    <option value="12 months">12 months</option>
                    <option value="Custom">Custom (specify date)</option>
                  </ExamSelect>

                  {newReception.followupTimeframe === 'Custom' && (
                    <ExamInput
                      label="Specific Date"
                      type="date"
                      value={newReception.followupDate || ''}
                      onChange={(e) =>
                        setNewReception({ ...newReception, followupDate: e.target.value })
                      }
                      disabled={!canEdit}
                    />
                  )}
                </div>
              </div>
            )}

            <ExamInput
              label="Notes"
              value={newReception.notes || ''}
              onChange={(e) => setNewReception({ ...newReception, notes: e.target.value })}
              disabled={!canEdit}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newReception.priorityFlag}
                onChange={(e) =>
                  setNewReception({ ...newReception, priorityFlag: e.target.checked })
                }
                disabled={!canEdit}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-700">Priority Flag</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              {!editingReception && (
                <ActionButton variant="secondary" onClick={resetReceptionForm}>
                  Clear
                </ActionButton>
              )}
              <ActionButton variant="primary" onClick={handleAddReceptionReferral} disabled={!canEdit}>
                {editingReception ? 'Update' : 'Send to Queue'}
              </ActionButton>
            </div>
          </div>

        {/* List of Reception Referrals */}
        {reception.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            {reception.map((ref) => (
              <div
                key={ref.id}
                className={`p-4 border rounded-lg hover:border-emerald-300 transition-colors ${
                  ref.priorityFlag ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">Reception Task</h4>
                      {ref.priorityFlag && (
                        <StatusBadge text="PRIORITY" variant="error" />
                      )}
                      <StatusBadge text={ref.status} variant={getStatusColor(ref.status) as any} />
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ref.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                    {ref.followupTimeframe && (
                      <p className="text-xs text-gray-600 mb-1">
                        <span className="font-medium">Follow-up:</span> {ref.followupTimeframe}
                        {ref.followupDate && ` (${new Date(ref.followupDate).toLocaleDateString()})`}
                      </p>
                    )}
                    {ref.notes && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Notes:</span> {ref.notes}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditReceptionReferral(ref)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit task"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteReceptionReferral(ref.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ExamCard>

      {/* ========== SECTION 4: REFERRAL SUMMARY ========== */}
      {(doctors.length > 0 || imaging.length > 0 || reception.length > 0) && (
        <ExamCard
          title="Referral Summary (This Visit)"
          icon={<FileImage className="w-5 h-5" />}
          badge={{
            text: `${doctors.length + imaging.length + reception.length} Total`,
            variant: 'success',
          }}
        >
          <div className="space-y-4">
            {doctors.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Doctor Referrals ({doctors.length})
                </h5>
                <div className="space-y-2">
                  {doctors.map((ref) => (
                    <div
                      key={ref.id}
                      className="p-3 bg-blue-50 border border-blue-200 rounded text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{ref.referTo}</span>
                          <span className="text-gray-600 mx-2">•</span>
                          <span className="text-gray-700">{ref.reason.substring(0, 60)}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge text={ref.priority} variant={getPriorityColor(ref.priority) as any} />
                          <StatusBadge text={ref.status} variant={getStatusColor(ref.status) as any} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imaging.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  Imaging Orders ({imaging.length})
                </h5>
                <div className="space-y-2">
                  {imaging.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 bg-purple-50 border border-purple-200 rounded text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{order.orderType}</span>
                          <span className="text-gray-600 mx-2">•</span>
                          <span className="text-gray-700">{order.eye}</span>
                          <span className="text-gray-600 mx-2">•</span>
                          <span className="text-gray-700">{order.indication.substring(0, 40)}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge text={order.priority} variant={getPriorityColor(order.priority) as any} />
                          <StatusBadge text={order.status} variant={getStatusColor(order.status) as any} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reception.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Reception Tasks ({reception.length})
                </h5>
                <div className="space-y-2">
                  {reception.map((ref) => (
                    <div
                      key={ref.id}
                      className={`p-3 border rounded text-sm ${
                        ref.priorityFlag
                          ? 'bg-red-50 border-red-300'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{ref.reasons.join(', ')}</span>
                          {ref.followupTimeframe && (
                            <>
                              <span className="text-gray-600 mx-2">•</span>
                              <span className="text-gray-700">{ref.followupTimeframe}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {ref.priorityFlag && <StatusBadge text="PRIORITY" variant="error" />}
                          <StatusBadge text={ref.status} variant={getStatusColor(ref.status) as any} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ExamCard>
      )}
    </div>
  );
}

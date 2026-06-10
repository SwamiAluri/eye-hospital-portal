'use client';

import { useState, useEffect } from 'react';
import { departmentsEnhancedApi, Department } from '@/lib/api/departments-enhanced.api';
import { useDepartmentMaster } from '@/hooks/use-system-masters';
import { 
  X, 
  Building, 
  Users, 
  Settings, 
  Calendar, 
  DollarSign, 
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';

interface EnhancedDepartmentFormModalProps {
  department: Department | null;
  onClose: () => void;
  onSave: () => void;
}

interface DepartmentFormData {
  id?: string;
  departmentName: string;
  departmentCode: string;
  departmentType: string;
  description: string;
  status: string;
  parentDepartmentId?: string;
  location: {
    building: string;
    floor: string;
    zone: string;
    roomNumbers: string[];
  };
  capacity: {
    maxPatients: number;
    maxStaff: number;
    totalEquipment: number;
    operatingRooms?: number;
    beds?: number;
  };
  operationalHours: {
    monday: { isOpen: boolean; startTime: string; endTime: string };
    tuesday: { isOpen: boolean; startTime: string; endTime: string };
    wednesday: { isOpen: boolean; startTime: string; endTime: string };
    thursday: { isOpen: boolean; startTime: string; endTime: string };
    friday: { isOpen: boolean; startTime: string; endTime: string };
    saturday: { isOpen: boolean; startTime: string; endTime: string };
    sunday: { isOpen: boolean; startTime: string; endTime: string };
    emergencyAvailable24x7: boolean;
  };
  specializations: string[];
  requiredCertifications: string[];
  budgetInfo: {
    annualBudget?: number;
    currentSpending?: number;
    costCenterCode?: string;
  };
  contactInfo: {
    primaryContact: {
      name: string;
      title: string;
      email: string;
      phone: string;
    };
    emergencyContact: {
      name: string;
      title: string;
      email: string;
      phone: string;
    };
  };
  complianceInfo: {
    accreditations: string[];
    lastInspectionDate?: string;
    nextInspectionDate?: string;
    complianceScore?: number;
  };
}

export default function EnhancedDepartmentFormModal({ department, onClose, onSave }: EnhancedDepartmentFormModalProps) {
  const { departments: departmentTypes } = useDepartmentMaster();
  const [formData, setFormData] = useState<DepartmentFormData>({
    departmentName: '',
    departmentCode: '',
    departmentType: 'Clinical',
    description: '',
    status: 'Active',
    location: {
      building: '',
      floor: '',
      zone: '',
      roomNumbers: [],
    },
    capacity: {
      maxPatients: 0,
      maxStaff: 0,
      totalEquipment: 0,
    },
    operationalHours: {
      monday: { isOpen: true, startTime: '08:00', endTime: '18:00' },
      tuesday: { isOpen: true, startTime: '08:00', endTime: '18:00' },
      wednesday: { isOpen: true, startTime: '08:00', endTime: '18:00' },
      thursday: { isOpen: true, startTime: '08:00', endTime: '18:00' },
      friday: { isOpen: true, startTime: '08:00', endTime: '18:00' },
      saturday: { isOpen: false, startTime: '08:00', endTime: '18:00' },
      sunday: { isOpen: false, startTime: '08:00', endTime: '18:00' },
      emergencyAvailable24x7: false,
    },
    specializations: [],
    requiredCertifications: [],
    budgetInfo: {},
    contactInfo: {
      primaryContact: { name: '', title: '', email: '', phone: '' },
      emergencyContact: { name: '', title: '', email: '', phone: '' },
    },
    complianceInfo: {
      accreditations: [],
    },
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'location' | 'operations' | 'contacts' | 'compliance'>('basic');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableParentDepartments, setAvailableParentDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (department) {
      setFormData({
        id: department.id,
        departmentName: department.departmentName,
        departmentCode: department.departmentCode,
        departmentType: department.departmentType,
        description: department.description,
        status: department.status,
        parentDepartmentId: department.parentDepartmentId,
        location: department.location || {
          building: '',
          floor: '',
          zone: '',
          roomNumbers: [],
        },
        capacity: {
          maxPatients: department.capacity.maxPatients,
          maxStaff: department.capacity.maxStaff,
          totalEquipment: department.capacity.totalEquipment,
          operatingRooms: department.capacity.operatingRooms,
          beds: department.capacity.beds,
        },
        operationalHours: department.operationalHours || formData.operationalHours,
        specializations: department.specializations || [],
        requiredCertifications: department.requiredCertifications || [],
        budgetInfo: department.budgetInfo || {},
        contactInfo: department.contactInfo || formData.contactInfo,
        complianceInfo: department.complianceInfo || { accreditations: [] },
      });
    }
    loadParentDepartments();
  }, [department]);

  const loadParentDepartments = async () => {
    try {
      const response = await departmentsEnhancedApi.getAll({ 
        status: 'Active',
        exclude: department?.id 
      });
      setAvailableParentDepartments(response.items || []);
    } catch (err) {
      console.error('Error loading parent departments:', err);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.departmentName.trim()) {
      newErrors.departmentName = 'Department name is required';
    }

    if (!formData.departmentCode.trim()) {
      newErrors.departmentCode = 'Department code is required';
    }

    if (formData.capacity.maxPatients < 0) {
      newErrors.maxPatients = 'Max patients cannot be negative';
    }

    if (formData.capacity.maxStaff <= 0) {
      newErrors.maxStaff = 'Max staff must be greater than 0';
    }

    if (!formData.contactInfo.primaryContact.name.trim()) {
      newErrors.primaryContactName = 'Primary contact name is required';
    }

    if (!formData.contactInfo.primaryContact.email.trim()) {
      newErrors.primaryContactEmail = 'Primary contact email is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      if (department) {
        await departmentsEnhancedApi.update(department.id, formData);
      } else {
        await departmentsEnhancedApi.create(formData);
      }
      
      onSave();
    } catch (err: any) {
      console.error('Error saving department:', err);
      setErrors({ submit: err.response?.data?.message || 'Failed to save department' });
    } finally {
      setSaving(false);
    }
  };

  const addSpecialization = () => {
    setFormData({
      ...formData,
      specializations: [...formData.specializations, '']
    });
  };

  const updateSpecialization = (index: number, value: string) => {
    const updated = [...formData.specializations];
    updated[index] = value;
    setFormData({ ...formData, specializations: updated });
  };

  const removeSpecialization = (index: number) => {
    setFormData({
      ...formData,
      specializations: formData.specializations.filter((_, i) => i !== index)
    });
  };

  const addCertification = () => {
    setFormData({
      ...formData,
      requiredCertifications: [...formData.requiredCertifications, '']
    });
  };

  const updateCertification = (index: number, value: string) => {
    const updated = [...formData.requiredCertifications];
    updated[index] = value;
    setFormData({ ...formData, requiredCertifications: updated });
  };

  const removeCertification = (index: number) => {
    setFormData({
      ...formData,
      requiredCertifications: formData.requiredCertifications.filter((_, i) => i !== index)
    });
  };

  const addRoomNumber = () => {
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        roomNumbers: [...formData.location.roomNumbers, '']
      }
    });
  };

  const updateRoomNumber = (index: number, value: string) => {
    const updated = [...formData.location.roomNumbers];
    updated[index] = value;
    setFormData({
      ...formData,
      location: { ...formData.location, roomNumbers: updated }
    });
  };

  const removeRoomNumber = (index: number) => {
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        roomNumbers: formData.location.roomNumbers.filter((_, i) => i !== index)
      }
    });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building },
    { id: 'location', label: 'Location', icon: Settings },
    { id: 'operations', label: 'Operations', icon: Calendar },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'compliance', label: 'Compliance', icon: AlertTriangle },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-5xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            {department ? 'Edit Department' : 'Create Department'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'text-indigo-600 border-indigo-600' 
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department Name *
                    </label>
                    <input
                      type="text"
                      value={formData.departmentName}
                      onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.departmentName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Cardiology, Emergency, ICU"
                    />
                    {errors.departmentName && <p className="mt-1 text-sm text-red-600">{errors.departmentName}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department Code *
                    </label>
                    <input
                      type="text"
                      value={formData.departmentCode}
                      onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.departmentCode ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="e.g., CARD, EMRG, ICU"
                    />
                    {errors.departmentCode && <p className="mt-1 text-sm text-red-600">{errors.departmentCode}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department Type
                    </label>
                    <select
                      value={formData.departmentType}
                      onChange={(e) => setFormData({ ...formData, departmentType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select department type…</option>
                      {departmentTypes.map((d) => (
                        <option key={d.value} value={d.label}>{d.label}</option>
                      ))}
                      {formData.departmentType &&
                        !departmentTypes.some((d) => d.label === formData.departmentType) && (
                          <option value={formData.departmentType}>{formData.departmentType}</option>
                        )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="UnderMaintenance">Under Maintenance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Department
                  </label>
                  <select
                    value={formData.parentDepartmentId || ''}
                    onChange={(e) => setFormData({ ...formData, parentDepartmentId: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No Parent (Top Level)</option>
                    {availableParentDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.departmentName} ({dept.departmentCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the department's purpose and services..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specializations
                  </label>
                  <div className="space-y-2">
                    {formData.specializations.map((spec, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={spec}
                          onChange={(e) => updateSpecialization(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g., Interventional Cardiology"
                        />
                        <button
                          type="button"
                          onClick={() => removeSpecialization(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addSpecialization}
                      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Specialization
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Certifications
                  </label>
                  <div className="space-y-2">
                    {formData.requiredCertifications.map((cert, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cert}
                          onChange={(e) => updateCertification(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g., BLS, ACLS, Specialty Board Certification"
                        />
                        <button
                          type="button"
                          onClick={() => removeCertification(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCertification}
                      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Certification
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Location Tab */}
            {activeTab === 'location' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Building
                    </label>
                    <input
                      type="text"
                      value={formData.location.building}
                      onChange={(e) => setFormData({
                        ...formData,
                        location: { ...formData.location, building: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Main Hospital, North Wing"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Floor
                    </label>
                    <input
                      type="text"
                      value={formData.location.floor}
                      onChange={(e) => setFormData({
                        ...formData,
                        location: { ...formData.location, floor: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 3rd Floor, Ground Level"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zone
                    </label>
                    <input
                      type="text"
                      value={formData.location.zone}
                      onChange={(e) => setFormData({
                        ...formData,
                        location: { ...formData.location, zone: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., East Wing, Central"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Numbers
                  </label>
                  <div className="space-y-2">
                    {formData.location.roomNumbers.map((room, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={room}
                          onChange={(e) => updateRoomNumber(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g., 301A, 302B, 303"
                        />
                        <button
                          type="button"
                          onClick={() => removeRoomNumber(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addRoomNumber}
                      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Room Number
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Patients *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity.maxPatients}
                      onChange={(e) => setFormData({
                        ...formData,
                        capacity: { ...formData.capacity, maxPatients: parseInt(e.target.value) || 0 }
                      })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.maxPatients ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.maxPatients && <p className="mt-1 text-sm text-red-600">{errors.maxPatients}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Staff *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity.maxStaff}
                      onChange={(e) => setFormData({
                        ...formData,
                        capacity: { ...formData.capacity, maxStaff: parseInt(e.target.value) || 0 }
                      })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.maxStaff ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.maxStaff && <p className="mt-1 text-sm text-red-600">{errors.maxStaff}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Equipment
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity.totalEquipment}
                      onChange={(e) => setFormData({
                        ...formData,
                        capacity: { ...formData.capacity, totalEquipment: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating Rooms
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity.operatingRooms || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        capacity: { ...formData.capacity, operatingRooms: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beds
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity.beds || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        capacity: { ...formData.capacity, beds: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Operations Tab */}
            {activeTab === 'operations' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4 mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.operationalHours.emergencyAvailable24x7}
                      onChange={(e) => setFormData({
                        ...formData,
                        operationalHours: {
                          ...formData.operationalHours,
                          emergencyAvailable24x7: e.target.checked
                        }
                      })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">24/7 Emergency Services Available</span>
                  </label>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Operating Hours</h4>
                  <div className="space-y-4">
                    {Object.entries(formData.operationalHours).map(([day, hours]) => {
                      if (day === 'emergencyAvailable24x7') return null;
                      
                      return (
                        <div key={day} className="flex items-center space-x-4">
                          <div className="w-20">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={hours.isOpen}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  operationalHours: {
                                    ...formData.operationalHours,
                                    [day]: { ...hours, isOpen: e.target.checked }
                                  }
                                })}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm font-medium text-gray-700 capitalize">{day}</span>
                            </label>
                          </div>
                          
                          {hours.isOpen && (
                            <>
                              <div>
                                <input
                                  type="time"
                                  value={hours.startTime}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    operationalHours: {
                                      ...formData.operationalHours,
                                      [day]: { ...hours, startTime: e.target.value }
                                    }
                                  })}
                                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <span className="text-sm text-gray-500">to</span>
                              <div>
                                <input
                                  type="time"
                                  value={hours.endTime}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    operationalHours: {
                                      ...formData.operationalHours,
                                      [day]: { ...hours, endTime: e.target.value }
                                    }
                                  })}
                                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Budget
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.budgetInfo.annualBudget || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        budgetInfo: {
                          ...formData.budgetInfo,
                          annualBudget: parseFloat(e.target.value) || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Spending
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.budgetInfo.currentSpending || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        budgetInfo: {
                          ...formData.budgetInfo,
                          currentSpending: parseFloat(e.target.value) || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Center Code
                    </label>
                    <input
                      type="text"
                      value={formData.budgetInfo.costCenterCode || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        budgetInfo: {
                          ...formData.budgetInfo,
                          costCenterCode: e.target.value || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., CC-CARD-001"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <div className="space-y-8">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Primary Contact *</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.contactInfo.primaryContact.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            primaryContact: {
                              ...formData.contactInfo.primaryContact,
                              name: e.target.value
                            }
                          }
                        })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          errors.primaryContactName ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Full name"
                      />
                      {errors.primaryContactName && <p className="mt-1 text-sm text-red-600">{errors.primaryContactName}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={formData.contactInfo.primaryContact.title}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            primaryContact: {
                              ...formData.contactInfo.primaryContact,
                              title: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Department Head, Manager"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.contactInfo.primaryContact.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            primaryContact: {
                              ...formData.contactInfo.primaryContact,
                              email: e.target.value
                            }
                          }
                        })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          errors.primaryContactEmail ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="email@hospital.com"
                      />
                      {errors.primaryContactEmail && <p className="mt-1 text-sm text-red-600">{errors.primaryContactEmail}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactInfo.primaryContact.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            primaryContact: {
                              ...formData.contactInfo.primaryContact,
                              phone: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.contactInfo.emergencyContact.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            emergencyContact: {
                              ...formData.contactInfo.emergencyContact,
                              name: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={formData.contactInfo.emergencyContact.title}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            emergencyContact: {
                              ...formData.contactInfo.emergencyContact,
                              title: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., On-call Supervisor"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.contactInfo.emergencyContact.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            emergencyContact: {
                              ...formData.contactInfo.emergencyContact,
                              email: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="emergency@hospital.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactInfo.emergencyContact.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          contactInfo: {
                            ...formData.contactInfo,
                            emergencyContact: {
                              ...formData.contactInfo.emergencyContact,
                              phone: e.target.value
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="(555) 911-0000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Inspection Date
                    </label>
                    <input
                      type="date"
                      value={formData.complianceInfo.lastInspectionDate || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        complianceInfo: {
                          ...formData.complianceInfo,
                          lastInspectionDate: e.target.value || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Inspection Date
                    </label>
                    <input
                      type="date"
                      value={formData.complianceInfo.nextInspectionDate || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        complianceInfo: {
                          ...formData.complianceInfo,
                          nextInspectionDate: e.target.value || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compliance Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.complianceInfo.complianceScore || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        complianceInfo: {
                          ...formData.complianceInfo,
                          complianceScore: parseFloat(e.target.value) || undefined
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Accreditations
                  </label>
                  <div className="space-y-2">
                    {formData.complianceInfo.accreditations.map((accred, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={accred}
                          onChange={(e) => {
                            const updated = [...formData.complianceInfo.accreditations];
                            updated[index] = e.target.value;
                            setFormData({
                              ...formData,
                              complianceInfo: {
                                ...formData.complianceInfo,
                                accreditations: updated
                              }
                            });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g., Joint Commission, CLIA, CAP"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.complianceInfo.accreditations.filter((_, i) => i !== index);
                            setFormData({
                              ...formData,
                              complianceInfo: {
                                ...formData.complianceInfo,
                                accreditations: updated
                              }
                            });
                          }}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        complianceInfo: {
                          ...formData.complianceInfo,
                          accreditations: [...formData.complianceInfo.accreditations, '']
                        }
                      })}
                      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Accreditation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700">{errors.submit}</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Department'}
          </button>
        </div>
      </div>
    </div>
  );
}
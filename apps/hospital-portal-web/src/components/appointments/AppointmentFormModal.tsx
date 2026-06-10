'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Users, FileText } from 'lucide-react';
import { Appointment, CreateAppointmentDto, appointmentsApi } from '@/lib/api/appointments.api';
import { getApi } from '@/lib/api';
import { useMasterValues } from '@/hooks/use-master-values';
import { defaultMasterCode } from '@/lib/master-data/appointment-master';

interface AppointmentFormModalProps {
  appointment?: Appointment;
  initialDate?: Date;
  onClose: () => void;
  onSave: () => void;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization?: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AppointmentFormModal({
  appointment,
  initialDate,
  onClose,
  onSave
}: AppointmentFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [patientId, setPatientId] = useState(appointment?.patientId || '');
  const [doctorId, setDoctorId] = useState(appointment?.doctorId || '');
  const [departmentId, setDepartmentId] = useState(appointment?.departmentId || '');
  const [appointmentDate, setAppointmentDate] = useState(
    appointment?.appointmentDate || initialDate?.toISOString().split('T')[0] || ''
  );
  const [startTime, setStartTime] = useState(appointment?.startTime || '09:00');
  const [duration, setDuration] = useState(appointment?.duration || 30);
  const { options: appointmentTypeOptions } = useMasterValues('appointment.type');
  const { options: consultationTypeOptions } = useMasterValues('appointment.consultation_type');
  const { options: priorityOptions } = useMasterValues('appointment.priority');
  const [appointmentType, setAppointmentType] = useState(appointment?.appointmentType || '');
  const [consultationType, setConsultationType] = useState(appointment?.consultationType || '');
  const [priority, setPriority] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState(appointment?.reasonForVisit || '');
  const [notes, setNotes] = useState(appointment?.notes || '');
  
  // Lookup data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!appointment) {
      if (!appointmentType && appointmentTypeOptions.length > 0) {
        setAppointmentType(defaultMasterCode(appointmentTypeOptions, 'OPD'));
      }
      if (!priority && priorityOptions.length > 0) {
        setPriority(defaultMasterCode(priorityOptions, 'ROUTINE'));
      }
      if (!consultationType && consultationTypeOptions.length > 0) {
        setConsultationType(defaultMasterCode(consultationTypeOptions, 'FIRST_VISIT'));
      }
    } else {
      if (appointment.appointmentType) setAppointmentType(appointment.appointmentType);
      if (appointment.consultationType) setConsultationType(appointment.consultationType);
    }
  }, [appointment, appointmentTypeOptions, consultationTypeOptions, priorityOptions, appointmentType, consultationType, priority]);

  const loadData = async () => {
    try {
      // Load patients, doctors, departments
      const [patientsRes, doctorsRes, departmentsRes] = await Promise.all([
        getApi().get<Patient[]>('/patients'),
        getApi().get<{ id: string; firstName: string; lastName: string }[]>('/users'),
        getApi().get<Department[]>('/departments')
      ]);
      
      setPatients(patientsRes.data || []);
      setDoctors(doctorsRes.data || []);
      setDepartments(departmentsRes.data || []);

      // Pre-fill patient search if editing
      if (appointment) {
        setPatientSearch(`${appointment.patientName} (${appointment.patientId})`);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientId || !doctorId || !appointmentDate || !startTime) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data: CreateAppointmentDto = {
        patientId,
        doctorId,
        departmentId: departmentId || undefined,
        appointmentDate,
        startTime,
        duration,
        appointmentType,
        consultationType: consultationType || undefined,
        priority: priority || undefined,
        reasonForVisit: reasonForVisit || undefined,
        notes: notes || undefined
      };

      if (appointment) {
        await appointmentsApi.update(appointment.id, data);
      } else {
        await appointmentsApi.create(data);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save appointment');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName} ${p.medicalRecordNumber}`
      .toLowerCase()
      .includes(patientSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {appointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search patient by name or MRN..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {showPatientDropdown && patientSearch && filteredPatients.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto bg-white shadow-lg absolute z-10 w-full max-w-xl">
                {filteredPatients.slice(0, 10).map(patient => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setPatientId(patient.id);
                      setPatientSearch(`${patient.firstName} ${patient.lastName} (${patient.medicalRecordNumber})`);
                      setShowPatientDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                    <div className="text-sm text-gray-500">MRN: {patient.medicalRecordNumber}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Doctor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Doctor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-3 text-gray-400" size={20} />
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select Doctor</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.firstName} {doctor.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Department (Optional)</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Duration & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Type
              </label>
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{appointmentTypeOptions.length === 0 ? 'No types configured' : 'Select type'}</option>
                {appointmentTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consultation Type
              </label>
              <select
                value={consultationType}
                onChange={(e) => setConsultationType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{consultationTypeOptions.length === 0 ? 'No types configured' : 'Select consultation type'}</option>
                {consultationTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{priorityOptions.length === 0 ? 'No priorities configured' : 'Select priority'}</option>
                {priorityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason for Visit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Visit
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-400" size={20} />
              <textarea
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                rows={2}
                placeholder="Brief description of the reason for visit..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes or special instructions..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : (appointment ? 'Update' : 'Create')} Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, User, Phone, Activity } from 'lucide-react';

interface WalkInBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefill?: {
    patientName?: string;
    phoneNumber?: string;
  };
}

export default function WalkInBookingModal({ isOpen, onClose, prefill }: WalkInBookingModalProps) {
  const [formData, setFormData] = useState({
    patientName: '',
    phoneNumber: '',
    email: '',
    department: '',
    doctor: '',
    appointmentType: 'consultation',
    notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (!prefill) return;
    setFormData((prev) => ({
      ...prev,
      patientName: prefill.patientName ?? prev.patientName,
      phoneNumber: prefill.phoneNumber ?? prev.phoneNumber,
    }));
  }, [isOpen, prefill?.patientName, prefill?.phoneNumber]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create walk-in appointment
    console.log('Creating walk-in booking:', formData);
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Walk-In Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-100 rounded-lg transition"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-4">
            {/* Patient Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Patient Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.patientName}
                  onChange={(e) => handleInputChange('patientName', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter patient name"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Department *
              </label>
              <div className="relative">
                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <select
                  required
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select department</option>
                  <option value="ophthalmology">Ophthalmology</option>
                  <option value="general">General Medicine</option>
                  <option value="pediatrics">Pediatrics</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>

            {/* Doctor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Preferred Doctor
              </label>
              <select
                value={formData.doctor}
                onChange={(e) => handleInputChange('doctor', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Any available doctor</option>
                <option value="dr-smith">Dr. Smith</option>
                <option value="dr-johnson">Dr. Johnson</option>
                <option value="dr-williams">Dr. Williams</option>
              </select>
            </div>

            {/* Appointment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Appointment Type *
              </label>
              <select
                required
                value={formData.appointmentType}
                onChange={(e) => handleInputChange('appointmentType', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="consultation">Consultation</option>
                <option value="followup">Follow-up</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any special requirements or notes..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Book Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

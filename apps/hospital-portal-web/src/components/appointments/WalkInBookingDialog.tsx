'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SlotAvailabilityPanel } from './SlotAvailabilityPanel';
import { ConflictDetection } from './ConflictDetection';
import { Calendar, UserPlus, Clock, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { TimeSlot } from '@/lib/api/appointments-enhanced.api';
import { useMasterValues } from '@/hooks/use-master-values';
import { defaultMasterCode } from '@/lib/master-data/appointment-master';

interface WalkInBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WalkInBookingData) => Promise<void>;
  preSelectedDate?: Date;
}

export interface WalkInBookingData {
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  duration: number;
  appointmentType: 'walk-in';
  priority: string;
  reasonForVisit: string;
  notes?: string;
  isWalkIn: true;
}

export function WalkInBookingDialog({
  isOpen,
  onClose,
  onSubmit,
  preSelectedDate
}: WalkInBookingDialogProps) {
  const { options: priorityOptions } = useMasterValues('appointment.priority');
  const [formData, setFormData] = useState<Partial<WalkInBookingData>>({
    appointmentType: 'walk-in',
    priority: '',
    isWalkIn: true,
    appointmentDate: preSelectedDate ? format(preSelectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    duration: 15
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showSlotAvailability, setShowSlotAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formData.priority && priorityOptions.length > 0) {
      setFormData((prev) => ({
        ...prev,
        priority: defaultMasterCode(priorityOptions, 'ROUTINE'),
      }));
    }
  }, [formData.priority, priorityOptions]);

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setFormData(prev => ({
      ...prev,
      startTime: slot.startTime,
      duration: slot.duration || 15
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.patientName || !formData.patientPhone || !formData.doctorId || !formData.startTime || !formData.reasonForVisit) {
      setError('Please fill in all required fields and select a time slot.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(formData as WalkInBookingData);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create walk-in appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      appointmentType: 'walk-in',
      priority: defaultMasterCode(priorityOptions, 'ROUTINE'),
      isWalkIn: true,
      appointmentDate: format(new Date(), 'yyyy-MM-dd'),
      duration: 15
    });
    setSelectedSlot(null);
    setShowSlotAvailability(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <UserPlus className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Walk-In Appointment</DialogTitle>
              <DialogDescription>
                Quick booking for patients without prior appointment
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Walk-In Badge */}
          <Alert className="bg-amber-50 border-amber-200">
            <Users className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This is a walk-in appointment. The patient is present and waiting.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Patient Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName">
                    Patient Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="patientName"
                    value={formData.patientName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="Enter patient name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="patientPhone">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="patientPhone"
                    type="tel"
                    value={formData.patientPhone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientPhone: e.target.value }))}
                    placeholder="Enter phone number"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="patientEmail">Email (Optional)</Label>
                  <Input
                    id="patientEmail"
                    type="email"
                    value={formData.patientEmail || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientEmail: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Appointment Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="doctorId">
                    Doctor <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.doctorId}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, doctorId: value }));
                      setShowSlotAvailability(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor1">Dr. Smith</SelectItem>
                      <SelectItem value="doctor2">Dr. Johnson</SelectItem>
                      <SelectItem value="doctor3">Dr. Williams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.length === 0 ? (
                        <SelectItem value="" disabled>No priorities configured</SelectItem>
                      ) : (
                        priorityOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reasonForVisit">
                    Reason for Visit <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="reasonForVisit"
                    value={formData.reasonForVisit || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                    placeholder="Describe the reason for this visit"
                    rows={3}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes or observations"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Slot Availability */}
            {showSlotAvailability && formData.doctorId && formData.appointmentDate && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Select Time Slot</h3>
                <SlotAvailabilityPanel
                  doctorId={formData.doctorId}
                  date={new Date(formData.appointmentDate)}
                  onSlotSelect={handleSlotSelect}
                  autoRefresh={true}
                  refreshInterval={30000}
                />
              </div>
            )}

            {/* Selected Slot Confirmation */}
            {selectedSlot && (
              <Alert className="bg-blue-50 border-blue-200">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Selected Time: {selectedSlot.startTime} - {selectedSlot.endTime} ({selectedSlot.duration} minutes)
                </AlertDescription>
              </Alert>
            )}

            {/* Conflict Detection */}
            {formData.doctorId && formData.appointmentDate && formData.startTime && formData.duration && (
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Conflict Check</h3>
                <ConflictDetection
                  doctorId={formData.doctorId}
                  patientId="walk-in-patient" // Placeholder for walk-in
                  appointmentDate={formData.appointmentDate}
                  startTime={formData.startTime}
                  duration={formData.duration}
                />
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !selectedSlot}
              >
                {submitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Walk-In Appointment
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

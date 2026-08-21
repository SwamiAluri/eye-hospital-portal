'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  XCircle,
  Calendar as CalendarIcon,
  Clock,
  User,
  Stethoscope,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useSessionSchedules,
  useTheaters,
  useCreateSchedule,
  useCancelSchedule,
  useSurgeonAvailability,
  useAvailableSlots,
} from '@/hooks/use-surgery-scheduling';
import type { OTScheduleDto, CreateScheduleRequest } from '@/types/surgery-scheduling';

interface SurgeryBookingProps {
  sessionId: string;
  patientId: string;
  patientName?: string;
  financiallyCleared?: boolean;
  onBookingStatusChange?: () => void;
}

export function SurgeryBooking({
  sessionId,
  patientId,
  patientName,
  financiallyCleared = false,
  onBookingStatusChange,
}: SurgeryBookingProps) {
  // Fetch data
  const { data: schedules = [], isLoading: schedulesLoading, refetch } = useSessionSchedules(sessionId);
  const { data: theaters = [], isLoading: theatersLoading } = useTheaters();
  const createScheduleMutation = useCreateSchedule();
  const cancelScheduleMutation = useCancelSchedule();

  // Dialog state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [scheduleToCancel, setScheduleToCancel] = useState<OTScheduleDto | null>(null);

  // Booking form state
  const [selectedTheaterId, setSelectedTheaterId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [surgeryType, setSurgeryType] = useState('Cataract');
  const [procedureDescription, setProcedureDescription] = useState('');
  const [eyeOperated, setEyeOperated] = useState('OD');
  const [surgeonId, setSurgeonId] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState('');

  // Availability checking
  const [showAvailabilityCheck, setShowAvailabilityCheck] = useState(false);
  const [availabilityStartTime, setAvailabilityStartTime] = useState('');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('');

  // Check surgeon availability when surgeon, date, and times are selected
  const { data: surgeonAvailability } = useSurgeonAvailability(
    surgeonId,
    selectedDate || new Date(),
    availabilityStartTime,
    availabilityEndTime,
    { enabled: showAvailabilityCheck && !!surgeonId && !!selectedDate }
  );

  // Check available slots when theater and date selected
  const { data: availableSlots = [] } = useAvailableSlots(
    selectedTheaterId,
    selectedDate || new Date(),
    { enabled: !!selectedTheaterId && !!selectedDate }
  );

  // Calculate end time based on start time + duration
  useEffect(() => {
    if (startTime && durationMinutes) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const duration = parseInt(durationMinutes);
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      setAvailabilityStartTime(`${startTime}:00`);
      setAvailabilityEndTime(`${endTimeStr}:00`);
      setShowAvailabilityCheck(true);
    }
  }, [startTime, durationMinutes]);

  // Active schedule (most recent non-cancelled)
  const activeSchedule = schedules.find((s) => s.status !== 'Cancelled');
  const hasBooking = !!activeSchedule;

  // Handle booking creation
  const handleCreateBooking = async () => {
    if (!selectedTheaterId || !selectedDate || !startTime || !surgeonId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!financiallyCleared) {
      toast.error('Cannot book OR: Financial clearance required. Please complete payment collection first.');
      return;
    }

    // Calculate end time
    const [hours, minutes] = startTime.split(':').map(Number);
    const duration = parseInt(durationMinutes);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;

    const request: CreateScheduleRequest = {
      theaterId: selectedTheaterId,
      sessionId, // Link to counseling session
      patientId,
      scheduledDate: format(selectedDate, 'yyyy-MM-dd'),
      startTime: `${startTime}:00`,
      endTime,
      surgeryType,
      procedureDescription: procedureDescription || undefined,
      eyeOperated,
      surgeonId,
    };

    try {
      const result = await createScheduleMutation.mutateAsync(request);

      if (result.success) {
        toast.success('OR booking created successfully');
        setShowBookingDialog(false);
        resetForm();
        refetch();
        onBookingStatusChange?.();
      } else {
        toast.error(result.message || 'Failed to create OR booking', {
          description: result.errors?.join(', '),
        });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create OR booking');
    }
  };

  // Handle cancellation
  const handleCancelBooking = async () => {
    if (!scheduleToCancel || !cancellationReason) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      await cancelScheduleMutation.mutateAsync({ id: scheduleToCancel.id, reason: cancellationReason });
      toast.success('OR booking cancelled successfully');
      setShowCancelDialog(false);
      setScheduleToCancel(null);
      setCancellationReason('');
      refetch();
      onBookingStatusChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to cancel OR booking');
    }
  };

  const resetForm = () => {
    setSelectedTheaterId('');
    setSelectedDate(undefined);
    setStartTime('09:00');
    setDurationMinutes('45');
    setSurgeryType('Cataract');
    setProcedureDescription('');
    setEyeOperated('OD');
    setSurgeonId('');
    setShowAvailabilityCheck(false);
  };

  if (schedulesLoading || theatersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Surgery Booking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Loading booking information...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Surgery Booking
            </CardTitle>
            {hasBooking ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Booked
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="w-4 h-4 mr-1" />
                Not Booked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Booking Status */}
          {hasBooking ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Scheduled Date</p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(activeSchedule.scheduledDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-gray-600">
                    {activeSchedule.startTime} - {activeSchedule.endTime} ({activeSchedule.durationMinutes} min)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Theater</p>
                  <p className="text-sm text-gray-600">{activeSchedule.theaterName || 'Theater ' + activeSchedule.theaterId.slice(0, 8)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Surgery Type</p>
                  <p className="text-sm text-gray-600">
                    {activeSchedule.surgeryType} ({activeSchedule.eyeOperated})
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Badge variant={
                  activeSchedule.status === 'Confirmed' ? 'default' :
                  activeSchedule.status === 'Booked' ? 'secondary' :
                  activeSchedule.status === 'InProgress' ? 'default' :
                  activeSchedule.status === 'Completed' ? 'default' :
                  'destructive'
                }>
                  {activeSchedule.status}
                </Badge>
              </div>

              {activeSchedule.status === 'Booked' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setScheduleToCancel(activeSchedule);
                    setShowCancelDialog(true);
                  }}
                  className="mt-3"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Booking
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">No OR booking scheduled for this session.</p>

              {!financiallyCleared && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-900">
                    <p className="font-medium">Patient Payment Status Incomplete</p>
                    <p className="mt-1">Complete package selection and payment collection before booking OR. Coverage authorization (if insurance) is handled in CCMS.</p>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setShowBookingDialog(true)}
                disabled={!financiallyCleared}
                className="w-full"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Book OR Slot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Operation Theater</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Patient Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Patient: {patientName || 'Unknown'}</p>
              <p className="text-xs text-blue-700 mt-1">Session ID: {sessionId.slice(0, 8)}...</p>
            </div>

            {/* Theater Selection */}
            <div className="space-y-2">
              <Label>Operation Theater *</Label>
              <Select value={selectedTheaterId} onValueChange={setSelectedTheaterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select theater" />
                </SelectTrigger>
                <SelectContent>
                  {theaters
                    .filter((t) => t.isActive && t.isOperational && !t.maintenanceMode)
                    .map((theater) => (
                      <SelectItem key={theater.id} value={theater.id}>
                        {theater.theaterName} ({theater.theaterCode || 'No code'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Scheduled Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes) *</Label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  min="15"
                  max="480"
                  step="15"
                />
              </div>
            </div>

            {/* Surgery Details */}
            <div className="space-y-2">
              <Label>Surgery Type *</Label>
              <Select value={surgeryType} onValueChange={setSurgeryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cataract">Cataract</SelectItem>
                  <SelectItem value="Glaucoma">Glaucoma</SelectItem>
                  <SelectItem value="Vitreoretinal">Vitreoretinal</SelectItem>
                  <SelectItem value="Corneal">Corneal</SelectItem>
                  <SelectItem value="Oculoplasty">Oculoplasty</SelectItem>
                  <SelectItem value="Refractive">Refractive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Procedure Description</Label>
              <Input
                value={procedureDescription}
                onChange={(e) => setProcedureDescription(e.target.value)}
                placeholder="E.g., Phacoemulsification with IOL implant"
              />
            </div>

            <div className="space-y-2">
              <Label>Eye Operated *</Label>
              <Select value={eyeOperated} onValueChange={setEyeOperated}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OD">OD (Right Eye)</SelectItem>
                  <SelectItem value="OS">OS (Left Eye)</SelectItem>
                  <SelectItem value="OU">OU (Both Eyes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Surgeon Selection (Mock - would be populated from staff API) */}
            <div className="space-y-2">
              <Label>Surgeon *</Label>
              <Input
                placeholder="Enter surgeon ID (mock)"
                value={surgeonId}
                onChange={(e) => setSurgeonId(e.target.value)}
              />
            </div>

            {/* Availability Check Result */}
            {showAvailabilityCheck && surgeonAvailability && (
              <div className={`p-3 border rounded-lg ${
                surgeonAvailability.isAvailable
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {surgeonAvailability.isAvailable ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <p className={`text-sm font-medium ${
                    surgeonAvailability.isAvailable ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {surgeonAvailability.message || (surgeonAvailability.isAvailable ? 'Surgeon Available' : 'Surgeon Not Available')}
                  </p>
                </div>
                {surgeonAvailability.conflicts && surgeonAvailability.conflicts.length > 0 && (
                  <div className="mt-2 text-xs text-red-800">
                    <p className="font-medium">Conflicts:</p>
                    {surgeonAvailability.conflicts.map((conflict, i) => (
                      <p key={i}>• {conflict.surgeryType} - {conflict.startTime} to {conflict.endTime}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={createScheduleMutation.isPending || !surgeonAvailability?.isAvailable}
            >
              {createScheduleMutation.isPending ? 'Booking...' : 'Book OR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel OR Booking</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this OR booking? This action cannot be undone.
            </p>

            <div className="space-y-2">
              <Label>Cancellation Reason *</Label>
              <Input
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Why is this booking being cancelled?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={cancelScheduleMutation.isPending || !cancellationReason}
            >
              {cancelScheduleMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

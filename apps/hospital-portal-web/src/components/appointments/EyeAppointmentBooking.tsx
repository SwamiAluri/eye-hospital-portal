'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Eye,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Stethoscope,
  Activity,
  FileText,
  Package
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { eyeAppointmentTypes, type EyeAppointmentType } from './SpecialtySlotManager';
import {
  appointmentsApi,
  type CreateAppointmentDto,
  type PreOpClearance,
  type IOLInventoryItem,
  type BiometryData,
  type SpecialtySlot
} from '@/lib/api/appointments.api';

interface EyeAppointmentBookingProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultDate?: string;
  defaultDoctorId?: string;
}

type BookingStep = 'type' | 'doctor' | 'slot' | 'pre-op' | 'iol' | 'confirm';

export function EyeAppointmentBooking({
  patientId,
  patientName,
  open,
  onClose,
  onSuccess,
  defaultDate,
  defaultDoctorId
}: EyeAppointmentBookingProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('type');
  const [loading, setLoading] = useState(false);
  
  // Booking data
  const [selectedType, setSelectedType] = useState<EyeAppointmentType | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>(defaultDoctorId || '');
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate || '');
  const [selectedSlot, setSelectedSlot] = useState<SpecialtySlot | null>(null);
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Pre-op clearance
  const [preOpClearance, setPreOpClearance] = useState<PreOpClearance | null>(null);
  const [preOpCleared, setPreOpCleared] = useState(false);
  
  // IOL selection
  const [biometryData, setBiometryData] = useState<BiometryData[]>([]);
  const [selectedEye, setSelectedEye] = useState<'OD' | 'OS'>('OD');
  const [iolInventory, setIOLInventory] = useState<IOLInventoryItem[]>([]);
  const [selectedIOL, setSelectedIOL] = useState<IOLInventoryItem | null>(null);
  const [calculatedPower, setCalculatedPower] = useState<string>('');
  
  // Available slots
  const [availableSlots, setAvailableSlots] = useState<SpecialtySlot[]>([]);

  const mockDoctors = [
    { id: 'DOC-001', name: 'Dr. Sarah Johnson', specialty: 'Cataract' },
    { id: 'DOC-002', name: 'Dr. Michael Chen', specialty: 'Retina' },
    { id: 'DOC-003', name: 'Dr. Emily Rodriguez', specialty: 'Glaucoma' },
    { id: 'DOC-004', name: 'Dr. James Williams', specialty: 'Cornea' },
    { id: 'DOC-005', name: 'Dr. Lisa Patel', specialty: 'Pediatric' }
  ];

  useEffect(() => {
    if (open) {
      resetBooking();
    }
  }, [open]);

  const resetBooking = () => {
    setCurrentStep('type');
    setSelectedType(null);
    setSelectedDoctor(defaultDoctorId || '');
    setSelectedDate(defaultDate || '');
    setSelectedSlot(null);
    setReasonForVisit('');
    setNotes('');
    setPreOpClearance(null);
    setPreOpCleared(false);
    setBiometryData([]);
    setIOLInventory([]);
    setSelectedIOL(null);
  };

  const loadPreOpClearance = async () => {
    setLoading(true);
    try {
      // const response = await appointmentsApi.checkPreOpClearance(patientId);
      
      // Mock data
      const mockClearance: PreOpClearance = {
        patientId,
        patientName,
        isCleared: true,
        clearanceDate: '2024-01-15',
        clearedBy: 'Dr. Internal Medicine',
        expiryDate: '2024-04-15',
        medicalConditions: ['Controlled Diabetes Type 2', 'Mild Hypertension'],
        medications: ['Metformin 500mg BD', 'Amlodipine 5mg OD'],
        allergies: ['Penicillin'],
        notes: 'Patient fit for surgery under local anesthesia. Blood sugar well controlled.',
        requiredTests: [
          { testName: 'Complete Blood Count', completed: true, completedDate: '2024-01-10', result: 'Normal' },
          { testName: 'Blood Sugar (Fasting)', completed: true, completedDate: '2024-01-10', result: '118 mg/dL' },
          { testName: 'ECG', completed: true, completedDate: '2024-01-12', result: 'Normal Sinus Rhythm' },
          { testName: 'Chest X-Ray', completed: true, completedDate: '2024-01-11', result: 'Clear' }
        ]
      };
      
      setPreOpClearance(mockClearance);
      setPreOpCleared(mockClearance.isCleared);
    } catch (error) {
      console.error('Failed to load pre-op clearance:', error);
      toast.error('Failed to load pre-operative clearance');
    } finally {
      setLoading(false);
    }
  };

  const loadBiometryAndIOL = async () => {
    setLoading(true);
    try {
      // const biometry = await appointmentsApi.getBiometryData(patientId);
      
      // Mock biometry data
      const mockBiometry: BiometryData[] = [
        {
          patientId,
          eye: 'OD',
          axialLength: 23.45,
          k1: 43.25,
          k2: 44.00,
          acd: 3.12,
          lensThickness: 4.2,
          whiteToWhite: 11.8,
          calculatedPower: '+21.5 D',
          formula: 'SRK/T',
          targetRefraction: '-0.50 D',
          measurementDate: '2024-01-10'
        },
        {
          patientId,
          eye: 'OS',
          axialLength: 23.52,
          k1: 43.50,
          k2: 44.25,
          acd: 3.08,
          lensThickness: 4.3,
          whiteToWhite: 11.7,
          calculatedPower: '+21.0 D',
          formula: 'SRK/T',
          targetRefraction: '-0.50 D',
          measurementDate: '2024-01-10'
        }
      ];
      
      setBiometryData(mockBiometry);
      
      // Load IOL inventory
      const calculatedPowerValue = mockBiometry.find(b => b.eye === selectedEye)?.calculatedPower || '';
      setCalculatedPower(calculatedPowerValue);
      
      // const iolResponse = await appointmentsApi.getIOLInventory(calculatedPowerValue);
      
      // Mock IOL inventory
      const mockIOL: IOLInventoryItem[] = [
        {
          id: 'IOL-001',
          manufacturer: 'Alcon',
          model: 'AcrySof IQ SN60WF',
          type: 'Monofocal',
          power: '+21.5 D',
          material: 'Hydrophobic Acrylic',
          availability: 15,
          price: 15000
        },
        {
          id: 'IOL-002',
          manufacturer: 'J&J Vision',
          model: 'Tecnis ZCB00',
          type: 'Monofocal',
          power: '+21.5 D',
          material: 'Hydrophobic Acrylic',
          availability: 12,
          price: 14500
        },
        {
          id: 'IOL-003',
          manufacturer: 'Alcon',
          model: 'AcrySof IQ PanOptix',
          type: 'Multifocal',
          power: '+21.5 D',
          material: 'Hydrophobic Acrylic',
          availability: 8,
          price: 65000
        },
        {
          id: 'IOL-004',
          manufacturer: 'Zeiss',
          model: 'AT LISA tri 839MP',
          type: 'Multifocal',
          power: '+21.5 D',
          material: 'Hydrophilic Acrylic',
          availability: 5,
          price: 62000
        }
      ];
      
      setIOLInventory(mockIOL);
    } catch (error) {
      console.error('Failed to load biometry/IOL:', error);
      toast.error('Failed to load biometry data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedDate || !selectedType) return;
    
    setLoading(true);
    try {
      let slots: SpecialtySlot[] = [];
      
      if (selectedType.category === 'OPD') {
        // const response = await appointmentsApi.getOPDSlots(selectedDate, selectedType.specialty);
        // slots = response.data;
        
        // Mock OPD slots
        slots = [
          { date: selectedDate, startTime: '09:00', endTime: '09:30', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '09:30', endTime: '10:00', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '10:00', endTime: '10:30', available: false, bookedCount: 1, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '10:30', endTime: '11:00', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '11:00', endTime: '11:30', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty }
        ];
      } else {
        // const response = await appointmentsApi.getSurgerySlots(selectedDate, selectedType.name);
        // slots = response.data;
        
        // Mock surgery slots
        slots = [
          { date: selectedDate, startTime: '08:00', endTime: '09:30', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '09:30', endTime: '11:00', available: true, bookedCount: 0, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty },
          { date: selectedDate, startTime: '11:00', endTime: '12:30', available: false, bookedCount: 1, maxCapacity: 1, doctorId: 'DOC-001', doctorName: 'Dr. Sarah Johnson', appointmentType: selectedType.name, specialty: selectedType.specialty }
        ];
      }
      
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Failed to load slots:', error);
      toast.error('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 'slot' && selectedDate && selectedType) {
      loadAvailableSlots();
    }
  }, [currentStep, selectedDate, selectedType]);

  useEffect(() => {
    if (currentStep === 'pre-op' && selectedType?.requiresPreOp) {
      loadPreOpClearance();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'iol' && selectedType?.requiresIOLSelection) {
      loadBiometryAndIOL();
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep === 'type' && selectedType) {
      setCurrentStep('doctor');
    } else if (currentStep === 'doctor' && selectedDoctor) {
      setCurrentStep('slot');
    } else if (currentStep === 'slot' && selectedSlot) {
      if (selectedType?.requiresPreOp) {
        setCurrentStep('pre-op');
      } else if (selectedType?.requiresIOLSelection) {
        setCurrentStep('iol');
      } else {
        setCurrentStep('confirm');
      }
    } else if (currentStep === 'pre-op') {
      if (selectedType?.requiresIOLSelection) {
        setCurrentStep('iol');
      } else {
        setCurrentStep('confirm');
      }
    } else if (currentStep === 'iol') {
      setCurrentStep('confirm');
    }
  };

  const handleBack = () => {
    if (currentStep === 'doctor') {
      setCurrentStep('type');
    } else if (currentStep === 'slot') {
      setCurrentStep('doctor');
    } else if (currentStep === 'pre-op') {
      setCurrentStep('slot');
    } else if (currentStep === 'iol') {
      if (selectedType?.requiresPreOp) {
        setCurrentStep('pre-op');
      } else {
        setCurrentStep('slot');
      }
    } else if (currentStep === 'confirm') {
      if (selectedType?.requiresIOLSelection) {
        setCurrentStep('iol');
      } else if (selectedType?.requiresPreOp) {
        setCurrentStep('pre-op');
      } else {
        setCurrentStep('slot');
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !selectedSlot) {
      toast.error('Please complete all required fields');
      return;
    }

    // Validate pre-op clearance
    if (selectedType.requiresPreOp && !preOpCleared) {
      toast.error('Pre-operative clearance is required for this appointment');
      return;
    }

    // Validate IOL selection
    if (selectedType.requiresIOLSelection && !selectedIOL) {
      toast.error('IOL selection is required for cataract surgery');
      return;
    }

    setLoading(true);
    try {
      const appointmentData: CreateAppointmentDto = {
        patientId,
        doctorId: selectedSlot.doctorId,
        appointmentDate: selectedSlot.date,
        startTime: selectedSlot.startTime,
        duration: selectedType.duration,
        appointmentType: selectedType.name,
        appointmentCategory: selectedType.category,
        specialty: selectedType.specialty,
        reasonForVisit,
        notes,
        requiresPreOp: selectedType.requiresPreOp,
        preOpClearanceDate: preOpClearance?.clearanceDate,
        requiresIOLSelection: selectedType.requiresIOLSelection,
        selectedIOLId: selectedIOL?.id,
        iolPower: calculatedPower
      };

      await appointmentsApi.create(appointmentData);
      
      toast.success('Appointment booked successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to book appointment:', error);
      toast.error('Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'OPD': return 'bg-blue-100 text-blue-800';
      case 'Surgery': return 'bg-red-100 text-red-800';
      case 'Diagnostic': return 'bg-purple-100 text-purple-800';
      case 'Follow-up': return 'bg-green-100 text-green-800';
      case 'Emergency': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Eye Appointment</DialogTitle>
          <DialogDescription>
            Schedule appointment for {patientName}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {(['type', 'doctor', 'slot', ...(selectedType?.requiresPreOp ? ['pre-op'] : []), ...(selectedType?.requiresIOLSelection ? ['iol'] : []), 'confirm'] as BookingStep[]).map((step, index, steps) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                steps.indexOf(currentStep) >= index ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  steps.indexOf(currentStep) > index ? 'bg-blue-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Appointment Type */}
        {currentStep === 'type' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Select Appointment Type</h3>
            
            <Tabs defaultValue="OPD">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="OPD">OPD</TabsTrigger>
                <TabsTrigger value="Surgery">Surgery</TabsTrigger>
                <TabsTrigger value="Diagnostic">Diagnostic</TabsTrigger>
                <TabsTrigger value="Follow-up">Follow-up</TabsTrigger>
              </TabsList>

              {(['OPD', 'Surgery', 'Diagnostic', 'Follow-up'] as const).map(category => (
                <TabsContent key={category} value={category} className="space-y-3">
                  {eyeAppointmentTypes
                    .filter(t => t.category === category)
                    .map(type => (
                      <Card
                        key={type.id}
                        className={`cursor-pointer transition-all ${
                          selectedType?.id === type.id ? 'border-blue-500 border-2' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedType(type)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{type.name}</h4>
                                <Badge className={getCategoryColor(type.category)}>
                                  {type.category}
                                </Badge>
                                <Badge variant="outline">{type.specialty}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{type.duration} min</span>
                                </div>
                                {type.requiresPreOp && (
                                  <Badge variant="secondary">Pre-op Required</Badge>
                                )}
                                {type.requiresIOLSelection && (
                                  <Badge variant="secondary">IOL Selection</Badge>
                                )}
                              </div>
                            </div>
                            {selectedType?.id === type.id && (
                              <CheckCircle className="h-6 w-6 text-blue-500" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </TabsContent>
              ))}
            </Tabs>

            <Button onClick={handleNext} disabled={!selectedType} className="w-full">
              Next: Select Doctor <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Doctor Selection */}
        {currentStep === 'doctor' && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleBack} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <h3 className="font-semibold text-lg">Select Doctor</h3>
            
            <div className="space-y-3">
              {mockDoctors
                .filter(doc => !selectedType?.specialty || doc.specialty === selectedType.specialty || selectedType.specialty === 'General')
                .map(doctor => (
                  <Card
                    key={doctor.id}
                    className={`cursor-pointer transition-all ${
                      selectedDoctor === doctor.id ? 'border-blue-500 border-2' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      setSelectedDoctor(doctor.id);
                      setSelectedDoctorName(doctor.name);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{doctor.name}</h4>
                            <p className="text-sm text-muted-foreground">{doctor.specialty} Specialist</p>
                          </div>
                        </div>
                        {selectedDoctor === doctor.id && (
                          <CheckCircle className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            <Button onClick={handleNext} disabled={!selectedDoctor} className="w-full">
              Next: Select Time Slot <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 3: Slot Selection */}
        {currentStep === 'slot' && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleBack} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <h3 className="font-semibold text-lg">Select Date & Time</h3>

            <div>
              <Label htmlFor="appointmentDate">Appointment Date</Label>
              <Input
                id="appointmentDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <h4 className="font-medium">Available Time Slots</h4>
                {loading ? (
                  <div className="text-center py-4">Loading slots...</div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot, index) => (
                      <Button
                        key={index}
                        variant={selectedSlot === slot ? 'default' : 'outline'}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className="h-auto py-3"
                      >
                        <div className="text-center">
                          <div className="font-semibold">{slot.startTime}</div>
                          <div className="text-xs opacity-70">
                            {slot.available ? `${slot.maxCapacity - slot.bookedCount} available` : 'Booked'}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No slots available for the selected date. Please choose another date.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="reasonForVisit">Reason for Visit (optional)</Label>
              <Textarea
                id="reasonForVisit"
                placeholder="Brief description of chief complaint"
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleNext} disabled={!selectedSlot} className="w-full">
              {selectedType?.requiresPreOp ? 'Next: Pre-op Clearance' : selectedType?.requiresIOLSelection ? 'Next: IOL Selection' : 'Next: Confirm Booking'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 4: Pre-op Clearance (conditional) */}
        {currentStep === 'pre-op' && selectedType?.requiresPreOp && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleBack} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <h3 className="font-semibold text-lg">Pre-operative Clearance</h3>

            {loading ? (
              <div className="text-center py-4">Loading clearance data...</div>
            ) : preOpClearance ? (
              <Card className={preOpClearance.isCleared ? 'border-green-500' : 'border-red-500'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Medical Clearance Status</CardTitle>
                    {preOpClearance.isCleared ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 mr-1" /> Cleared
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">
                        <AlertCircle className="h-4 w-4 mr-1" /> Not Cleared
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Cleared By:</span>
                      <p className="text-muted-foreground">{preOpClearance.clearedBy}</p>
                    </div>
                    <div>
                      <span className="font-medium">Clearance Date:</span>
                      <p className="text-muted-foreground">{preOpClearance.clearanceDate}</p>
                    </div>
                    <div>
                      <span className="font-medium">Valid Until:</span>
                      <p className="text-muted-foreground">{preOpClearance.expiryDate}</p>
                    </div>
                  </div>

                  {preOpClearance.medicalConditions && preOpClearance.medicalConditions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Medical Conditions</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {preOpClearance.medicalConditions.map((condition, i) => (
                          <li key={i}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preOpClearance.requiredTests && (
                    <div>
                      <h4 className="font-medium mb-2">Pre-operative Tests</h4>
                      <div className="space-y-2">
                        {preOpClearance.requiredTests.map((test, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              {test.completed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              )}
                              <span className="text-sm">{test.testName}</span>
                            </div>
                            {test.completed && (
                              <span className="text-xs text-muted-foreground">{test.result}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {preOpClearance.notes && (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>{preOpClearance.notes}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="preOpConfirm"
                      checked={preOpCleared}
                      onCheckedChange={(checked) => setPreOpCleared(checked as boolean)}
                      disabled={!preOpClearance.isCleared}
                    />
                    <Label htmlFor="preOpConfirm" className="cursor-pointer">
                      I confirm that pre-operative clearance is valid and complete
                    </Label>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No pre-operative clearance found. Patient must obtain medical clearance before booking surgery.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleNext}
              disabled={!preOpCleared}
              className="w-full"
            >
              {selectedType?.requiresIOLSelection ? 'Next: IOL Selection' : 'Next: Confirm Booking'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 5: IOL Selection (conditional) */}
        {currentStep === 'iol' && selectedType?.requiresIOLSelection && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleBack} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <h3 className="font-semibold text-lg">IOL Selection</h3>

            {loading ? (
              <div className="text-center py-4">Loading biometry data...</div>
            ) : (
              <>
                {/* Biometry Data */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Biometry Measurements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-4">
                      <Button
                        variant={selectedEye === 'OD' ? 'default' : 'outline'}
                        onClick={() => setSelectedEye('OD')}
                      >
                        Right Eye (OD)
                      </Button>
                      <Button
                        variant={selectedEye === 'OS' ? 'default' : 'outline'}
                        onClick={() => setSelectedEye('OS')}
                      >
                        Left Eye (OS)
                      </Button>
                    </div>

                    {biometryData.find(b => b.eye === selectedEye) && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {Object.entries(biometryData.find(b => b.eye === selectedEye)!).map(([key, value]) => {
                          if (['patientId', 'eye', 'formula', 'measurementDate'].includes(key)) return null;
                          return (
                            <div key={key}>
                              <span className="font-medium text-blue-900 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </span>
                              <p className="text-blue-800">{value}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <Alert className="mt-4 bg-white border-blue-300">
                      <Eye className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Calculated IOL Power: {calculatedPower}</strong>
                        <br />
                        Formula: {biometryData.find(b => b.eye === selectedEye)?.formula}
                        <br />
                        Target Refraction: {biometryData.find(b => b.eye === selectedEye)?.targetRefraction}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* IOL Selection */}
                <div>
                  <h4 className="font-medium mb-3">Available IOL Options</h4>
                  <div className="space-y-2">
                    {iolInventory.map(iol => (
                      <Card
                        key={iol.id}
                        className={`cursor-pointer transition-all ${
                          selectedIOL?.id === iol.id ? 'border-blue-500 border-2' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedIOL(iol)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{iol.manufacturer} - {iol.model}</h4>
                                <Badge>{iol.type}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div><Package className="h-3 w-3 inline mr-1" />Power: {iol.power}</div>
                                <div>Material: {iol.material}</div>
                                <div>In Stock: {iol.availability} units</div>
                                {iol.price && <div>Price: ₹{iol.price.toLocaleString()}</div>}
                              </div>
                            </div>
                            {selectedIOL?.id === iol.id && (
                              <CheckCircle className="h-6 w-6 text-blue-500" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button onClick={handleNext} disabled={!selectedIOL} className="w-full">
              Next: Confirm Booking <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 6: Confirmation */}
        {currentStep === 'confirm' && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={handleBack} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <h3 className="font-semibold text-lg">Confirm Appointment</h3>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Patient</span>
                    <p className="font-medium">{patientName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Appointment Type</span>
                    <p className="font-medium">{selectedType?.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Doctor</span>
                    <p className="font-medium">{selectedDoctorName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Date & Time</span>
                    <p className="font-medium">
                      {selectedSlot?.date} at {selectedSlot?.startTime}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <p className="font-medium">{selectedType?.duration} minutes</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Category</span>
                    <Badge className={getCategoryColor(selectedType?.category || '')}>
                      {selectedType?.category}
                    </Badge>
                  </div>
                </div>

                {selectedType?.requiresPreOp && preOpClearance && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Pre-operative clearance confirmed (Valid until {preOpClearance.expiryDate})
                    </AlertDescription>
                  </Alert>
                )}

                {selectedType?.requiresIOLSelection && selectedIOL && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>IOL Selected:</strong> {selectedIOL.manufacturer} {selectedIOL.model} ({selectedIOL.power})
                    </AlertDescription>
                  </Alert>
                )}

                {reasonForVisit && (
                  <div>
                    <span className="text-sm text-muted-foreground">Reason for Visit</span>
                    <p className="mt-1">{reasonForVisit}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="finalNotes">Additional Notes (optional)</Label>
                  <Textarea
                    id="finalNotes"
                    placeholder="Any special instructions or notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? 'Booking...' : 'Confirm & Book Appointment'}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

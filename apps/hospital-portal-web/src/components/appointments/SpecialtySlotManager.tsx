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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Eye,
  Scissors,
  Clock,
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Users,
  Activity,
  Stethoscope,
  Search
} from 'lucide-react';
import { toast } from '@/lib/toast';

// Eye Hospital Specific Appointment Types
export interface EyeAppointmentType {
  id: string;
  name: string;
  category: 'OPD' | 'Surgery' | 'Diagnostic' | 'Follow-up' | 'Emergency';
  specialty: 'General' | 'Retina' | 'Glaucoma' | 'Cataract' | 'Cornea' | 'Pediatric' | 'Neuro-Ophthalmology' | 'Oculoplasty';
  duration: number; // minutes
  defaultColor: string;
  requiresPreOp: boolean;
  requiresIOLSelection: boolean;
  requiresAnesthesia: boolean;
  maxPatientsPerSlot: number;
  description: string;
  preparationInstructions?: string;
}

export interface SpecialtySlot {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  appointmentTypeId: string;
  appointmentTypeName: string;
  dayOfWeek: number; // 0-6
  startTime: string;
  endTime: string;
  capacity: number; // number of slots
  isActive: boolean;
  category: 'OPD' | 'Surgery';
  notes?: string;
}

const eyeAppointmentTypes: EyeAppointmentType[] = [
  // OPD Appointments
  {
    id: 'opd-comprehensive',
    name: 'Comprehensive Eye Examination',
    category: 'OPD',
    specialty: 'General',
    duration: 30,
    defaultColor: '#3B82F6',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Complete eye health assessment including refraction, tonometry, and fundus examination'
  },
  {
    id: 'opd-glaucoma-followup',
    name: 'Glaucoma Follow-up',
    category: 'OPD',
    specialty: 'Glaucoma',
    duration: 15,
    defaultColor: '#8B5CF6',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'IOP check, visual field assessment, OCT RNFL',
    preparationInstructions: 'Bring current medications list'
  },
  {
    id: 'opd-retina-consultation',
    name: 'Retina Consultation',
    category: 'OPD',
    specialty: 'Retina',
    duration: 30,
    defaultColor: '#EC4899',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Diabetic retinopathy, ARMD, retinal tear assessment',
    preparationInstructions: 'Pupil dilation required - arrange transportation'
  },
  {
    id: 'opd-cataract-preop',
    name: 'Cataract Pre-operative Assessment',
    category: 'OPD',
    specialty: 'Cataract',
    duration: 45,
    defaultColor: '#F59E0B',
    requiresPreOp: true,
    requiresIOLSelection: true,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Biometry, IOL calculation, medical clearance review, consent',
    preparationInstructions: 'Bring medical clearance letter, current medications list'
  },
  {
    id: 'opd-pediatric',
    name: 'Pediatric Eye Examination',
    category: 'OPD',
    specialty: 'Pediatric',
    duration: 40,
    defaultColor: '#10B981',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Child eye exam, cycloplegic refraction, strabismus assessment',
    preparationInstructions: 'Cycloplegic drops may be used - arrange 2-3 hours'
  },
  
  // Surgery Appointments
  {
    id: 'surgery-cataract-phaco',
    name: 'Cataract Surgery (Phacoemulsification)',
    category: 'Surgery',
    specialty: 'Cataract',
    duration: 90,
    defaultColor: '#EF4444',
    requiresPreOp: true,
    requiresIOLSelection: true,
    requiresAnesthesia: true,
    maxPatientsPerSlot: 1,
    description: 'Phacoemulsification with IOL implantation under local anesthesia',
    preparationInstructions: 'NPO 6 hours before surgery. Pre-op eye drops 3 days before.'
  },
  {
    id: 'surgery-retina-vitrectomy',
    name: 'Vitreoretinal Surgery',
    category: 'Surgery',
    specialty: 'Retina',
    duration: 120,
    defaultColor: '#DC2626',
    requiresPreOp: true,
    requiresIOLSelection: false,
    requiresAnesthesia: true,
    maxPatientsPerSlot: 1,
    description: 'Vitrectomy for retinal detachment, ERM, macular hole',
    preparationInstructions: 'NPO 8 hours. Arrange post-op care assistant.'
  },
  {
    id: 'surgery-glaucoma-trabeculectomy',
    name: 'Glaucoma Surgery (Trabeculectomy)',
    category: 'Surgery',
    specialty: 'Glaucoma',
    duration: 90,
    defaultColor: '#7C3AED',
    requiresPreOp: true,
    requiresIOLSelection: false,
    requiresAnesthesia: true,
    maxPatientsPerSlot: 1,
    description: 'Filtration surgery for glaucoma',
    preparationInstructions: 'NPO 6 hours. Continue IOP medications until surgery day.'
  },
  {
    id: 'surgery-lasik',
    name: 'LASIK Refractive Surgery',
    category: 'Surgery',
    specialty: 'Cornea',
    duration: 60,
    defaultColor: '#06B6D4',
    requiresPreOp: true,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Laser vision correction for myopia, hyperopia, astigmatism',
    preparationInstructions: 'No contact lenses 2 weeks before. Arrange transportation.'
  },
  
  // Diagnostic/Treatment Appointments
  {
    id: 'diagnostic-oct',
    name: 'OCT Imaging',
    category: 'Diagnostic',
    specialty: 'General',
    duration: 20,
    defaultColor: '#14B8A6',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 2,
    description: 'Optical Coherence Tomography for macula and optic nerve',
    preparationInstructions: 'Dilation may be required'
  },
  {
    id: 'treatment-anti-vegf',
    name: 'Anti-VEGF Injection',
    category: 'Follow-up',
    specialty: 'Retina',
    duration: 30,
    defaultColor: '#F97316',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Intravitreal injection for AMD, DME, RVO',
    preparationInstructions: 'Antibiotic drops 3 days before injection'
  },
  {
    id: 'treatment-laser',
    name: 'Laser Photocoagulation',
    category: 'Follow-up',
    specialty: 'Retina',
    duration: 30,
    defaultColor: '#F59E0B',
    requiresPreOp: false,
    requiresIOLSelection: false,
    requiresAnesthesia: false,
    maxPatientsPerSlot: 1,
    description: 'Retinal laser for diabetic retinopathy, retinal tears',
    preparationInstructions: 'Pupil dilation required'
  }
];

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SpecialtySlotManagerProps {
  doctorId?: string;
  onSlotsUpdated?: () => void;
}

export function SpecialtySlotManager({ doctorId, onSlotsUpdated }: SpecialtySlotManagerProps) {
  const [slots, setSlots] = useState<SpecialtySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SpecialtySlot | null>(null);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSlots();
  }, [doctorId]);

  const loadSlots = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await specialtySlotApi.getByDoctor(doctorId);
      
      // Mock data
      const mockSlots: SpecialtySlot[] = [
        {
          id: '1',
          doctorId: 'DOC-001',
          doctorName: 'Dr. Sarah Johnson',
          specialty: 'Cataract',
          appointmentTypeId: 'opd-cataract-preop',
          appointmentTypeName: 'Cataract Pre-operative Assessment',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '12:00',
          capacity: 4,
          isActive: true,
          category: 'OPD',
          notes: 'Pre-op assessments on Mondays'
        },
        {
          id: '2',
          doctorId: 'DOC-001',
          doctorName: 'Dr. Sarah Johnson',
          specialty: 'Cataract',
          appointmentTypeId: 'surgery-cataract-phaco',
          appointmentTypeName: 'Cataract Surgery',
          dayOfWeek: 3, // Wednesday
          startTime: '08:00',
          endTime: '12:00',
          capacity: 3,
          isActive: true,
          category: 'Surgery',
          notes: 'Surgery days: Wednesday, Friday'
        },
        {
          id: '3',
          doctorId: 'DOC-002',
          doctorName: 'Dr. Michael Chen',
          specialty: 'Retina',
          appointmentTypeId: 'opd-retina-consultation',
          appointmentTypeName: 'Retina Consultation',
          dayOfWeek: 2, // Tuesday
          startTime: '14:00',
          endTime: '17:00',
          capacity: 6,
          isActive: true,
          category: 'OPD',
          notes: 'Afternoon retina clinic'
        },
        {
          id: '4',
          doctorId: 'DOC-003',
          doctorName: 'Dr. Emily Rodriguez',
          specialty: 'Glaucoma',
          appointmentTypeId: 'opd-glaucoma-followup',
          appointmentTypeName: 'Glaucoma Follow-up',
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '12:00',
          capacity: 8,
          isActive: true,
          category: 'OPD',
          notes: 'Quick IOP checks - 15 min slots'
        }
      ];

      setSlots(mockSlots);
    } catch (error) {
      console.error('Failed to load slots:', error);
      toast.error('Failed to load specialty slots');
    } finally {
      setLoading(false);
    }
  };

  const createSlot = () => {
    const newSlot: SpecialtySlot = {
      id: '',
      doctorId: doctorId || '',
      doctorName: '',
      specialty: 'General',
      appointmentTypeId: '',
      appointmentTypeName: '',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      capacity: 1,
      isActive: true,
      category: 'OPD',
      notes: ''
    };
    setSelectedSlot(newSlot);
    setShowSlotDialog(true);
  };

  const editSlot = (slot: SpecialtySlot) => {
    setSelectedSlot({ ...slot });
    setShowSlotDialog(true);
  };

  const saveSlot = async () => {
    if (!selectedSlot) return;

    try {
      // TODO: API call to save slot
      // if (selectedSlot.id) {
      //   await specialtySlotApi.update(selectedSlot.id, selectedSlot);
      // } else {
      //   await specialtySlotApi.create(selectedSlot);
      // }

      toast.success(selectedSlot.id ? 'Slot updated successfully' : 'Slot created successfully');
      setShowSlotDialog(false);
      loadSlots();
      onSlotsUpdated?.();
    } catch (error) {
      toast.error('Failed to save slot');
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      // TODO: API call
      // await specialtySlotApi.delete(slotId);
      toast.success('Slot deleted successfully');
      loadSlots();
      onSlotsUpdated?.();
    } catch (error) {
      toast.error('Failed to delete slot');
    }
  };

  const handleAppointmentTypeChange = (typeId: string) => {
    const appointmentType = eyeAppointmentTypes.find(t => t.id === typeId);
    if (appointmentType && selectedSlot) {
      setSelectedSlot({
        ...selectedSlot,
        appointmentTypeId: typeId,
        appointmentTypeName: appointmentType.name,
        specialty: appointmentType.specialty,
        category: appointmentType.category
      });
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'OPD':
        return <Badge className="bg-blue-100 text-blue-800">OPD</Badge>;
      case 'Surgery':
        return <Badge className="bg-red-100 text-red-800">Surgery</Badge>;
      case 'Diagnostic':
        return <Badge className="bg-purple-100 text-purple-800">Diagnostic</Badge>;
      case 'Follow-up':
        return <Badge className="bg-green-100 text-green-800">Follow-up</Badge>;
      default:
        return null;
    }
  };

  const filteredSlots = slots.filter(slot => {
    const matchesCategory = filterCategory === 'all' || slot.category === filterCategory;
    const matchesSpecialty = filterSpecialty === 'all' || slot.specialty === filterSpecialty;
    const matchesSearch = slot.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         slot.appointmentTypeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSpecialty && matchesSearch;
  });

  const groupedSlots = filteredSlots.reduce((acc, slot) => {
    const day = daysOfWeek[slot.dayOfWeek];
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<string, SpecialtySlot[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Specialty Appointment Slots</CardTitle>
              <CardDescription>
                Manage OPD and Surgery slots with eye hospital-specific appointment types
              </CardDescription>
            </div>
            <Button onClick={createSlot}>
              <Plus className="h-4 w-4 mr-2" />
              Create Slot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by doctor or appointment type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="OPD">OPD</SelectItem>
                <SelectItem value="Surgery">Surgery</SelectItem>
                <SelectItem value="Diagnostic">Diagnostic</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Retina">Retina</SelectItem>
                <SelectItem value="Glaucoma">Glaucoma</SelectItem>
                <SelectItem value="Cataract">Cataract</SelectItem>
                <SelectItem value="Cornea">Cornea</SelectItem>
                <SelectItem value="Pediatric">Pediatric</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Slots by Day */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : (
            <Tabs defaultValue={daysOfWeek[1]}>
              <TabsList className="grid w-full grid-cols-7">
                {daysOfWeek.map(day => (
                  <TabsTrigger key={day} value={day}>
                    {day.substring(0, 3)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {daysOfWeek.map(day => (
                <TabsContent key={day} value={day} className="space-y-3">
                  {groupedSlots[day]?.length > 0 ? (
                    groupedSlots[day]
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map(slot => (
                        <Card key={slot.id} className="border-l-4 border-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">{slot.doctorName}</h4>
                                  {getCategoryBadge(slot.category)}
                                  <Badge variant="outline">{slot.specialty}</Badge>
                                  {!slot.isActive && (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Stethoscope className="h-4 w-4" />
                                    <span>{slot.appointmentTypeName}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>{slot.startTime} - {slot.endTime}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span>Capacity: {slot.capacity} patients</span>
                                  </div>
                                  {slot.notes && (
                                    <div className="mt-2 p-2 bg-blue-50 rounded text-blue-800">
                                      {slot.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editSlot(slot)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSlot(slot.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No slots configured for {day}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Slot Edit Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSlot?.id ? 'Edit Specialty Slot' : 'Create Specialty Slot'}
            </DialogTitle>
            <DialogDescription>
              Configure appointment availability for specialty services
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="appointmentType">Appointment Type</Label>
                <Select
                  value={selectedSlot.appointmentTypeId}
                  onValueChange={handleAppointmentTypeChange}
                >
                  <SelectTrigger id="appointmentType">
                    <SelectValue placeholder="Select appointment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2 font-semibold text-sm text-muted-foreground">OPD Appointments</div>
                    {eyeAppointmentTypes
                      .filter(t => t.category === 'OPD')
                      .map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.duration} min) - {type.specialty}
                        </SelectItem>
                      ))}
                    
                    <div className="p-2 font-semibold text-sm text-muted-foreground mt-2">Surgery</div>
                    {eyeAppointmentTypes
                      .filter(t => t.category === 'Surgery')
                      .map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.duration} min) - {type.specialty}
                        </SelectItem>
                      ))}
                    
                    <div className="p-2 font-semibold text-sm text-muted-foreground mt-2">Diagnostic & Treatment</div>
                    {eyeAppointmentTypes
                      .filter(t => t.category === 'Diagnostic' || t.category === 'Follow-up')
                      .map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.duration} min)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedSlot.appointmentTypeId && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dayOfWeek">Day of Week</Label>
                  <Select
                    value={selectedSlot.dayOfWeek.toString()}
                    onValueChange={(value) =>
                      setSelectedSlot({ ...selectedSlot, dayOfWeek: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="dayOfWeek">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="capacity">Capacity (patients)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={selectedSlot.capacity}
                    onChange={(e) =>
                      setSelectedSlot({ ...selectedSlot, capacity: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={selectedSlot.startTime}
                    onChange={(e) =>
                      setSelectedSlot({ ...selectedSlot, startTime: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={selectedSlot.endTime}
                    onChange={(e) =>
                      setSelectedSlot({ ...selectedSlot, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., Pre-op assessments only, IOL selection required"
                  value={selectedSlot.notes || ''}
                  onChange={(e) =>
                    setSelectedSlot({ ...selectedSlot, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={selectedSlot.isActive}
                  onCheckedChange={(checked) =>
                    setSelectedSlot({ ...selectedSlot, isActive: checked as boolean })
                  }
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Slot is active and available for booking
                </Label>
              </div>

              {/* Special Requirements Display */}
              {selectedSlot.appointmentTypeId && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-blue-900 mb-2">Special Requirements</h4>
                    <div className="space-y-1 text-sm text-blue-800">
                      {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.requiresPreOp && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Pre-operative assessment required</span>
                        </div>
                      )}
                      {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.requiresIOLSelection && (
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          <span>IOL selection and power calculation required</span>
                        </div>
                      )}
                      {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.requiresAnesthesia && (
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          <span>Anesthesia consultation required</span>
                        </div>
                      )}
                      {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.preparationInstructions && (
                        <div className="mt-2 p-2 bg-white rounded">
                          <span className="font-medium">Patient Instructions:</span>
                          <br />
                          {eyeAppointmentTypes.find(t => t.id === selectedSlot.appointmentTypeId)?.preparationInstructions}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={saveSlot}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save Slot
                </Button>
                <Button variant="outline" onClick={() => setShowSlotDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { eyeAppointmentTypes };

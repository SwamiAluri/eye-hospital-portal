'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  ArrowRight,
  Search,
  Filter,
  Bell,
  UserPlus,
  Eye,
  Activity,
  Timer
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/lib/auth-store';
import { queueDisplayApi } from '@/lib/api/queue-display.api';
import { visitsApi } from '@/lib/api/visits.api';

interface QueuePatient {
  id: string;
  visitId?: string;
  queueNumber: number;
  patientId: string;
  tokenNumber: string;
  patientName: string;
  appointmentTime: string;
  appointmentType: string;
  department: string;
  doctor: string;
  station: string;
  status: 'waiting' | 'in-consultation' | 'completed' | 'no-show' | 'emergency';
  priority: 'emergency' | 'urgent' | 'routine';
  checkedInAt?: string;
  consultationStartedAt?: string;
  completedAt?: string;
  waitTime?: number; // in minutes
  phone: string;
  age: number;
  gender: string;
  chiefComplaint?: string;
}

interface DepartmentQueue {
  department: string;
  waiting: number;
  inConsultation: number;
  averageWaitTime: number;
}

export default function QueueManagementPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;
  const [patients, setPatients] = useState<QueuePatient[]>([]);
  const [departmentQueues, setDepartmentQueues] = useState<DepartmentQueue[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);

  useEffect(() => {
    loadQueueData();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadQueueData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadQueueData = async () => {
    setLoading(true);
    try {
      if (!branchId) {
        setPatients([]);
        setDepartmentQueues([]);
        return;
      }

      const payload = await queueDisplayApi.getBranchDisplay({ branchId, mode: 'branch', interval: 10 });

      const toPriority = (u: string): QueuePatient['priority'] => {
        const v = (u || '').toLowerCase();
        if (v.includes('emerg')) return 'emergency';
        if (v.includes('urgent')) return 'urgent';
        return 'routine';
      };

      const mapped: QueuePatient[] = [];
      const deptMap = new Map<string, QueuePatient[]>();

      payload.slides.forEach((slide) => {
        const dept = slide.displayLabel || slide.stationLabel || slide.station;
        const doctor = slide.staffName || '—';

        const add = (p: any, status: QueuePatient['status']) => {
          const row: QueuePatient = {
            id: `${slide.station}-${slide.roomCode}-${p.tokenNumber}-${status}`,
            visitId: p.visitId ?? p.VisitId,
            queueNumber: Number(p.passNumber ?? 0),
            patientId: String(p.patientId ?? p.PatientId ?? ''),
            tokenNumber: String(p.tokenNumber ?? ''),
            patientName: String(p.patientName ?? ''),
            appointmentTime: '—',
            appointmentType: String(p.reasonLabel ?? slide.stationLabel ?? slide.station ?? ''),
            department: dept,
            doctor,
            station: String(slide.station ?? ''),
            status,
            priority: toPriority(String(p.urgency ?? 'Routine')),
            phone: '',
            age: 0,
            gender: String(p.gender ?? '—'),
            chiefComplaint: undefined,
          };
          mapped.push(row);
          const list = deptMap.get(dept) ?? [];
          list.push(row);
          deptMap.set(dept, list);
        };

        if (slide.nowServing) add(slide.nowServing, 'in-consultation');
        slide.nextQueue?.forEach((p: any) => add(p, 'waiting'));
      });

      setPatients(mapped);
      setDepartmentQueues(
        Array.from(deptMap.entries()).map(([department, list]) => ({
          department,
          waiting: list.filter((p) => p.status === 'waiting').length,
          inConsultation: list.filter((p) => p.status === 'in-consultation').length,
          averageWaitTime: 0,
        })),
      );

    } catch (error) {
      console.error('Failed to load queue data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = (patient: QueuePatient) => {
    // TODO: API call to check in patient
    toast.success(`${patient.patientName} checked in successfully`);
    loadQueueData();
  };

  const handleStartConsultation = (patient: QueuePatient) => {
    if (!patient.visitId) {
      toast.error('Visit ID not available for this queue item');
      return;
    }
    visitsApi
      .sendTo({ visitId: patient.visitId, station: patient.station || 'doctor' })
      .then(() => {
        toast.success(`Sent ${patient.patientName} to ${patient.station || 'doctor'}`);
        loadQueueData();
      })
      .catch(() => toast.error('Failed to route to station'));
  };

  const handleCompleteConsultation = (patient: QueuePatient) => {
    if (!patient.visitId) {
      toast.error('Visit ID not available for this queue item');
      return;
    }
    visitsApi
      .completeVisit({ visitId: patient.visitId })
      .then(() => {
        toast.success(`Visit completed for ${patient.patientName}`);
        loadQueueData();
      })
      .catch(() => toast.error('Failed to complete visit'));
  };

  const handleMarkNoShow = (patient: QueuePatient) => {
    if (!patient.visitId) {
      toast.error('Visit ID not available for this queue item');
      return;
    }
    visitsApi
      .markNoShow(patient.visitId)
      .then(() => {
        toast.info(`${patient.patientName} marked as no-show`);
        loadQueueData();
      })
      .catch(() => toast.error('Failed to mark no-show'));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Waiting</Badge>;
      case 'in-consultation':
        return <Badge className="bg-blue-100 text-blue-800"><Activity className="h-3 w-3 mr-1" />In Consultation</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'no-show':
        return <Badge className="bg-red-100 text-red-800"><UserX className="h-3 w-3 mr-1" />No Show</Badge>;
      case 'emergency':
        return <Badge className="bg-red-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />EMERGENCY</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return <Badge variant="destructive">Emergency</Badge>;
      case 'urgent':
        return <Badge className="bg-orange-100 text-orange-800">Urgent</Badge>;
      case 'routine':
        return <Badge variant="secondary">Routine</Badge>;
      default:
        return null;
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesDepartment = selectedDepartment === 'all' || patient.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'all' || patient.status === selectedStatus;
    const matchesSearch = patient.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDepartment && matchesStatus && matchesSearch;
  });

  const totalStats = {
    waiting: patients.filter(p => p.status === 'waiting').length,
    inConsultation: patients.filter(p => p.status === 'in-consultation').length,
    completed: patients.filter(p => p.status === 'completed').length,
    emergency: patients.filter(p => p.priority === 'emergency').length,
    averageWaitTime: patients.length > 0 
      ? Math.round(patients.reduce((sum, p) => sum + (p.waitTime || 0), 0) / patients.length)
      : 0
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground mt-1">
            Real-time patient queue monitoring and workflow management
          </p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Walk-in Patient
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Waiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStats.waiting}</div>
            <p className="text-xs text-muted-foreground mt-1">patients in queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              In Consultation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStats.inConsultation}</div>
            <p className="text-xs text-muted-foreground mt-1">active consultations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Emergency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{totalStats.emergency}</div>
            <p className="text-xs text-muted-foreground mt-1">urgent cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4 text-purple-500" />
              Avg Wait Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStats.averageWaitTime}</div>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
          </CardContent>
        </Card>
      </div>

      {/* Department Queues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Department Queues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {departmentQueues.map(dept => (
              <div key={dept.department} className="p-4 border rounded-lg">
                <h4 className="font-medium text-sm mb-2">{dept.department}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waiting:</span>
                    <span className="font-medium text-yellow-600">{dept.waiting}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active:</span>
                    <span className="font-medium text-blue-600">{dept.inConsultation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Wait:</span>
                    <span className="font-medium">{dept.averageWaitTime}m</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by patient name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="General Ophthalmology">General Ophthalmology</SelectItem>
            <SelectItem value="Retina Clinic">Retina Clinic</SelectItem>
            <SelectItem value="Glaucoma Clinic">Glaucoma Clinic</SelectItem>
            <SelectItem value="Cataract Clinic">Cataract Clinic</SelectItem>
            <SelectItem value="Emergency">Emergency</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="in-consultation">In Consultation</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Queue List */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Queue ({filteredPatients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No patients in queue</p>
              </div>
            ) : (
              filteredPatients.map(patient => (
                <Card 
                  key={patient.id} 
                  className={`border-l-4 ${
                    patient.priority === 'emergency' ? 'border-red-500' :
                    patient.priority === 'urgent' ? 'border-orange-500' :
                    'border-blue-500'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-center min-w-[60px]">
                          <div className="text-2xl font-bold">
                            {patient.queueNumber === 999 ? 'ER' : patient.queueNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">Queue #</div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{patient.patientName}</h4>
                            {getStatusBadge(patient.status)}
                            {getPriorityBadge(patient.priority)}
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Token:</span> {patient.tokenNumber || '—'}
                            </div>
                            <div>
                              <span className="font-medium">Time:</span> {patient.appointmentTime}
                            </div>
                            <div>
                              <span className="font-medium">Doctor:</span> {patient.doctor}
                            </div>
                            <div>
                              <span className="font-medium">Wait:</span>{' '}
                              <span className={patient.waitTime && patient.waitTime > 20 ? 'text-red-600 font-medium' : ''}>
                                {patient.waitTime}m
                              </span>
                            </div>
                          </div>
                          {patient.chiefComplaint && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium">Complaint:</span> {patient.chiefComplaint}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {patient.status === 'waiting' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleStartConsultation(patient)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkNoShow(patient)}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              No Show
                            </Button>
                          </>
                        )}
                        {patient.status === 'in-consultation' && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteConsultation(patient)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Details Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Queue #{selectedPatient?.queueNumber} - {selectedPatient?.patientName}
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Token</Label>
                  <p className="font-medium">{selectedPatient.tokenNumber || '—'}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>
                <div>
                  <Label>Age / Gender</Label>
                  <p className="font-medium">{selectedPatient.age} years / {selectedPatient.gender}</p>
                </div>
                <div>
                  <Label>Department</Label>
                  <p className="font-medium">{selectedPatient.department}</p>
                </div>
                <div>
                  <Label>Doctor</Label>
                  <p className="font-medium">{selectedPatient.doctor}</p>
                </div>
                <div>
                  <Label>Appointment Time</Label>
                  <p className="font-medium">{selectedPatient.appointmentTime}</p>
                </div>
              </div>
              
              {selectedPatient.chiefComplaint && (
                <div>
                  <Label>Chief Complaint</Label>
                  <p className="mt-1">{selectedPatient.chiefComplaint}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Checked In</Label>
                  <p className="font-medium">
                    {selectedPatient.checkedInAt 
                      ? new Date(selectedPatient.checkedInAt).toLocaleTimeString() 
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label>Consultation Started</Label>
                  <p className="font-medium">
                    {selectedPatient.consultationStartedAt 
                      ? new Date(selectedPatient.consultationStartedAt).toLocaleTimeString() 
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label>Completed</Label>
                  <p className="font-medium">
                    {selectedPatient.completedAt 
                      ? new Date(selectedPatient.completedAt).toLocaleTimeString() 
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedPatient.status === 'waiting' && (
                  <Button onClick={() => {
                    handleStartConsultation(selectedPatient);
                    setSelectedPatient(null);
                  }}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Consultation
                  </Button>
                )}
                {selectedPatient.status === 'in-consultation' && (
                  <Button onClick={() => {
                    handleCompleteConsultation(selectedPatient);
                    setSelectedPatient(null);
                  }}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Consultation
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedPatient(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

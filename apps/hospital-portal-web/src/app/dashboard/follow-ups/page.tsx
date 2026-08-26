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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Bell,
  User,
  Eye,
  Pill,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Filter,
  Plus,
  X,
  ChevronRight,
  Users,
  Activity,
  CalendarDays,
  Stethoscope
} from 'lucide-react';
import { toast } from '@/lib/toast';

// Types
interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  followUpType: 'Post-Surgery' | 'Chronic-Care' | 'Treatment-Review' | 'Screening' | 'Emergency';
  relatedProcedure?: string;
  procedureDate?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled' | 'overdue';
  priority: 'routine' | 'important' | 'urgent';
  assignedDoctor: string;
  department: string;
  notes?: string;
  remindersSent: number;
  lastReminderDate?: string;
  completedDate?: string;
  outcome?: string;
}

interface PostOpCareItem {
  id: string;
  patientId: string;
  patientName: string;
  surgeryType: string;
  surgeryDate: string;
  surgeryEye: 'OD' | 'OS' | 'OU';
  surgeon: string;
  careSchedule: {
    visitName: string;
    scheduledDate: string;
    completed: boolean;
    completedDate?: string;
    findings?: string;
    visualAcuity?: string;
    iop?: number;
    complications?: string[];
  }[];
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate: string;
    adherence: 'good' | 'moderate' | 'poor' | 'unknown';
    lastRefillDate?: string;
  }[];
  instructions: string[];
  restrictions: string[];
}

interface TreatmentAdherence {
  patientId: string;
  patientName: string;
  condition: string;
  treatmentPlan: string;
  startDate: string;
  medications: {
    name: string;
    prescribed: boolean;
    adherence: number; // 0-100%
    missedDoses: number;
    lastTaken?: string;
  }[];
  appointments: {
    scheduled: number;
    completed: number;
    missed: number;
    adherenceRate: number;
  };
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

interface Reminder {
  id: string;
  patientId: string;
  patientName: string;
  type: 'appointment' | 'medication' | 'test' | 'follow-up' | 'screening';
  message: string;
  scheduledDate: string;
  channels: ('sms' | 'email' | 'phone')[];
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  sentDate?: string;
  acknowledged?: boolean;
}

export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'post-op' | 'adherence' | 'reminders'>('dashboard');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [postOpCare, setPostOpCare] = useState<PostOpCareItem[]>([]);
  const [adherenceData, setAdherenceData] = useState<TreatmentAdherence[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFollowUps(),
        loadPostOpCare(),
        loadAdherenceData(),
        loadReminders()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowUps = async () => {
    // Mock data - replace with API call
    const mockFollowUps: FollowUp[] = [
      {
        id: 'FU-001',
        patientId: 'P-001',
        patientName: 'John Smith',
        patientMRN: 'MRN-12345',
        followUpType: 'Post-Surgery',
        relatedProcedure: 'Cataract Surgery OD',
        procedureDate: '2026-01-20',
        scheduledDate: '2026-01-29',
        scheduledTime: '09:00',
        status: 'overdue',
        priority: 'urgent',
        assignedDoctor: 'Dr. Sarah Johnson',
        department: 'Cataract',
        notes: 'Day 1 post-op check - IOP measurement critical',
        remindersSent: 2,
        lastReminderDate: '2026-01-28'
      },
      {
        id: 'FU-002',
        patientId: 'P-045',
        patientName: 'Maria Garcia',
        patientMRN: 'MRN-67890',
        followUpType: 'Chronic-Care',
        scheduledDate: '2026-01-30',
        scheduledTime: '14:00',
        status: 'scheduled',
        priority: 'important',
        assignedDoctor: 'Dr. Emily Rodriguez',
        department: 'Glaucoma',
        notes: '3-month IOP check, medication review',
        remindersSent: 1,
        lastReminderDate: '2026-01-27'
      },
      {
        id: 'FU-003',
        patientId: 'P-078',
        patientName: 'Robert Chen',
        patientMRN: 'MRN-45678',
        followUpType: 'Screening',
        scheduledDate: '2026-02-05',
        scheduledTime: '10:30',
        status: 'scheduled',
        priority: 'routine',
        assignedDoctor: 'Dr. Michael Chen',
        department: 'Retina',
        notes: 'Annual diabetic retinopathy screening',
        remindersSent: 0
      },
      {
        id: 'FU-004',
        patientId: 'P-112',
        patientName: 'Sarah Williams',
        patientMRN: 'MRN-98765',
        followUpType: 'Post-Surgery',
        relatedProcedure: 'Vitrectomy OS',
        procedureDate: '2026-01-15',
        scheduledDate: '2026-01-22',
        scheduledTime: '11:00',
        status: 'completed',
        priority: 'important',
        assignedDoctor: 'Dr. Michael Chen',
        department: 'Retina',
        completedDate: '2026-01-22',
        outcome: 'Healing well, no complications. VA improving.'
      },
      {
        id: 'FU-005',
        patientId: 'P-089',
        patientName: 'David Lee',
        patientMRN: 'MRN-24680',
        followUpType: 'Treatment-Review',
        scheduledDate: '2026-01-25',
        scheduledTime: '15:30',
        status: 'missed',
        priority: 'important',
        assignedDoctor: 'Dr. Michael Chen',
        department: 'Retina',
        notes: 'Anti-VEGF injection series follow-up',
        remindersSent: 3,
        lastReminderDate: '2026-01-24'
      }
    ];
    setFollowUps(mockFollowUps);
  };

  const loadPostOpCare = async () => {
    const mockPostOp: PostOpCareItem[] = [
      {
        id: 'POC-001',
        patientId: 'P-001',
        patientName: 'John Smith',
        surgeryType: 'Cataract Surgery (Phacoemulsification)',
        surgeryDate: '2026-01-20',
        surgeryEye: 'OD',
        surgeon: 'Dr. Sarah Johnson',
        careSchedule: [
          {
            visitName: 'Day 1 Post-Op',
            scheduledDate: '2026-01-21',
            completed: false,
            visualAcuity: undefined,
            iop: undefined
          },
          {
            visitName: '1 Week Post-Op',
            scheduledDate: '2026-01-27',
            completed: false
          },
          {
            visitName: '1 Month Post-Op',
            scheduledDate: '2026-02-20',
            completed: false
          },
          {
            visitName: '3 Months Post-Op',
            scheduledDate: '2026-04-20',
            completed: false
          }
        ],
        medications: [
          {
            name: 'Prednisolone 1% Eye Drops',
            dosage: '1 drop',
            frequency: '4 times daily',
            startDate: '2026-01-20',
            endDate: '2026-02-03',
            adherence: 'good',
            lastRefillDate: '2026-01-20'
          },
          {
            name: 'Moxifloxacin 0.5% Eye Drops',
            dosage: '1 drop',
            frequency: '4 times daily',
            startDate: '2026-01-20',
            endDate: '2026-01-27',
            adherence: 'good',
            lastRefillDate: '2026-01-20'
          }
        ],
        instructions: [
          'Use prescribed eye drops as directed',
          'Avoid rubbing the operated eye',
          'Wear eye shield at night for 1 week',
          'Avoid heavy lifting (>10 kg) for 2 weeks',
          'No swimming for 2 weeks'
        ],
        restrictions: [
          'No water in eye for 1 week',
          'No eye makeup for 2 weeks',
          'No driving until cleared by doctor',
          'Avoid dusty environments'
        ]
      },
      {
        id: 'POC-002',
        patientId: 'P-112',
        patientName: 'Sarah Williams',
        surgeryType: 'Pars Plana Vitrectomy',
        surgeryDate: '2026-01-15',
        surgeryEye: 'OS',
        surgeon: 'Dr. Michael Chen',
        careSchedule: [
          {
            visitName: 'Day 1 Post-Op',
            scheduledDate: '2026-01-16',
            completed: true,
            completedDate: '2026-01-16',
            findings: 'Anterior chamber quiet, IOP normal',
            visualAcuity: 'CF @ 2 ft',
            iop: 14
          },
          {
            visitName: '1 Week Post-Op',
            scheduledDate: '2026-01-22',
            completed: true,
            completedDate: '2026-01-22',
            findings: 'Retina attached, gas bubble decreasing',
            visualAcuity: '20/200',
            iop: 16
          },
          {
            visitName: '2 Weeks Post-Op',
            scheduledDate: '2026-01-29',
            completed: false
          },
          {
            visitName: '1 Month Post-Op',
            scheduledDate: '2026-02-15',
            completed: false
          }
        ],
        medications: [
          {
            name: 'Prednisolone 1% Eye Drops',
            dosage: '1 drop',
            frequency: '4 times daily, tapering',
            startDate: '2026-01-15',
            endDate: '2026-02-15',
            adherence: 'good',
            lastRefillDate: '2026-01-15'
          },
          {
            name: 'Atropine 1% Eye Drops',
            dosage: '1 drop',
            frequency: 'Twice daily',
            startDate: '2026-01-15',
            endDate: '2026-01-29',
            adherence: 'good'
          }
        ],
        instructions: [
          'Maintain face-down positioning for 7 days',
          'Use prescribed eye drops as directed',
          'Avoid air travel until gas bubble resolves',
          'Sleep with head elevated'
        ],
        restrictions: [
          'Strict face-down positioning',
          'No air travel',
          'No heavy lifting',
          'No bending below waist'
        ]
      }
    ];
    setPostOpCare(mockPostOp);
  };

  const loadAdherenceData = async () => {
    const mockAdherence: TreatmentAdherence[] = [
      {
        patientId: 'P-045',
        patientName: 'Maria Garcia',
        condition: 'Primary Open-Angle Glaucoma',
        treatmentPlan: 'Medical Management with IOP monitoring',
        startDate: '2025-10-15',
        medications: [
          {
            name: 'Latanoprost 0.005% Eye Drops',
            prescribed: true,
            adherence: 92,
            missedDoses: 3,
            lastTaken: '2026-01-27'
          },
          {
            name: 'Timolol 0.5% Eye Drops',
            prescribed: true,
            adherence: 85,
            missedDoses: 6,
            lastTaken: '2026-01-27'
          }
        ],
        appointments: {
          scheduled: 4,
          completed: 3,
          missed: 1,
          adherenceRate: 75
        },
        recommendations: [
          'Consider simplifying medication regimen',
          'Review drop instillation technique',
          'Set daily medication reminders'
        ],
        riskLevel: 'medium'
      },
      {
        patientId: 'P-089',
        patientName: 'David Lee',
        condition: 'Diabetic Macular Edema',
        treatmentPlan: 'Anti-VEGF Injection Series',
        startDate: '2025-11-01',
        medications: [
          {
            name: 'Ranibizumab Intravitreal Injection',
            prescribed: true,
            adherence: 67,
            missedDoses: 2,
            lastTaken: '2025-12-15'
          }
        ],
        appointments: {
          scheduled: 6,
          completed: 4,
          missed: 2,
          adherenceRate: 67
        },
        recommendations: [
          'High priority: Schedule missed injections',
          'Risk of vision loss if treatment delayed',
          'Coordinate with diabetes care team',
          'Discuss transportation assistance'
        ],
        riskLevel: 'high'
      },
      {
        patientId: 'P-078',
        patientName: 'Robert Chen',
        condition: 'Diabetic Retinopathy',
        treatmentPlan: 'Annual Screening Protocol',
        startDate: '2024-02-10',
        medications: [],
        appointments: {
          scheduled: 2,
          completed: 2,
          missed: 0,
          adherenceRate: 100
        },
        recommendations: [
          'Excellent compliance',
          'Continue annual screening',
          'Maintain good glycemic control'
        ],
        riskLevel: 'low'
      }
    ];
    setAdherenceData(mockAdherence);
  };

  const loadReminders = async () => {
    const mockReminders: Reminder[] = [
      {
        id: 'REM-001',
        patientId: 'P-001',
        patientName: 'John Smith',
        type: 'follow-up',
        message: 'URGENT: Day 1 post-cataract surgery follow-up tomorrow at 9:00 AM',
        scheduledDate: '2026-01-28',
        channels: ['sms', 'phone'],
        status: 'sent',
        sentDate: '2026-01-28 08:00',
        acknowledged: false
      },
      {
        id: 'REM-002',
        patientId: 'P-045',
        patientName: 'Maria Garcia',
        type: 'medication',
        message: 'Reminder: Time for your evening glaucoma eye drops',
        scheduledDate: '2026-01-28',
        channels: ['sms'],
        status: 'sent',
        sentDate: '2026-01-28 20:00',
        acknowledged: true
      },
      {
        id: 'REM-003',
        patientId: 'P-078',
        patientName: 'Robert Chen',
        type: 'screening',
        message: 'Annual diabetic retinopathy screening scheduled for Feb 5 at 10:30 AM',
        scheduledDate: '2026-02-04',
        channels: ['email', 'sms'],
        status: 'pending'
      },
      {
        id: 'REM-004',
        patientId: 'P-089',
        patientName: 'David Lee',
        type: 'appointment',
        message: 'You missed your anti-VEGF injection appointment. Please reschedule immediately.',
        scheduledDate: '2026-01-26',
        channels: ['sms', 'phone'],
        status: 'sent',
        sentDate: '2026-01-26 10:00',
        acknowledged: false
      }
    ];
    setReminders(mockReminders);
  };

  const getDashboardStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = followUps.filter(f => f.status === 'overdue').length;
    const upcomingCount = followUps.filter(f => f.status === 'scheduled' && f.scheduledDate >= today).length;
    const missedCount = followUps.filter(f => f.status === 'missed').length;
    const activePostOpCount = postOpCare.filter(p => 
      p.careSchedule.some(cs => !cs.completed)
    ).length;
    const highRiskAdherenceCount = adherenceData.filter(a => a.riskLevel === 'high').length;
    const pendingRemindersCount = reminders.filter(r => r.status === 'pending').length;

    return {
      overdueCount,
      upcomingCount,
      missedCount,
      activePostOpCount,
      highRiskAdherenceCount,
      pendingRemindersCount
    };
  };

  const stats = getDashboardStats();

  const handleSendReminder = async (followUpId: string, channels: ('sms' | 'email' | 'phone')[]) => {
    try {
      // API call would go here
      toast.success(`Reminder sent via ${channels.join(', ')}`);
      loadFollowUps();
    } catch (error) {
      toast.error('Failed to send reminder');
    }
  };

  const handleMarkCompleted = async (followUpId: string) => {
    try {
      // API call would go here
      toast.success('Follow-up marked as completed');
      loadFollowUps();
    } catch (error) {
      toast.error('Failed to update follow-up');
    }
  };

  const handleReschedule = async (followUpId: string, newDate: string, newTime: string) => {
    try {
      // API call would go here
      toast.success('Follow-up rescheduled');
      loadFollowUps();
    } catch (error) {
      toast.error('Failed to reschedule');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      missed: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      routine: 'bg-gray-100 text-gray-700',
      important: 'bg-yellow-100 text-yellow-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return variants[priority] || 'bg-gray-100 text-gray-700';
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return variants[risk] || 'bg-gray-100 text-gray-800';
  };

  const filteredFollowUps = followUps.filter(fu => {
    const matchesSearch = fu.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         fu.patientMRN.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || fu.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || fu.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Follow-up Management</h1>
          <p className="text-gray-600 mt-1">Post-operative care, treatment adherence, and automated reminders</p>
        </div>
        <Button onClick={() => setShowFollowUpDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Follow-up
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">
            <Activity className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarDays className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="post-op">
            <Stethoscope className="w-4 h-4 mr-2" />
            Post-Op Care
          </TabsTrigger>
          <TabsTrigger value="adherence">
            <Pill className="w-4 h-4 mr-2" />
            Adherence
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="w-4 h-4 mr-2" />
            Reminders
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-l-4 border-red-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-3xl font-bold text-red-600">{stats.overdueCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Upcoming</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.upcomingCount}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Missed</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.missedCount}</p>
                  </div>
                  <X className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Post-Op</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.activePostOpCount}</p>
                  </div>
                  <Eye className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-yellow-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">High Risk</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.highRiskAdherenceCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Alerts</p>
                    <p className="text-3xl font-bold text-green-600">{stats.pendingRemindersCount}</p>
                  </div>
                  <Bell className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Critical Alerts */}
          <Card className="border-l-4 border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Critical Follow-ups (Overdue)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followUps.filter(f => f.status === 'overdue').length === 0 ? (
                <p className="text-center text-gray-500 py-4">No overdue follow-ups</p>
              ) : (
                <div className="space-y-3">
                  {followUps.filter(f => f.status === 'overdue').map(fu => (
                    <div key={fu.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-red-900">{fu.patientName}</h4>
                            <Badge className={getPriorityBadge(fu.priority)}>{fu.priority}</Badge>
                          </div>
                          <p className="text-sm text-red-800 mb-1">{fu.followUpType}</p>
                          {fu.relatedProcedure && (
                            <p className="text-sm text-red-700 mb-1">After: {fu.relatedProcedure}</p>
                          )}
                          <p className="text-sm text-red-600">
                            Scheduled: {new Date(fu.scheduledDate).toLocaleDateString()} at {fu.scheduledTime}
                          </p>
                          <p className="text-sm text-red-600">Reminders sent: {fu.remindersSent}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => handleSendReminder(fu.id, ['phone'])}>
                            <Phone className="w-3 h-3 mr-1" />
                            Call
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedFollowUp(fu)}>
                            Reschedule
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* High-Risk Adherence */}
          <Card className="border-l-4 border-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                High-Risk Adherence Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adherenceData.filter(a => a.riskLevel === 'high').length === 0 ? (
                <p className="text-center text-gray-500 py-4">No high-risk patients</p>
              ) : (
                <div className="space-y-3">
                  {adherenceData.filter(a => a.riskLevel === 'high').map(patient => (
                    <div key={patient.patientId} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-yellow-900">{patient.patientName}</h4>
                          <p className="text-sm text-yellow-800">{patient.condition}</p>
                        </div>
                        <Badge className={getRiskBadge(patient.riskLevel)}>High Risk</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="text-yellow-800">
                          Appointment Adherence: {patient.appointments.adherenceRate}% 
                          ({patient.appointments.completed}/{patient.appointments.scheduled})
                        </p>
                        <div className="bg-white p-3 rounded border border-yellow-300">
                          <p className="font-medium text-yellow-900 mb-1">Recommendations:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {patient.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-yellow-800">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by patient name or MRN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Follow-ups List */}
          <div className="space-y-3">
            {filteredFollowUps.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CalendarDays className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No follow-ups found</p>
                </CardContent>
              </Card>
            ) : (
              filteredFollowUps.map(fu => (
                <Card key={fu.id} className={fu.status === 'overdue' ? 'border-red-300 bg-red-50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{fu.patientName}</h3>
                          <Badge variant="outline">{fu.patientMRN}</Badge>
                          <Badge className={getStatusBadge(fu.status)}>{fu.status}</Badge>
                          <Badge className={getPriorityBadge(fu.priority)}>{fu.priority}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Type: <span className="font-medium text-gray-900">{fu.followUpType}</span></p>
                            {fu.relatedProcedure && (
                              <p className="text-gray-600">Related: <span className="font-medium text-gray-900">{fu.relatedProcedure}</span></p>
                            )}
                          </div>
                          <div>
                            <p className="text-gray-600">Date: <span className="font-medium text-gray-900">{new Date(fu.scheduledDate).toLocaleDateString()}</span></p>
                            <p className="text-gray-600">Time: <span className="font-medium text-gray-900">{fu.scheduledTime}</span></p>
                          </div>
                          <div>
                            <p className="text-gray-600">Doctor: <span className="font-medium text-gray-900">{fu.assignedDoctor}</span></p>
                            <p className="text-gray-600">Department: <span className="font-medium text-gray-900">{fu.department}</span></p>
                          </div>
                          <div>
                            <p className="text-gray-600">Reminders Sent: <span className="font-medium text-gray-900">{fu.remindersSent}</span></p>
                            {fu.lastReminderDate && (
                              <p className="text-gray-600">Last: <span className="font-medium text-gray-900">{new Date(fu.lastReminderDate).toLocaleDateString()}</span></p>
                            )}
                          </div>
                        </div>
                        {fu.notes && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-900">{fu.notes}</p>
                          </div>
                        )}
                        {fu.status === 'completed' && fu.outcome && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-medium text-green-900">Outcome:</p>
                            <p className="text-sm text-green-800">{fu.outcome}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {fu.status === 'scheduled' || fu.status === 'overdue' ? (
                          <>
                            <Button size="sm" onClick={() => handleMarkCompleted(fu.id)}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Complete
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendReminder(fu.id, ['sms'])}>
                              <MessageSquare className="w-3 h-3 mr-1" />
                              SMS
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendReminder(fu.id, ['email'])}>
                              <Mail className="w-3 h-3 mr-1" />
                              Email
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendReminder(fu.id, ['phone'])}>
                              <Phone className="w-3 h-3 mr-1" />
                              Call
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Post-Op Care Tab */}
        <TabsContent value="post-op" className="space-y-4">
          {postOpCare.map(patient => (
            <Card key={patient.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{patient.patientName}</CardTitle>
                    <CardDescription>
                      {patient.surgeryType} ({patient.surgeryEye}) - {new Date(patient.surgeryDate).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Surgeon: {patient.surgeon}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Care Schedule */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Post-Operative Visit Schedule
                  </h4>
                  <div className="space-y-2">
                    {patient.careSchedule.map((visit, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          visit.completed
                            ? 'bg-green-50 border-green-200'
                            : new Date(visit.scheduledDate) < new Date()
                            ? 'bg-red-50 border-red-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-medium">{visit.visitName}</h5>
                              {visit.completed ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Clock className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              Scheduled: {new Date(visit.scheduledDate).toLocaleDateString()}
                            </p>
                            {visit.completed && visit.completedDate && (
                              <p className="text-sm text-gray-600">
                                Completed: {new Date(visit.completedDate).toLocaleDateString()}
                              </p>
                            )}
                            {visit.findings && (
                              <p className="text-sm mt-2"><strong>Findings:</strong> {visit.findings}</p>
                            )}
                            {visit.visualAcuity && (
                              <p className="text-sm"><strong>VA:</strong> {visit.visualAcuity}</p>
                            )}
                            {visit.iop !== undefined && (
                              <p className="text-sm"><strong>IOP:</strong> {visit.iop} mmHg</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medications */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Post-Operative Medications
                  </h4>
                  <div className="space-y-2">
                    {patient.medications.map((med, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium">{med.name}</h5>
                            <p className="text-sm text-gray-600">{med.dosage} - {med.frequency}</p>
                            <p className="text-sm text-gray-600">
                              Duration: {new Date(med.startDate).toLocaleDateString()} to {new Date(med.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={med.adherence === 'good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {med.adherence}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions & Restrictions */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4" />
                      Post-Op Instructions
                    </h4>
                    <ul className="space-y-2">
                      {patient.instructions.map((instruction, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{instruction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Restrictions
                    </h4>
                    <ul className="space-y-2">
                      {patient.restrictions.map((restriction, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <span>{restriction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Adherence Tab */}
        <TabsContent value="adherence" className="space-y-4">
          {adherenceData.map(patient => (
            <Card key={patient.patientId} className={
              patient.riskLevel === 'high' ? 'border-l-4 border-red-500' :
              patient.riskLevel === 'medium' ? 'border-l-4 border-yellow-500' :
              'border-l-4 border-green-500'
            }>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{patient.patientName}</CardTitle>
                    <CardDescription>{patient.condition}</CardDescription>
                  </div>
                  <Badge className={getRiskBadge(patient.riskLevel)}>{patient.riskLevel} risk</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Medication Adherence */}
                {patient.medications.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Medication Adherence</h4>
                    <div className="space-y-3">
                      {patient.medications.map((med, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium">{med.name}</h5>
                            <Badge>{med.adherence}%</Badge>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div
                              className={`h-2 rounded-full ${
                                med.adherence >= 90 ? 'bg-green-500' :
                                med.adherence >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${med.adherence}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Missed doses: {med.missedDoses}</span>
                            {med.lastTaken && <span>Last taken: {new Date(med.lastTaken).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointment Adherence */}
                <div>
                  <h4 className="font-semibold mb-3">Appointment Adherence</h4>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{patient.appointments.scheduled}</p>
                        <p className="text-sm text-gray-600">Scheduled</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{patient.appointments.completed}</p>
                        <p className="text-sm text-gray-600">Completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{patient.appointments.missed}</p>
                        <p className="text-sm text-gray-600">Missed</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          patient.appointments.adherenceRate >= 90 ? 'bg-green-500' :
                          patient.appointments.adherenceRate >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${patient.appointments.adherenceRate}%` }}
                      ></div>
                    </div>
                    <p className="text-center mt-2 text-sm font-medium">
                      Adherence Rate: {patient.appointments.adherenceRate}%
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                {patient.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Recommendations</h4>
                    <div className={`p-4 rounded-lg border ${
                      patient.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
                      patient.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <ul className="space-y-2">
                        {patient.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automated Reminders</CardTitle>
              <CardDescription>SMS, Email, and Phone reminders for appointments and medications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reminders.map(reminder => (
                  <div
                    key={reminder.id}
                    className={`p-4 rounded-lg border ${
                      reminder.status === 'failed' ? 'bg-red-50 border-red-200' :
                      reminder.status === 'sent' ? 'bg-green-50 border-green-200' :
                      'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{reminder.patientName}</h4>
                          <Badge variant="outline">{reminder.type}</Badge>
                          <Badge className={
                            reminder.status === 'sent' ? 'bg-green-100 text-green-800' :
                            reminder.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }>
                            {reminder.status}
                          </Badge>
                          {reminder.acknowledged && (
                            <Badge className="bg-purple-100 text-purple-800">Acknowledged</Badge>
                          )}
                        </div>
                        <p className="text-sm mb-2">{reminder.message}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Scheduled: {new Date(reminder.scheduledDate).toLocaleDateString()}</span>
                          {reminder.sentDate && (
                            <span>Sent: {reminder.sentDate}</span>
                          )}
                          <div className="flex items-center gap-1">
                            {reminder.channels.includes('sms') && <MessageSquare className="w-3 h-3" />}
                            {reminder.channels.includes('email') && <Mail className="w-3 h-3" />}
                            {reminder.channels.includes('phone') && <Phone className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

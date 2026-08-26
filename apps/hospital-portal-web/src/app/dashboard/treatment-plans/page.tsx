'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Plus,
  Eye,
  Activity,
  Target,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Pill,
  Scissors,
  Users,
  Download,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface TreatmentPlan {
  id: string;
  patientId: string;
  patientName: string;
  diagnosis: string;
  planType: 'Cataract Surgery' | 'Glaucoma Management' | 'Diabetic Retinopathy' | 'Corneal Disease' | 'Retinal Disease' | 'Custom';
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
  startDate: string;
  targetCompletionDate: string;
  createdBy: string;
  goals: TreatmentGoal[];
  milestones: Milestone[];
  medications: Medication[];
  procedures: Procedure[];
  followUps: FollowUp[];
  progress: number; // 0-100
  notes: string;
}

interface TreatmentGoal {
  id: string;
  description: string;
  target: string;
  achieved: boolean;
  achievedDate?: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  completedDate?: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: 'active' | 'completed' | 'discontinued';
}

interface Procedure {
  id: string;
  name: string;
  scheduledDate: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  surgeon?: string;
  notes?: string;
}

interface FollowUp {
  id: string;
  date: string;
  type: string;
  notes?: string;
  completed: boolean;
}

const treatmentPlanTemplates = {
  'Cataract Surgery': {
    goals: [
      { description: 'Restore visual acuity to 6/9 or better', target: '6/9+' },
      { description: 'Achieve target refraction within 0.5D', target: '±0.5D' },
      { description: 'No post-operative complications', target: '0 complications' }
    ],
    milestones: [
      { title: 'Pre-operative Assessment', description: 'Complete eye examination, biometry, IOL calculation', dueDate: '' },
      { title: 'Surgery Clearance', description: 'Medical clearance from physician', dueDate: '' },
      { title: 'Cataract Surgery', description: 'Phacoemulsification with IOL implantation', dueDate: '' },
      { title: 'Day 1 Post-op Review', description: 'Check IOP, corneal clarity, IOL position', dueDate: '' },
      { title: '1 Week Post-op', description: 'Assess visual acuity, refraction', dueDate: '' },
      { title: '4 Week Post-op', description: 'Final refraction, spectacle prescription', dueDate: '' }
    ],
    medications: [
      { name: 'Prednisolone 1%', dosage: '1 drop', frequency: '4 times daily', duration: '4 weeks tapering' },
      { name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: '4 times daily', duration: '1 week' }
    ]
  },
  'Glaucoma Management': {
    goals: [
      { description: 'Reduce IOP to target level (≤21 mmHg)', target: '≤21 mmHg' },
      { description: 'Prevent visual field progression', target: 'Stable MD' },
      { description: 'Maintain RNFL thickness', target: 'No thinning >2μm/year' }
    ],
    milestones: [
      { title: 'Baseline Assessment', description: 'IOP, visual field, OCT RNFL', dueDate: '' },
      { title: 'Initiate Medical Therapy', description: 'Start IOP-lowering drops', dueDate: '' },
      { title: '1 Month IOP Check', description: 'Assess response to medication', dueDate: '' },
      { title: '3 Month Reassessment', description: 'IOP, visual field, OCT comparison', dueDate: '' },
      { title: '6 Month Reassessment', description: 'Full glaucoma progression analysis', dueDate: '' }
    ],
    medications: [
      { name: 'Latanoprost 0.005%', dosage: '1 drop', frequency: 'Once daily at bedtime', duration: 'Ongoing' },
      { name: 'Timolol 0.5%', dosage: '1 drop', frequency: 'Twice daily', duration: 'Ongoing' }
    ]
  },
  'Diabetic Retinopathy': {
    goals: [
      { description: 'Prevent progression to PDR', target: 'No neovascularization' },
      { description: 'Resolve macular edema', target: 'CRT <250μm' },
      { description: 'Maintain visual acuity', target: 'VA ≥6/12' }
    ],
    milestones: [
      { title: 'Baseline Imaging', description: 'Fundus photography, OCT macula', dueDate: '' },
      { title: 'Anti-VEGF Injection #1', description: 'Intravitreal ranibizumab/bevacizumab', dueDate: '' },
      { title: 'Anti-VEGF Injection #2', description: '1 month after first injection', dueDate: '' },
      { title: 'Anti-VEGF Injection #3', description: '1 month after second injection', dueDate: '' },
      { title: 'Reassessment', description: 'OCT to assess treatment response', dueDate: '' },
      { title: 'Laser Photocoagulation', description: 'If persistent macular edema', dueDate: '' }
    ],
    medications: [
      { name: 'Ranibizumab 0.5mg', dosage: 'Intravitreal', frequency: 'Monthly loading', duration: '3 months' }
    ]
  }
};

export default function TreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<TreatmentPlan>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTreatmentPlans();
  }, []);

  const loadTreatmentPlans = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await treatmentPlanApi.getAll();
      
      // Mock data
      const mockPlans: TreatmentPlan[] = [
        {
          id: '1',
          patientId: 'PT-2024-0015',
          patientName: 'John Smith',
          diagnosis: 'Age-related cataract, both eyes',
          planType: 'Cataract Surgery',
          status: 'active',
          startDate: '2026-01-15',
          targetCompletionDate: '2026-03-15',
          createdBy: 'Dr. Michael Chen',
          progress: 45,
          goals: [
            { id: '1', description: 'Restore visual acuity to 6/9 or better', target: '6/9+', achieved: false },
            { id: '2', description: 'Achieve target refraction within 0.5D', target: '±0.5D', achieved: false },
            { id: '3', description: 'No post-operative complications', target: '0 complications', achieved: false }
          ],
          milestones: [
            { id: '1', title: 'Pre-operative Assessment', description: 'Complete eye examination, biometry, IOL calculation', dueDate: '2026-01-20', completed: true, completedDate: '2026-01-18' },
            { id: '2', title: 'Surgery Clearance', description: 'Medical clearance from physician', dueDate: '2026-01-25', completed: true, completedDate: '2026-01-22' },
            { id: '3', title: 'Cataract Surgery - OD', description: 'Phacoemulsification with IOL +22.0D', dueDate: '2026-02-01', completed: false }
          ],
          medications: [
            { id: '1', name: 'Prednisolone 1%', dosage: '1 drop', frequency: '4 times daily', duration: '4 weeks', status: 'active' },
            { id: '2', name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: '4 times daily', duration: '1 week', status: 'active' }
          ],
          procedures: [
            { id: '1', name: 'Phacoemulsification with IOL - OD', scheduledDate: '2026-02-01', status: 'scheduled', surgeon: 'Dr. Michael Chen' },
            { id: '2', name: 'Phacoemulsification with IOL - OS', scheduledDate: '2026-02-15', status: 'scheduled', surgeon: 'Dr. Michael Chen' }
          ],
          followUps: [
            { id: '1', date: '2026-02-02', type: 'Post-op Day 1', completed: false },
            { id: '2', date: '2026-02-08', type: '1 Week Post-op', completed: false }
          ],
          notes: 'Patient has diabetes - ensure tight glucose control pre-operatively'
        },
        {
          id: '2',
          patientId: 'PT-2024-0089',
          patientName: 'Lisa Anderson',
          diagnosis: 'Primary open-angle glaucoma, both eyes',
          planType: 'Glaucoma Management',
          status: 'active',
          startDate: '2025-11-01',
          targetCompletionDate: '2026-05-01',
          createdBy: 'Dr. James Wilson',
          progress: 60,
          goals: [
            { id: '1', description: 'Reduce IOP to target level (≤18 mmHg)', target: '≤18 mmHg', achieved: true, achievedDate: '2025-12-15' },
            { id: '2', description: 'Prevent visual field progression', target: 'Stable MD', achieved: false },
            { id: '3', description: 'Maintain RNFL thickness', target: 'No thinning >2μm/year', achieved: false }
          ],
          milestones: [
            { id: '1', title: 'Baseline Assessment', description: 'IOP, visual field, OCT RNFL', dueDate: '2025-11-05', completed: true, completedDate: '2025-11-03' },
            { id: '2', title: 'Initiate Medical Therapy', description: 'Started Latanoprost', dueDate: '2025-11-10', completed: true, completedDate: '2025-11-08' },
            { id: '3', title: '3 Month Reassessment', description: 'IOP response excellent', dueDate: '2026-02-01', completed: false }
          ],
          medications: [
            { id: '1', name: 'Latanoprost 0.005%', dosage: '1 drop', frequency: 'Once daily at bedtime', duration: 'Ongoing', status: 'active' },
            { id: '2', name: 'Timolol 0.5%', dosage: '1 drop', frequency: 'Twice daily', duration: 'Ongoing', status: 'active' }
          ],
          procedures: [],
          followUps: [
            { id: '1', date: '2026-02-01', type: '3 Month Follow-up', completed: false }
          ],
          notes: 'Target IOP: ≤18 mmHg. Current IOP well controlled on dual therapy.'
        }
      ];

      setPlans(mockPlans);
    } catch (error) {
      console.error('Failed to load treatment plans:', error);
      toast.error('Failed to load treatment plans');
    } finally {
      setLoading(false);
    }
  };

  const createPlan = () => {
    if (!newPlan.planType || !newPlan.patientName || !newPlan.diagnosis) {
      toast.error('Please fill in all required fields');
      return;
    }

    // TODO: API call to create plan
    toast.success('Treatment plan created successfully');
    setShowCreateDialog(false);
    setNewPlan({});
    loadTreatmentPlans();
  };

  const updateMilestone = (planId: string, milestoneId: string, completed: boolean) => {
    // TODO: API call to update milestone
    toast.success(completed ? 'Milestone marked as completed' : 'Milestone marked as incomplete');
    loadTreatmentPlans();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800"><Activity className="h-3 w-3 mr-1" />Active</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'on-hold':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />On Hold</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Treatment Plans & Care Pathways</h1>
          <p className="text-muted-foreground mt-1">
            Structured treatment protocols with progress tracking and outcome monitoring
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Treatment Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Treatment Plan</DialogTitle>
              <DialogDescription>
                Choose a template or create a custom treatment pathway
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="planType">Plan Type / Template</Label>
                <Select 
                  value={newPlan.planType} 
                  onValueChange={(value) => setNewPlan({ ...newPlan, planType: value as any })}
                >
                  <SelectTrigger id="planType">
                    <SelectValue placeholder="Select treatment plan type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cataract Surgery">Cataract Surgery Pathway</SelectItem>
                    <SelectItem value="Glaucoma Management">Glaucoma Management</SelectItem>
                    <SelectItem value="Diabetic Retinopathy">Diabetic Retinopathy Treatment</SelectItem>
                    <SelectItem value="Corneal Disease">Corneal Disease Management</SelectItem>
                    <SelectItem value="Retinal Disease">Retinal Disease Treatment</SelectItem>
                    <SelectItem value="Custom">Custom Care Pathway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="patientName">Patient Name</Label>
                <Input
                  id="patientName"
                  placeholder="Search or enter patient name"
                  value={newPlan.patientName || ''}
                  onChange={(e) => setNewPlan({ ...newPlan, patientName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="diagnosis">Primary Diagnosis</Label>
                <Input
                  id="diagnosis"
                  placeholder="e.g., Age-related cataract, bilateral"
                  value={newPlan.diagnosis || ''}
                  onChange={(e) => setNewPlan({ ...newPlan, diagnosis: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newPlan.startDate || ''}
                    onChange={(e) => setNewPlan({ ...newPlan, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="targetDate">Target Completion</Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={newPlan.targetCompletionDate || ''}
                    onChange={(e) => setNewPlan({ ...newPlan, targetCompletionDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={createPlan}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Plan
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Treatment Plans List */}
      <div className="grid gap-4">
        {plans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No treatment plans created yet</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          plans.map(plan => (
            <Card key={plan.id} className="border-l-4 border-blue-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{plan.patientName}</CardTitle>
                      {getStatusBadge(plan.status)}
                      <Badge variant="outline">{plan.planType}</Badge>
                    </div>
                    <CardDescription>
                      {plan.diagnosis} • Started {new Date(plan.startDate).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-muted-foreground">{plan.progress}%</span>
                  </div>
                  <Progress value={plan.progress} className="h-2" />
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Goals</div>
                    <div className="font-medium">
                      {plan.goals.filter(g => g.achieved).length}/{plan.goals.length} achieved
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Milestones</div>
                    <div className="font-medium">
                      {plan.milestones.filter(m => m.completed).length}/{plan.milestones.length} completed
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Procedures</div>
                    <div className="font-medium">{plan.procedures.length} scheduled</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target Date</div>
                    <div className="font-medium">
                      {new Date(plan.targetCompletionDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Next Milestone */}
                {plan.milestones.filter(m => !m.completed)[0] && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Next Milestone</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      {plan.milestones.filter(m => !m.completed)[0].title} - 
                      Due {new Date(plan.milestones.filter(m => !m.completed)[0].dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Plan Details Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{selectedPlan?.patientName} - Treatment Plan</DialogTitle>
                <DialogDescription>{selectedPlan?.diagnosis}</DialogDescription>
              </div>
              {selectedPlan && getStatusBadge(selectedPlan.status)}
            </div>
          </DialogHeader>

          {selectedPlan && (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="goals">Goals</TabsTrigger>
                <TabsTrigger value="milestones">Milestones</TabsTrigger>
                <TabsTrigger value="medications">Medications</TabsTrigger>
                <TabsTrigger value="procedures">Procedures</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plan Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Patient ID</Label>
                        <p className="font-medium">{selectedPlan.patientId}</p>
                      </div>
                      <div>
                        <Label>Plan Type</Label>
                        <p className="font-medium">{selectedPlan.planType}</p>
                      </div>
                      <div>
                        <Label>Created By</Label>
                        <p className="font-medium">{selectedPlan.createdBy}</p>
                      </div>
                      <div>
                        <Label>Start Date</Label>
                        <p className="font-medium">{new Date(selectedPlan.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {selectedPlan.notes && (
                      <div>
                        <Label>Clinical Notes</Label>
                        <p className="text-sm mt-1">{selectedPlan.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Progress Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={selectedPlan.progress} className="h-3 mb-4" />
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {selectedPlan.goals.filter(g => g.achieved).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Goals Achieved</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedPlan.milestones.filter(m => m.completed).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Milestones Completed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">
                          {selectedPlan.followUps.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Follow-ups Scheduled</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="goals" className="space-y-3">
                {selectedPlan.goals.map(goal => (
                  <Card key={goal.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {goal.achieved ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <Target className="h-5 w-5 text-gray-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={`font-medium ${goal.achieved ? 'line-through text-muted-foreground' : ''}`}>
                              {goal.description}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Target: {goal.target}</p>
                            {goal.achievedDate && (
                              <p className="text-sm text-green-600 mt-1">
                                Achieved on {new Date(goal.achievedDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {goal.achieved && (
                          <Badge className="bg-green-100 text-green-800">Achieved</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="milestones" className="space-y-3">
                {selectedPlan.milestones.map(milestone => (
                  <Card key={milestone.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={milestone.completed}
                          onCheckedChange={(checked) => 
                            updateMilestone(selectedPlan.id, milestone.id, checked as boolean)
                          }
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${milestone.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {milestone.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Due: {new Date(milestone.dueDate).toLocaleDateString()}
                            </span>
                            {milestone.completedDate && (
                              <span className="text-green-600">
                                Completed: {new Date(milestone.completedDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="medications" className="space-y-3">
                {selectedPlan.medications.map(med => (
                  <Card key={med.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Pill className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="font-medium">{med.name}</p>
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Dosage:</span> {med.dosage}
                              </div>
                              <div>
                                <span className="font-medium">Frequency:</span> {med.frequency}
                              </div>
                              <div>
                                <span className="font-medium">Duration:</span> {med.duration}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          className={
                            med.status === 'active' ? 'bg-green-100 text-green-800' :
                            med.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {med.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="procedures" className="space-y-3">
                {selectedPlan.procedures.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No procedures scheduled</p>
                ) : (
                  selectedPlan.procedures.map(proc => (
                    <Card key={proc.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Scissors className="h-5 w-5 text-purple-500 mt-0.5" />
                            <div>
                              <p className="font-medium">{proc.name}</p>
                              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                                <div>
                                  <span className="font-medium">Scheduled:</span>{' '}
                                  {new Date(proc.scheduledDate).toLocaleDateString()}
                                </div>
                                {proc.surgeon && (
                                  <div>
                                    <span className="font-medium">Surgeon:</span> {proc.surgeon}
                                  </div>
                                )}
                                {proc.notes && (
                                  <div>
                                    <span className="font-medium">Notes:</span> {proc.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge 
                            className={
                              proc.status === 'completed' ? 'bg-green-100 text-green-800' :
                              proc.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }
                          >
                            {proc.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, Calendar, User, Award,
  Clock, TrendingUp, FileText, Users
} from 'lucide-react';
import {
  onboardingApi, OnboardingWorkflowDto, ChecklistItemDto,
  AccessLevelProgress, AccessLevel, ChecklistItemStatus
} from '@/lib/api/onboarding.api';
import { getApi } from '@/lib/api';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { useChecklistDefaults } from '@/hooks/use-system-masters';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

export default function OnboardingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  const [workflow, setWorkflow] = useState<OnboardingWorkflowDto | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemDto[]>([]);
  const [accessProgress, setAccessProgress] = useState<AccessLevelProgress | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'access'>('overview');
  const { items: defaultChecklistItems } = useChecklistDefaults();

  useEffect(() => {
    loadData();
  }, [workflowId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workflowRes, checklistRes, accessRes, employeesRes] = await Promise.all([
        onboardingApi.getById(workflowId),
        onboardingApi.getChecklistItems(workflowId),
        onboardingApi.getAccessProgress(workflowId),
        getApi().get<Employee[]>('/employees')
      ]);

      setWorkflow(workflowRes.data);
      setChecklistItems(checklistRes.data);
      setAccessProgress(accessRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      alert('Failed to load onboarding workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteChecklistItem = async (itemId: string) => {
    const notes = prompt('Add completion notes (optional):');

    try {
      await onboardingApi.completeChecklistItem(workflowId, itemId, {
        notes: notes || undefined
      });
      alert('Checklist item completed!');
      loadData();
    } catch (error) {
      console.error('Failed to complete item:', error);
      alert('Failed to complete checklist item');
    }
  };

  const handleSkipChecklistItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to skip this item? Only non-required items can be skipped.')) return;

    try {
      await onboardingApi.skipChecklistItem(workflowId, itemId);
      alert('Checklist item skipped!');
      loadData();
    } catch (error) {
      console.error('Failed to skip item:', error);
      alert('Failed to skip checklist item. It may be required.');
    }
  };

  const handleAssignMentor = () => {
    if (employees.length === 0) return;
    // Show each employee as a confirmation option — pick the first one shown for simplicity
    // (original code used find() with confirm() which is a misuse; we confirm once with the first employee)
    const first = employees[0];
    showConfirmation({
      title: 'Assign Mentor',
      message: `Assign ${first.firstName} ${first.lastName} as mentor?`,
      variant: 'info',
      confirmText: 'Assign',
      onConfirm: async () => {
        try {
          await onboardingApi.assignMentor(workflowId, { mentorId: first.id });
          loadData();
        } catch (error) {
          console.error('Failed to assign mentor:', error);
        }
      },
    });
  };

  const handleGrantAccess = (level: AccessLevel) => {
    showConfirmation({
      title: 'Grant Access',
      message: `Grant ${level} access to this employee?`,
      variant: 'info',
      confirmText: 'Grant',
      onConfirm: async () => {
        try {
          await onboardingApi.grantAccess(workflowId, { accessLevel: level });
          loadData();
        } catch (error) {
          console.error('Failed to grant access:', error);
        }
      },
    });
  };

  const handleCancelWorkflow = () => {
    showConfirmation({
      title: 'Cancel Workflow',
      message: 'Are you sure you want to cancel this onboarding workflow?',
      variant: 'danger',
      confirmText: 'Cancel Workflow',
      onConfirm: async () => {
        try {
          await onboardingApi.cancel(workflowId);
          router.push('/dashboard/admin/onboarding');
        } catch (error) {
          console.error('Failed to cancel workflow:', error);
        }
      },
    });
  };

  if (loading || !workflow) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading workflow...</p>
        </div>
      </div>
    );
  }

  const completedItems = checklistItems.filter(i => i.status === ChecklistItemStatus.Completed).length;
  const totalItems = checklistItems.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfirmationComponent />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workflow.userName}</h1>
            <p className="text-gray-600 mt-1">{workflow.employeeName}</p>
          </div>
        </div>

        <button
          onClick={handleCancelWorkflow}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          <XCircle className="h-5 w-5" />
          Cancel Workflow
        </button>
      </div>

      {/* Progress Overview Card */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-blue-100 text-sm">Overall Progress</p>
            <p className="text-4xl font-bold mt-1">{workflow.progressPercentage}%</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Checklist Items</p>
            <p className="text-2xl font-bold mt-1">{completedItems} / {totalItems}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Access Level</p>
            <p className="text-2xl font-bold mt-1">{workflow.currentAccessLevel}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Status</p>
            <p className="text-2xl font-bold mt-1">{workflow.status}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'checklist'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Checklist ({completedItems}/{totalItems})
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'access'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Access Management
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workflow Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Workflow Information</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Employee</p>
                    <p className="font-medium text-gray-900">{workflow.employeeName || workflow.userName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-medium text-gray-900">{workflow.departmentName || 'Not assigned'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <p className="font-medium text-gray-900">{workflow.roleName || 'Not assigned'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Mentor</p>
                    <p className="font-medium text-gray-900">{workflow.mentorName || 'Not assigned'}</p>
                    {!workflow.mentorId && (
                      <button
                        onClick={handleAssignMentor}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Assign Mentor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-medium text-gray-900">{new Date(workflow.startDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {workflow.expectedCompletionDate && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Expected Completion</p>
                      <p className="font-medium text-gray-900">{new Date(workflow.expectedCompletionDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {workflow.actualCompletionDate && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Actual Completion</p>
                      <p className="font-medium text-gray-900">{new Date(workflow.actualCompletionDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Progress Breakdown</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Completion</span>
                <span className="font-medium">{workflow.progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all"
                  style={{ width: `${workflow.progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Tab */}
      {activeTab === 'checklist' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {checklistItems.length === 0 && defaultChecklistItems.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
              <p className="text-sm font-medium text-gray-700 mb-2">Default checklist template (master)</p>
              <ul className="flex flex-wrap gap-2">
                {defaultChecklistItems.map((item) => (
                  <li
                    key={item}
                    className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {checklistItems.map(item => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                      {item.itemDescription && (
                        <p className="text-sm text-gray-500">{item.itemDescription}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                      {item.itemType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Day {item.dayNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.isRequired ? (
                      <span className="text-red-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      item.status === ChecklistItemStatus.Completed ? 'bg-green-100 text-green-800' :
                      item.status === ChecklistItemStatus.Skipped ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {item.status === ChecklistItemStatus.Pending && (
                      <>
                        <button
                          onClick={() => handleCompleteChecklistItem(item.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <CheckCircle className="h-5 w-5 inline" />
                        </button>
                        {!item.isRequired && (
                          <button
                            onClick={() => handleSkipChecklistItem(item.id)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Skip
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Access Tab */}
      {activeTab === 'access' && accessProgress && (
        <div className="space-y-6">
          {/* Current Access */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Access Level</h2>
            <div className="flex items-center justify-center py-8">
              <div className={`px-8 py-4 rounded-lg text-2xl font-bold ${
                accessProgress.currentAccessLevel === AccessLevel.Full ? 'bg-green-100 text-green-800' :
                accessProgress.currentAccessLevel === AccessLevel.Day30 ? 'bg-blue-100 text-blue-800' :
                accessProgress.currentAccessLevel === AccessLevel.Day7 ? 'bg-purple-100 text-purple-800' :
                accessProgress.currentAccessLevel === AccessLevel.Day1 ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {accessProgress.currentAccessLevel}
              </div>
            </div>
          </div>

          {/* Access Progression */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Access Progression</h2>
            
            <div className="space-y-4">
              {/* Day 1 */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Day 1 Access</p>
                  <p className="text-sm text-gray-600">Basic system access</p>
                </div>
                {accessProgress.day1AccessGrantedAt ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Granted {new Date(accessProgress.day1AccessGrantedAt).toLocaleDateString()}
                  </span>
                ) : accessProgress.day1Eligible ? (
                  <button
                    onClick={() => handleGrantAccess(AccessLevel.Day1)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Grant Access
                  </button>
                ) : (
                  <span className="text-gray-500">Not eligible yet</span>
                )}
              </div>

              {/* Day 7 */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Day 7 Access</p>
                  <p className="text-sm text-gray-600">Department access with supervision</p>
                </div>
                {accessProgress.day7AccessGrantedAt ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Granted {new Date(accessProgress.day7AccessGrantedAt).toLocaleDateString()}
                  </span>
                ) : accessProgress.day7Eligible ? (
                  <button
                    onClick={() => handleGrantAccess(AccessLevel.Day7)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Grant Access
                  </button>
                ) : (
                  <span className="text-gray-500">Not eligible yet</span>
                )}
              </div>

              {/* Day 30 */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Day 30 Access</p>
                  <p className="text-sm text-gray-600">Extended permissions</p>
                </div>
                {accessProgress.day30AccessGrantedAt ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Granted {new Date(accessProgress.day30AccessGrantedAt).toLocaleDateString()}
                  </span>
                ) : accessProgress.day30Eligible ? (
                  <button
                    onClick={() => handleGrantAccess(AccessLevel.Day30)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Grant Access
                  </button>
                ) : (
                  <span className="text-gray-500">Not eligible yet</span>
                )}
              </div>

              {/* Full */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Full Access</p>
                  <p className="text-sm text-gray-600">Complete system permissions</p>
                </div>
                {accessProgress.fullAccessGrantedAt ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Granted {new Date(accessProgress.fullAccessGrantedAt).toLocaleDateString()}
                  </span>
                ) : accessProgress.fullEligible ? (
                  <button
                    onClick={() => handleGrantAccess(AccessLevel.Full)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Grant Full Access
                  </button>
                ) : (
                  <span className="text-gray-500">Not eligible yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

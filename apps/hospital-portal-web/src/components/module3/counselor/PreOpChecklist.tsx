'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useGeneratePreOpChecklist, useSessionChecklist } from '@/hooks/use-surgery-scheduling';
import { useQueryClient } from '@tanstack/react-query';
import type { OTScheduleDto, PreOpChecklistDto } from '@/types/surgery-scheduling';
import type {
  PreOpChecklistItem,
  SessionChecklist,
} from '@/types/preop-checklist';
import {
  saveChecklistToStorage,
  loadChecklistFromStorage,
  deleteChecklistFromStorage,
  calculateCompletionPercentage,
} from '@/types/preop-checklist';

interface PreOpChecklistProps {
  sessionId: string;
  schedule?: OTScheduleDto; // OR booking details
  patientAge?: number;
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
  onAnticoagulants?: boolean;
}

export function PreOpChecklist({
  sessionId,
  schedule,
  patientAge = 65,
  hasDiabetes = false,
  hasHypertension = false,
  onAnticoagulants = false,
}: PreOpChecklistProps) {
  const queryClient = useQueryClient();
  const generateChecklistMutation = useGeneratePreOpChecklist();
  const { data: storedChecklist, refetch } = useSessionChecklist(sessionId);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [checklist, setChecklist] = useState<SessionChecklist | null>(storedChecklist);

  // Sync with localStorage
  useEffect(() => {
    if (storedChecklist) {
      setChecklist(storedChecklist);
    } else {
      setChecklist(null);
    }
  }, [storedChecklist]);

  // Generate checklist from OR booking
  const handleGenerateChecklist = async () => {
    if (!schedule) {
      toast.error('No OR booking found. Please book OR first.');
      return;
    }

    const dto: PreOpChecklistDto = {
      surgeryType: schedule.surgeryType,
      procedureType: schedule.procedureDescription || schedule.surgeryType,
      patientAge,
      hasDiabetes,
      hasHypertension,
      onAnticoagulants,
      additionalItems: [],
    };

    try {
      const result = await generateChecklistMutation.mutateAsync(dto);

      // Create checklist items with UUIDs
      const items: PreOpChecklistItem[] = result.checklist.map((description, index) => ({
        id: `${sessionId}-${index}-${Date.now()}`,
        description,
        isCompleted: false,
      }));

      const newChecklist: SessionChecklist = {
        sessionId,
        scheduleId: schedule.id,
        surgeryType: schedule.surgeryType,
        procedureType: schedule.procedureDescription || schedule.surgeryType,
        generatedAt: new Date().toISOString(),
        items,
        completionPercentage: 0,
        isFullyCompleted: false,
      };

      // Save to localStorage
      saveChecklistToStorage(newChecklist);
      setChecklist(newChecklist);
      refetch();

      toast.success(`Pre-op checklist generated with ${result.totalItems} items`);
      setShowGenerateDialog(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to generate checklist');
    }
  };

  // Toggle checklist item completion
  const handleToggleItem = (itemId: string) => {
    if (!checklist) return;

    const updatedItems = checklist.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            isCompleted: !item.isCompleted,
            completedAt: !item.isCompleted ? new Date().toISOString() : undefined,
          }
        : item
    );

    const completionPercentage = calculateCompletionPercentage(updatedItems);
    const isFullyCompleted = completionPercentage === 100;

    const updatedChecklist: SessionChecklist = {
      ...checklist,
      items: updatedItems,
      completionPercentage,
      isFullyCompleted,
    };

    saveChecklistToStorage(updatedChecklist);
    setChecklist(updatedChecklist);
    refetch();

    if (isFullyCompleted) {
      toast.success('🎉 All pre-op checklist items completed!');
    }
  };

  // Regenerate checklist
  const handleRegenerateChecklist = () => {
    setShowGenerateDialog(true);
  };

  // Delete checklist
  const handleDeleteChecklist = () => {
    if (!checklist) return;

    deleteChecklistFromStorage(sessionId);
    setChecklist(null);
    refetch();
    toast.success('Pre-op checklist deleted');
  };

  const hasChecklist = !!checklist;
  const hasORBooking = !!schedule;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Pre-Op Checklist
            </CardTitle>
            {hasChecklist && (
              <Badge
                variant={checklist.isFullyCompleted ? 'default' : 'secondary'}
                className={checklist.isFullyCompleted ? 'bg-green-500' : ''}
              >
                {checklist.isFullyCompleted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Complete
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {checklist.completionPercentage}% Complete
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* No OR Booking Warning */}
          {!hasORBooking && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-900">
                <p className="font-medium">OR Booking Required</p>
                <p className="mt-1">Book an OR slot to generate the pre-operative checklist.</p>
              </div>
            </div>
          )}

          {/* No Checklist - Show Generate Button */}
          {!hasChecklist && hasORBooking && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Generate a comprehensive pre-operative checklist based on the scheduled surgery.
              </p>
              <Button onClick={() => setShowGenerateDialog(true)} className="w-full">
                <ClipboardList className="w-4 h-4 mr-2" />
                Generate Pre-Op Checklist
              </Button>
            </div>
          )}

          {/* Checklist Display */}
          {hasChecklist && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Completion Progress</span>
                  <span className="text-gray-600">
                    {checklist.items.filter((i) => i.isCompleted).length} / {checklist.items.length}
                  </span>
                </div>
                <Progress value={checklist.completionPercentage} className="h-2" />
              </div>

              <Separator />

              {/* Checklist Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {checklist.surgeryType} Surgery Checklist
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateChecklist}
                      disabled={generateChecklistMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteChecklist}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {checklist.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        item.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Checkbox
                        id={item.id}
                        checked={item.isCompleted}
                        onCheckedChange={() => handleToggleItem(item.id)}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={item.id}
                        className={`flex-1 cursor-pointer select-none text-sm ${
                          item.isCompleted ? 'line-through text-gray-500' : 'text-gray-700'
                        }`}
                      >
                        {item.description}
                      </Label>
                      {item.isCompleted && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Generated Info */}
              <div className="text-xs text-gray-500 pt-2">
                Generated on {new Date(checklist.generatedAt).toLocaleDateString()} at{' '}
                {new Date(checklist.generatedAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Confirmation Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Pre-Operative Checklist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {hasChecklist && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-900">
                  <strong>Warning:</strong> This will replace the existing checklist. All completion progress will be
                  lost.
                </p>
              </div>
            )}

            {schedule && (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Surgery Type:</strong> {schedule.surgeryType}
                </p>
                <p>
                  <strong>Procedure:</strong> {schedule.procedureDescription || 'Standard procedure'}
                </p>
                <p>
                  <strong>Eye:</strong> {schedule.eyeOperated || 'Not specified'}
                </p>
                <p>
                  <strong>Patient Age:</strong> {patientAge} years
                </p>
                {hasDiabetes && (
                  <p className="text-orange-700">
                    <strong>• Patient has Diabetes</strong> (Additional diabetic checks will be included)
                  </p>
                )}
                {hasHypertension && (
                  <p className="text-orange-700">
                    <strong>• Patient has Hypertension</strong> (Additional cardiac checks will be included)
                  </p>
                )}
                {onAnticoagulants && (
                  <p className="text-red-700">
                    <strong>• Patient on Anticoagulants</strong> (Bleeding risk precautions will be included)
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600">
              The checklist will include surgery-specific investigations and patient-specific precautions based on the
              information above.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateChecklist} disabled={generateChecklistMutation.isPending}>
              {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Checklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

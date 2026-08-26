/**
 * Walkout Dialog Component
 * Phase 1 Critical Gates - Walkout Marking
 * Allows marking patients who left before consultation
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, UserX, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { visitsApi } from '@/lib/api/visits.api';

interface WalkoutDialogProps {
  visitId: string;
  patientName: string;
  tokenNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WalkoutDialog({
  visitId,
  patientName,
  tokenNumber,
  open,
  onOpenChange,
  onSuccess,
}: WalkoutDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWalkout = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error('Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    try {
      setLoading(true);
      await visitsApi.markWalkout(visitId, reason.trim());
      
      toast.success(`Patient ${patientName} marked as walkout`);
      onOpenChange(false);
      setReason('');
      onSuccess?.();
    } catch (error: any) {
      console.error('Error marking walkout:', error);
      toast.error(error.response?.data?.message || 'Failed to mark walkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <UserX className="h-5 w-5" />
            Mark Patient as Walkout
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-3">
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-sm text-gray-700">
                <strong>Patient:</strong> {patientName}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Token:</strong> {tokenNumber}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <p className="text-sm text-orange-800 font-medium mb-2">
                ⚠️ About Walkout Status
              </p>
              <ul className="text-sm text-orange-700 space-y-1 ml-4 list-disc">
                <li>Patient left before consultation</li>
                <li>Visit will be marked as incomplete</li>
                <li>Action will be logged for audit</li>
                <li>Reason is mandatory</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="walkout-reason" className="required">
              Reason for Walkout
            </Label>
            <Textarea
              id="walkout-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide detailed reason (e.g., 'Patient left due to long wait time', 'Emergency call received', 'Patient felt unwell')"
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {reason.length}/10 minimum characters
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWalkout}
            disabled={loading || reason.trim().length < 10}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <UserX className="h-4 w-4 mr-2" />
            Mark as Walkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

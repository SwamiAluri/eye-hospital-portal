/**
 * Check-In Hard Gate Component
 * Phase 1 Critical Gates - 4-Condition Validation
 * Enforces: Patient Valid + Appointment Valid + Bill Paid + Bill Finalized
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Unlock,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { visitsApi, CheckInValidation, CheckInResult } from '@/lib/api/visits.api';

interface CheckInGateProps {
  appointmentId: string;
  patientName: string;
  appointmentTime: string;
  onCheckInSuccess?: (result: CheckInResult) => void;
  onCancel?: () => void;
}

export function CheckInGate({
  appointmentId,
  patientName,
  appointmentTime,
  onCheckInSuccess,
  onCancel,
}: CheckInGateProps) {
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [processingEmergency, setProcessingEmergency] = useState(false);

  useEffect(() => {
    loadValidation();
  }, [appointmentId]);

  const loadValidation = async () => {
    try {
      setLoading(true);
      const result = await visitsApi.validateCheckIn(appointmentId);
      setValidation(result);
    } catch (error: any) {
      console.error('Error validating check-in:', error);
      toast.error('Failed to validate check-in requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!validation) return;

    if (!validation.canCheckIn) {
      toast.error('Cannot check in - Please resolve all validation errors');
      return;
    }

    try {
      setLoading(true);
      const result = await visitsApi.checkIn({
        appointmentId,
        opdBillId: validation.billId,
      });

      if (result.success) {
        toast.success(`Check-in successful! Token: ${result.tokenNumber}`);
        onCheckInSuccess?.(result);
      } else {
        toast.error(result.message || 'Check-in failed');
      }
    } catch (error: any) {
      console.error('Error during check-in:', error);
      toast.error(error.response?.data?.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyOverride = async () => {
    if (!emergencyReason.trim()) {
      toast.error('Please provide a reason for emergency override');
      return;
    }

    try {
      setProcessingEmergency(true);
      const result = await visitsApi.checkIn({
        appointmentId,
        opdBillId: validation?.billId,
        isEmergency: true,
        emergencyReason: emergencyReason.trim(),
      });

      if (result.success) {
        toast.success(`Emergency check-in successful! Token: ${result.tokenNumber}`);
        setEmergencyDialogOpen(false);
        onCheckInSuccess?.(result);
      } else {
        toast.error(result.message || 'Emergency check-in failed');
      }
    } catch (error: any) {
      console.error('Error during emergency check-in:', error);
      toast.error(error.response?.data?.message || 'Emergency check-in failed');
    } finally {
      setProcessingEmergency(false);
    }
  };

  if (loading && !validation) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Validating check-in requirements...</span>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="text-center py-8 text-red-600">
        <AlertCircle className="h-12 w-12 mx-auto mb-3" />
        <p>Failed to load validation data</p>
      </div>
    );
  }

  const ValidationRow = ({
    label,
    valid,
    message,
  }: {
    label: string;
    valid: boolean;
    message?: string;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-white">
      {valid ? (
        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1">
        <p
          className={`font-medium ${
            valid ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {label}
        </p>
        {message && (
          <p className="text-sm text-gray-600 mt-1">{message}</p>
        )}
      </div>
      <Badge variant={valid ? 'default' : 'destructive'} className="ml-auto">
        {valid ? 'PASS' : 'FAIL'}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Check-In Validation
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Patient: <strong>{patientName}</strong> | Time:{' '}
              <strong>{appointmentTime}</strong>
            </p>
          </div>
          <div>
            {validation.canCheckIn ? (
              <Unlock className="h-8 w-8 text-green-600" />
            ) : (
              <Lock className="h-8 w-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      {/* 4-Condition Validation Display */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">
          Mandatory Requirements (4-Condition Hard Gate)
        </h4>

        <ValidationRow
          label="1. Patient Validation"
          valid={validation.patientValid}
          message={
            validation.patientMessage ||
            (validation.patientValid
              ? 'Patient record found and active'
              : 'Patient record invalid or inactive')
          }
        />

        <ValidationRow
          label="2. Appointment Validation"
          valid={validation.appointmentValid}
          message={
            validation.appointmentMessage ||
            (validation.appointmentValid
              ? 'Appointment confirmed for today'
              : 'Appointment not found or not scheduled for today')
          }
        />

        <ValidationRow
          label="3. Bill Generated"
          valid={validation.billValid}
          message={
            validation.billMessage ||
            (validation.billValid
              ? `Bill ${validation.billId?.slice(0, 8)} generated`
              : 'OPD bill not generated - Please generate bill first')
          }
        />

        <ValidationRow
          label="4. Payment Complete"
          valid={validation.paymentValid}
          message={
            validation.paymentMessage ||
            (validation.paymentValid
              ? 'Full payment received'
              : validation.amountDue
              ? `Outstanding amount: ₹${validation.amountDue.toLocaleString()}`
              : 'Payment not completed')
          }
        />
      </div>

      {/* Status Summary */}
      <div
        className={`rounded-lg p-4 border-2 ${
          validation.canCheckIn
            ? 'bg-green-50 border-green-300'
            : 'bg-red-50 border-red-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {validation.canCheckIn ? (
            <>
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">
                  ✅ All Conditions Met - Ready for Check-In
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Patient can proceed to check-in and receive token number
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">
                  ❌ Cannot Check In - Requirements Not Met
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Please resolve all validation errors before proceeding
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}

        {validation.canCheckIn ? (
          <Button
            onClick={handleCheckIn}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle className="h-4 w-4 mr-2" />
            Check In Now
          </Button>
        ) : (
          <>
            <Button
              onClick={loadValidation}
              variant="outline"
              disabled={loading}
            >
              <Loader2
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh Status
            </Button>

            {validation.canEmergencyCheckIn && (
              <Button
                onClick={() => setEmergencyDialogOpen(true)}
                variant="destructive"
                className="bg-orange-600 hover:bg-orange-700"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Emergency Override
              </Button>
            )}
          </>
        )}
      </div>

      {/* Emergency Override Dialog */}
      <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ShieldAlert className="h-5 w-5" />
              Emergency Check-In Override
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-3">
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  ⚠️ This action bypasses payment requirements
                </p>
                <ul className="text-sm text-orange-700 space-y-1 ml-4 list-disc">
                  <li>Patient will be checked in without full payment</li>
                  <li>Manager/Admin authorization required</li>
                  <li>Action will be logged for audit</li>
                  <li>Valid reason must be provided</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="required">
                Emergency Reason
              </Label>
              <Textarea
                id="reason"
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Provide detailed reason for emergency override (minimum 20 characters)"
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                {emergencyReason.length}/20 minimum characters
              </p>
            </div>

            <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700">
              <p className="font-medium mb-1">Patient: {patientName}</p>
              <p>
                Outstanding Amount: ₹
                {validation.amountDue?.toLocaleString() || 0}
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmergencyDialogOpen(false);
                setEmergencyReason('');
              }}
              disabled={processingEmergency}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmergencyOverride}
              disabled={
                processingEmergency || emergencyReason.trim().length < 20
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processingEmergency && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <ShieldAlert className="h-4 w-4 mr-2" />
              Authorize Emergency Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

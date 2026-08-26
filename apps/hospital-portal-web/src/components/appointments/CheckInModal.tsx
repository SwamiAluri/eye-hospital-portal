'use client';

import { useState, useEffect, useRef } from 'react';
import { visitsApi, CheckInValidation, CheckInResult } from '@/lib/api/visits.api';
import { opdBillingApi, CreateOpdBillRequest, PaymentMode, OpdBill } from '@/lib/api/opd-billing.api';
import { buildAddPaymentRequest, reuseOrCreatePaymentKey } from '@/lib/ip-management/collect-payment';
import { usePaymentModes } from '@/hooks/use-payment-modes';
import type { LucideIcon } from 'lucide-react';
import { departmentsApi, Department } from '@/lib/api/departments.api';
import { getApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  Calendar, 
  Receipt, 
  CreditCard,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Banknote,
  Wallet,
  Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const PAYMENT_MODE_ICONS: Partial<Record<PaymentMode, LucideIcon>> = {
  cash: Banknote,
  card: CreditCard,
  upi: Wallet,
  net_banking: Building2,
  cheque: Building2,
  insurance: CreditCard,
  wallet: Wallet,
};

interface Branch {
  id: string;
  name: string;
  code?: string;
}

interface CheckInModalProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  branchId?: string;
  departmentId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: CheckInResult) => void;
}

export default function CheckInModal({
  appointmentId,
  patientId,
  patientName,
  appointmentDate,
  appointmentTime,
  branchId,
  departmentId,
  isOpen,
  onClose,
  onSuccess
}: CheckInModalProps) {
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<CheckInValidation | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [notes, setNotes] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  
  // Branch state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || '');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  
  // Department state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(departmentId || '');
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  
  // Payment success notification
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  
  // Inline billing state
  const [step, setStep] = useState<'check' | 'billing' | 'payment'>('check');
  const [generatingBill, setGeneratingBill] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentBill, setCurrentBill] = useState<OpdBill | null>(null);
  const paymentKeyRef = useRef('');
  const paymentInFlight = useRef(false);
  
  // Bill form state
  const [consultationFee, setConsultationFee] = useState(500);
  const [registrationFee, setRegistrationFee] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [billNotes, setBillNotes] = useState('');
  
  // Payment form state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  
  const router = useRouter();
  const { user } = useAuthStore();
  const { modes: paymentModeChoices, loading: paymentModesLoading } = usePaymentModes();

  useEffect(() => {
    if (paymentModeChoices.length === 0) return;
    const valid = paymentModeChoices.some((m) => m.apiMode === paymentMode);
    if (!valid) setPaymentMode(paymentModeChoices[0].apiMode);
  }, [paymentModeChoices, paymentMode]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  // Fetch branches on mount and auto-select first branch if no branchId from appointment
  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const api = getApi();
        const response = await api.get('/branches');
        // Handle various response formats - ensure we always get an array
        let branchList: Branch[] = [];
        if (Array.isArray(response.data)) {
          branchList = response.data;
        } else if (response.data?.items && Array.isArray(response.data.items)) {
          branchList = response.data.items;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          branchList = response.data.data;
        }
        setBranches(branchList);
        
        // Auto-select first branch if no branchId provided from appointment
        if (!branchId && branchList.length > 0) {
          setSelectedBranchId(branchList[0].id);
          console.log('Auto-selected branch:', branchList[0].id, branchList[0].name);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        // Set empty array to prevent .map errors
        setBranches([]);
      } finally {
        setBranchesLoading(false);
        setBranchesLoaded(true);
      }
    };
    
    if (isOpen && !branchId && !branchesLoaded) {
      // Only fetch branches if we don't already have a branchId from the appointment
      fetchBranches();
    } else if (branchId) {
      // Use the branchId from the appointment directly
      setSelectedBranchId(branchId);
      setBranchesLoaded(true);
    }
  }, [isOpen, branchId, branchesLoaded]);

  useEffect(() => {
    if (isOpen && appointmentId) {
      validateCheckIn();
    }
  }, [isOpen, appointmentId]);

  useEffect(() => {
    // When bill is loaded, set payment amount to balance due
    if (currentBill) {
      setPaymentAmount(currentBill.balanceDue || currentBill.netAmount);
    }
  }, [currentBill]);
  
  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setDepartmentsLoading(true);
        const depts = await departmentsApi.getAll();
        setDepartments(depts);
        
        // Auto-select department from appointment if available
        if (departmentId) {
          setSelectedDepartmentId(departmentId);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        setDepartments([]);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen, departmentId]);

  const validateCheckIn = async () => {
    try {
      setLoading(true);
      const result = await visitsApi.validateCheckIn(appointmentId);
      setValidation(result);
      
      // If bill exists but not paid, load the bill details
      if (result.billValid && result.billId && !result.paymentValid) {
        try {
          const bill = await opdBillingApi.getOpdBill(result.billId);
          setCurrentBill(bill);
        } catch (e) {
          console.error('Error loading bill:', e);
        }
      }
    } catch (error) {
      console.error('Error validating check-in:', error);
      setValidation({
        patientValid: false,
        patientMessage: 'Failed to validate patient',
        appointmentValid: false,
        appointmentMessage: 'Failed to validate appointment',
        billValid: false,
        billMessage: 'Failed to check bill status',
        paymentValid: false,
        paymentMessage: 'Failed to check payment status',
        canCheckIn: false,
        canEmergencyCheckIn: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBill = async () => {
    // Determine which branchId to use - from user profile or explicit selection.
    let effectiveBranchId = branchId || selectedBranchId;
    
    if (!effectiveBranchId) {
      alert('Your user profile is missing a branch assignment. Please assign a branch to generate bills.');
      return;
    }
    
    try {
      setGeneratingBill(true);
      
      const grossAmount = consultationFee + registrationFee + additionalCharges;
      const discountAmount = (grossAmount * discountPercentage) / 100;
      const netAmount = grossAmount - discountAmount;
      
      const request: CreateOpdBillRequest = {
        appointmentId,
        patientId,
        branchId: effectiveBranchId,
        consultationFee,
        registrationFee,
        additionalCharges,
        discountPercentage,
        notes: billNotes || undefined,
      };
      
      const bill = await opdBillingApi.createOpdBill(request);
      setCurrentBill(bill);
      setPaymentAmount(bill.netAmount);
      
      // Move to payment step
      setStep('payment');
      
      // Re-validate to update status
      await validateCheckIn();
    } catch (error: any) {
      console.error('Error generating bill:', error);
      alert(error.response?.data?.message || 'Failed to generate bill. Please try again.');
    } finally {
      setGeneratingBill(false);
    }
  };

  const handlePayment = async () => {
    if (!currentBill) {
      alert('Bill not found. Please generate a bill first.');
      return;
    }
    if (paymentInFlight.current) return;

    paymentInFlight.current = true;
    try {
      setProcessingPayment(true);
      paymentKeyRef.current = reuseOrCreatePaymentKey(paymentKeyRef.current, currentBill.id);

      await opdBillingApi.addPayment(buildAddPaymentRequest({
        opdBillId: currentBill.id,
        paymentMode,
        amount: paymentAmount,
        paymentKind: 'Payment',
        idempotencyKey: paymentKeyRef.current,
        notes: paymentNotes || undefined,
      }));
      paymentKeyRef.current = '';
      
      // Show success notification
      setShowPaymentSuccess(true);
      setTimeout(() => setShowPaymentSuccess(false), 3000);
      
      // Re-validate to check if payment is now complete
      await validateCheckIn();
      
      // Reset to check step to show updated status
      setStep('check');
    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert(error.response?.data?.message || 'Failed to process payment. Please try again.');
    } finally {
      paymentInFlight.current = false;
      setProcessingPayment(false);
    }
  };

  const handleCheckIn = async () => {
    if (!validation?.canCheckIn && !isEmergency) return;

    try {
      setCheckingIn(true);
      const result = await visitsApi.checkIn({
        appointmentId,
        opdBillId: validation?.billId || currentBill?.id,
        departmentId: selectedDepartmentId || undefined,
        notes: notes || undefined,
        isEmergency,
        emergencyReason: isEmergency ? emergencyReason : undefined
      });

      if (result.success) {
        onSuccess(result);
      } else {
        alert(result.message || 'Check-in failed');
      }
    } catch (error: any) {
      console.error('Error during check-in:', error);
      alert(error.response?.data?.message || 'Check-in failed. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const calculateBillTotal = () => {
    const gross = consultationFee + registrationFee + additionalCharges;
    const discount = (gross * discountPercentage) / 100;
    return gross - discount;
  };

  const PaymentModeButton = ({ mode, icon: Icon, label }: { mode: PaymentMode; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => setPaymentMode(mode)}
      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
        paymentMode === mode 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Patient Check-In
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{patientName}</span> • {formatDate(appointmentDate)} {appointmentTime ? `at ${appointmentTime}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-muted-foreground">Checking payment status...</p>
          </div>
        ) : step === 'check' ? (
          <div className="space-y-4 py-4">
            {/* Payment Success Notification */}
            {showPaymentSuccess && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Payment Successful!</p>
                    <p className="text-sm text-green-700">Payment has been recorded. You can now check in the patient.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Visual Check-In Status Indicators */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                validation?.patientValid 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}>
                {validation?.patientValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="text-xs font-medium text-center">Patient</span>
              </div>
              
              <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                validation?.appointmentValid 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}>
                {validation?.appointmentValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="text-xs font-medium text-center">Appointment</span>
              </div>
              
              <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                validation?.billValid 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-amber-200 bg-amber-50'
              }`}>
                {validation?.billValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Receipt className="h-5 w-5 text-amber-600" />
                )}
                <span className="text-xs font-medium text-center">Bill</span>
              </div>
              
              <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${
                validation?.paymentValid 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-amber-200 bg-amber-50'
              }`}>
                {validation?.paymentValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <CreditCard className="h-5 w-5 text-amber-600" />
                )}
                <span className="text-xs font-medium text-center">Payment</span>
              </div>
            </div>
            
            {/* Department Selector */}
            {validation?.canCheckIn && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={departmentsLoading}
                >
                  {departmentsLoading ? (
                    <option>Loading departments...</option>
                  ) : departments.length === 0 ? (
                    <option>No departments available</option>
                  ) : (
                    <>
                      {!selectedDepartmentId && <option value="">Select a department</option>}
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.departmentName} {dept.departmentCode ? `(${dept.departmentCode})` : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {selectedDepartmentId && departmentId && selectedDepartmentId === departmentId 
                    ? 'Auto-assigned from appointment. You can change if needed.' 
                    : 'Select the department for this visit'}
                </p>
              </div>
            )}
            
            {/* Simplified Status - Only show what's actionable */}
            {validation?.canCheckIn ? (
              /* Ready for Check-In */
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Ready for Check-In</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Bill paid. Patient can proceed with check-in.
                </p>
              </div>
            ) : !validation?.billValid ? (
              /* No Bill - Show generate bill option */
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <Receipt className="h-5 w-5" />
                  <span className="font-semibold">Payment Required</span>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  Generate a bill and collect payment before check-in.
                </p>
                <Button onClick={() => setStep('billing')} className="gap-2">
                  <Receipt className="h-4 w-4" />
                  Generate Bill & Pay
                </Button>
              </div>
            ) : !validation?.paymentValid ? (
              /* Bill exists but not paid */
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-semibold">Payment Pending</span>
                </div>
                {currentBill && (
                  <div className="bg-white rounded p-3 mb-3 text-sm">
                    <div className="flex justify-between">
                      <span>Bill #:</span>
                      <span className="font-medium">{currentBill.billNumber}</span>
                    </div>
                    <div className="flex justify-between text-amber-800 font-semibold mt-1">
                      <span>Amount Due:</span>
                      <span>₹{currentBill.balanceDue?.toFixed(2) || currentBill.netAmount?.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <Button onClick={() => setStep('payment')} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Collect Payment
                </Button>
              </div>
            ) : null}

            {/* Emergency Override Option - Always visible when can't check in */}
            {!validation?.canCheckIn && (
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="emergency"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="mt-1 h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="emergency" className="font-medium text-orange-800 cursor-pointer">
                      Emergency Override
                    </label>
                    <p className="text-sm text-orange-700">
                      Allow check-in without payment (will be logged for audit)
                    </p>
                    {isEmergency && (
                      <div className="mt-3">
                        <Label htmlFor="emergencyReason" className="text-orange-800">
                          Emergency Reason (Required)
                        </Label>
                        <Textarea
                          id="emergencyReason"
                          value={emergencyReason}
                          onChange={(e) => setEmergencyReason(e.target.value)}
                          placeholder="Enter the reason for emergency check-in..."
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes - Only show when can check in */}
            {(validation?.canCheckIn || isEmergency) && (
              <div>
                <Label htmlFor="notes">Check-In Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for this check-in..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
        ) : step === 'billing' ? (
          /* Inline Bill Generation Form */
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('check')}>
                ← Back
              </Button>
              <span className="font-semibold">Generate Bill</span>
            </div>
            
            <div className="space-y-3">
              {/* Branch Selector - shown when no branch is pre-selected and branches are loaded */}
              {!branchId && branchesLoaded && branches.length > 0 && (
                <div>
                  <Label htmlFor="branchSelect">Branch <span className="text-red-500">*</span></Label>
                  <select
                    id="branchSelect"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a branch</option>
                    {Array.isArray(branches) && branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.code ? `(${branch.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Show loading only while branches are being fetched */}
              {!branchId && branchesLoading && (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading branches...
                </div>
              )}
              
              <div>
                <Label htmlFor="consultationFee">Consultation Fee (₹)</Label>
                <Input
                  id="consultationFee"
                  type="number"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="registrationFee">Registration Fee (₹)</Label>
                <Input
                  id="registrationFee"
                  type="number"
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="additionalCharges">Additional Charges (₹)</Label>
                <Input
                  id="additionalCharges"
                  type="number"
                  value={additionalCharges}
                  onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="discountPercentage">Discount (%)</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="billNotes">Notes (Optional)</Label>
                <Textarea
                  id="billNotes"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Any notes for this bill..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            
            {/* Bill Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <h4 className="font-semibold mb-2">Bill Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Consultation Fee:</span>
                  <span>₹{consultationFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registration Fee:</span>
                  <span>₹{registrationFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Additional Charges:</span>
                  <span>₹{additionalCharges.toFixed(2)}</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({discountPercentage}%):</span>
                    <span>-₹{(((consultationFee + registrationFee + additionalCharges) * discountPercentage) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span>₹{calculateBillTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleGenerateBill} 
              disabled={generatingBill || calculateBillTotal() <= 0}
              className="w-full gap-2"
            >
              {generatingBill && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Bill & Continue to Payment
            </Button>
          </div>
        ) : step === 'payment' ? (
          /* Inline Payment Form */
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('check')}>
                ← Back
              </Button>
              <span className="font-semibold">Collect Payment</span>
            </div>
            
            {currentBill && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span>Bill #:</span>
                  <span className="font-medium">{currentBill.billNumber}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-800 mt-1">
                  <span>Amount Due:</span>
                  <span>₹{(currentBill.balanceDue || currentBill.netAmount)?.toFixed(2)}</span>
                </div>
              </div>
            )}
            
            {/* Payment Mode Selection — B3: billing.payment_mode master */}
            <div>
              <Label className="mb-2 block">Payment Mode</Label>
              {paymentModesLoading ? (
                <p className="text-xs text-gray-500">Loading payment modes…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {paymentModeChoices.map((choice) => (
                    <PaymentModeButton
                      key={choice.masterCode}
                      mode={choice.apiMode}
                      icon={PAYMENT_MODE_ICONS[choice.apiMode] ?? Banknote}
                      label={choice.label}
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="paymentAmount">Amount (₹)</Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Transaction ID, reference number, etc."
                className="mt-1"
                rows={2}
              />
            </div>
            
            <Button 
              onClick={handlePayment} 
              disabled={processingPayment || paymentAmount <= 0}
              className="w-full gap-2"
            >
              {processingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {step === 'check' && (
            <Button 
              onClick={handleCheckIn} 
              disabled={
                loading || 
                checkingIn || 
                (!validation?.canCheckIn && !isEmergency) ||
                (isEmergency && !emergencyReason.trim()) ||
                (validation?.canCheckIn && !selectedDepartmentId)
              }
              className={isEmergency ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              {checkingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEmergency ? 'Emergency Check-In' : 'Check In Patient'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

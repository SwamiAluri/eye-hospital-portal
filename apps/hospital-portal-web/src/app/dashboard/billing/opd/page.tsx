'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  opdBillingApi, 
  OpdBill, 
  CreateOpdBillRequest, 
  AddPaymentRequest,
  PaymentMode,
  BillingCheckResult 
} from '@/lib/api/opd-billing.api';
import { visitsApi, CheckInValidation } from '@/lib/api/visits.api';
import { refundsApi, RefundMode } from '@/lib/api/refunds.api';
import { appointmentsApi, Appointment } from '@/lib/api/appointments-enhanced.api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Receipt, 
  CreditCard, 
  Banknote, 
  Smartphone,
  Building2,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  FileText,
  Printer,
  RefreshCw,
  Plus,
  Filter,
  IndianRupee,
  Loader2,
  Undo2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { usePaymentModes } from '@/hooks/use-payment-modes';
import type { LucideIcon } from 'lucide-react';

const PAYMENT_MODE_ICONS: Partial<Record<PaymentMode, LucideIcon>> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
  net_banking: Building2,
  cheque: FileText,
  insurance: Building2,
  wallet: Banknote,
};

type TabType = 'generate' | 'pending' | 'paid' | 'rules';

interface AppointmentForBilling extends Appointment {
  billingCheck?: BillingCheckResult;
  checkInValidation?: CheckInValidation;
}

export default function OpdBillingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Generate Bill state
  const [todayAppointments, setTodayAppointments] = useState<AppointmentForBilling[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentForBilling | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  
  // Payment state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<OpdBill | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');

  useEffect(() => {
    if (paymentModeChoices.length === 0) return;
    if (!paymentModeChoices.some((m) => m.apiMode === paymentMode)) {
      setPaymentMode(paymentModeChoices[0].apiMode);
    }
  }, [paymentModeChoices, paymentMode]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState({
    cardLastFour: '',
    cardNetwork: '',
    upiId: '',
    upiTransactionId: '',
    chequeNumber: '',
    bankName: '',
    notes: ''
  });
  
  // Finalize Bill state (Phase 1 Critical Gates)
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [billToFinalize, setBillToFinalize] = useState<OpdBill | null>(null);
  
  // Refund state (Phase 1 Critical Gates)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [billToRefund, setBillToRefund] = useState<OpdBill | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMode, setRefundMode] = useState<RefundMode>('cash');
  const [refundNotes, setRefundNotes] = useState('');
  
  // Bills lists
  const [pendingBills, setPendingBills] = useState<OpdBill[]>([]);
  const [paidBills, setPaidBills] = useState<OpdBill[]>([]);
  
  // New bill form state
  const [billForm, setBillForm] = useState({
    consultationFee: 0,
    registrationFee: 0,
    additionalCharges: 0,
    discountPercentage: 0,
    isFreeVisit: false,
    freeVisitReason: '',
    notes: ''
  });

  const { user } = useAuthStore();
  const branchId = user?.branchId || '';

  useEffect(() => {
    loadTodayAppointments();
    loadPendingBills();
    loadPaidBills();
  }, [branchId]);

  const loadTodayAppointments = async () => {
    try {
      setLoading(true);
      // Get today's appointments that are confirmed/scheduled
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await appointmentsApi.getAll({
        startDate: today,
        endDate: today,
        status: 'scheduled'
      });
      
      // Get the appointments from the response
      const appointments = response?.data?.items || [];
      
      console.log('Loaded appointments:', appointments);
      
      // If no appointments found, show all today's appointments regardless of status
      if (appointments.length === 0) {
        const allTodayResponse = await appointmentsApi.getAll({
          startDate: today,
          endDate: today
        });
        const allAppointments = allTodayResponse?.data?.items || [];
        console.log('All today appointments:', allAppointments);
        setTodayAppointments(allAppointments);
        return;
      }
      
      // Filter appointments that don't have bills yet and check billing rules
      const appointmentsWithBillingCheck = await Promise.all(
        appointments.map(async (apt) => {
          try {
            const [billingCheck, checkInValidation] = await Promise.all([
              opdBillingApi.checkBillingRules(apt.id).catch(() => null),
              visitsApi.validateCheckIn(apt.id).catch(() => null)
            ]);
            return { ...apt, billingCheck, checkInValidation };
          } catch (error) {
            console.error(`Error checking billing for appointment ${apt.id}:`, error);
            return apt;
          }
        })
      );
      
      // Show all appointments (even those already billed, for visibility)
      setTodayAppointments(appointmentsWithBillingCheck);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingBills = async () => {
    try {
      const result = await opdBillingApi.getOpdBills({
        branchId,
        status: 'pending',
        dateFrom: format(new Date(), 'yyyy-MM-dd')
      });
      setPendingBills(result.bills || []);
    } catch (error) {
      console.error('Error loading pending bills:', error);
    }
  };

  const loadPaidBills = async () => {
    try {
      const result = await opdBillingApi.getOpdBills({
        branchId,
        status: 'paid',
        dateFrom: format(new Date(), 'yyyy-MM-dd')
      });
      setPaidBills(result.bills || []);
    } catch (error) {
      console.error('Error loading paid bills:', error);
    }
  };

  const handleSelectAppointment = (appointment: AppointmentForBilling) => {
    setSelectedAppointment(appointment);
    
    // Pre-fill form based on billing check
    if (appointment.billingCheck) {
      const { isFreeVisit, reason, suggestedFee } = appointment.billingCheck;
      setBillForm({
        consultationFee: isFreeVisit ? 0 : suggestedFee,
        registrationFee: 0,
        additionalCharges: 0,
        discountPercentage: 0,
        isFreeVisit,
        freeVisitReason: reason || '',
        notes: ''
      });
    } else {
      setBillForm({
        consultationFee: 500, // default fee
        registrationFee: 0,
        additionalCharges: 0,
        discountPercentage: 0,
        isFreeVisit: false,
        freeVisitReason: '',
        notes: ''
      });
    }
    
    setBillDialogOpen(true);
  };

  const calculateBillTotal = () => {
    const gross = billForm.consultationFee + billForm.registrationFee + billForm.additionalCharges;
    const discount = (gross * billForm.discountPercentage) / 100;
    return gross - discount;
  };

  const handleGenerateBill = async () => {
    if (!selectedAppointment) return;
    
    try {
      setLoading(true);
      
      const request: CreateOpdBillRequest = {
        appointmentId: selectedAppointment.id,
        patientId: selectedAppointment.patientId,
        branchId: branchId,
        consultationFee: billForm.consultationFee,
        registrationFee: billForm.registrationFee,
        additionalCharges: billForm.additionalCharges,
        discountPercentage: billForm.discountPercentage,
        isFreeVisit: billForm.isFreeVisit,
        freeVisitReason: billForm.freeVisitReason || undefined,
        notes: billForm.notes || undefined
      };
      
      const bill = await opdBillingApi.createOpdBill(request);
      
      toast.success(`Bill ${bill.billNumber} generated successfully!`);
      setBillDialogOpen(false);
      setSelectedAppointment(null);
      
      // Refresh lists
      await Promise.all([loadTodayAppointments(), loadPendingBills()]);
      
      // If it's a free visit or zero amount, show success
      if (bill.netAmount === 0) {
        toast.info('Free visit - No payment required. Patient can proceed to check-in.');
      } else {
        // Open payment dialog for the new bill
        setSelectedBill(bill);
        setPaymentAmount(bill.netAmount.toString());
        setPaymentDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error generating bill:', error);
      toast.error(error.response?.data?.message || 'Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedBill || !paymentAmount) return;
    
    try {
      setLoading(true);
      
      const request: AddPaymentRequest = {
        billId: selectedBill.id,
        paymentMode,
        amount: parseFloat(paymentAmount),
        ...(paymentMode === 'card' && {
          cardLastFour: paymentDetails.cardLastFour,
          cardNetwork: paymentDetails.cardNetwork
        }),
        ...(paymentMode === 'upi' && {
          upiId: paymentDetails.upiId,
          upiTransactionId: paymentDetails.upiTransactionId
        }),
        ...(paymentMode === 'cheque' && {
          chequeNumber: paymentDetails.chequeNumber,
          bankName: paymentDetails.bankName
        }),
        notes: paymentDetails.notes || undefined
      };
      
      await opdBillingApi.addPayment(request);
      
      toast.success('Payment recorded successfully!');
      setPaymentDialogOpen(false);
      setSelectedBill(null);
      resetPaymentForm();
      
      // Refresh lists
      await Promise.all([loadPendingBills(), loadPaidBills()]);
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCredit = async () => {
    if (!selectedBill) return;
    
    try {
      setLoading(true);
      await opdBillingApi.applyCredit({
        billId: selectedBill.id,
        creditNotes: paymentDetails.notes || 'Credit approved for later payment'
      });
      
      toast.success('Credit applied - Patient can proceed to check-in');
      setPaymentDialogOpen(false);
      setSelectedBill(null);
      
      await Promise.all([loadPendingBills(), loadPaidBills()]);
    } catch (error: any) {
      console.error('Error applying credit:', error);
      toast.error(error.response?.data?.message || 'Failed to apply credit');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeBill = async () => {
    if (!billToFinalize) return;
    
    try {
      setLoading(true);
      await opdBillingApi.finalizeBill(billToFinalize.id);
      
      toast.success('Bill finalized - No further edits allowed');
      setFinalizeDialogOpen(false);
      setBillToFinalize(null);
      
      // Refresh lists
      await Promise.all([loadPendingBills(), loadPaidBills()]);
    } catch (error: any) {
      console.error('Error finalizing bill:', error);
      toast.error(error.response?.data?.message || 'Failed to finalize bill');
    } finally {
      setLoading(false);
    }
  };

  const openFinalizeDialog = (bill: OpdBill) => {
    setBillToFinalize(bill);
    setFinalizeDialogOpen(true);
  };

  const handleRequestRefund = async () => {
    if (!billToRefund) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    if (amount > billToRefund.amountPaid) {
      toast.error(`Refund amount cannot exceed paid amount (₹${billToRefund.amountPaid.toLocaleString()})`);
      return;
    }

    if (!refundReason.trim()) {
      toast.error('Please provide a reason for refund');
      return;
    }

    try {
      setLoading(true);
      await refundsApi.requestRefund({
        opdBillId: billToRefund.id,
        refundAmount: amount,
        refundReason: refundReason.trim(),
        refundMode,
        notes: refundNotes.trim() || undefined,
      });

      toast.success('Refund request submitted for authorization');
      setRefundDialogOpen(false);
      resetRefundForm();
      
      // Refresh lists
      await Promise.all([loadPendingBills(), loadPaidBills()]);
    } catch (error: any) {
      console.error('Error requesting refund:', error);
      toast.error(error.response?.data?.message || 'Failed to request refund');
    } finally {
      setLoading(false);
    }
  };

  const openRefundDialog = (bill: OpdBill) => {
    setBillToRefund(bill);
    setRefundAmount(bill.amountPaid.toString());
    setRefundDialogOpen(true);
  };

  const resetRefundForm = () => {
    setBillToRefund(null);
    setRefundAmount('');
    setRefundReason('');
    setRefundMode('cash');
    setRefundNotes('');
  };

  const resetPaymentForm = () => {
    setPaymentMode('cash');
    setPaymentAmount('');
    setPaymentDetails({
      cardLastFour: '',
      cardNetwork: '',
      upiId: '',
      upiTransactionId: '',
      chequeNumber: '',
      bankName: '',
      notes: ''
    });
  };

  const openPaymentDialog = (bill: OpdBill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.balanceDue.toString());
    setPaymentDialogOpen(true);
  };

  const filteredAppointments = todayAppointments.filter(apt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      apt.patientName?.toLowerCase().includes(query) ||
      apt.patientId?.toLowerCase().includes(query) ||
      apt.patientPhone?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      partial: 'secondary',
      paid: 'default',
      credit: 'secondary',
      cancelled: 'destructive'
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">OPD Billing</h1>
          <p className="text-muted-foreground">Generate bills and collect payments for OPD visits</p>
        </div>
        <Button onClick={() => { loadTodayAppointments(); loadPendingBills(); loadPaidBills(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unbilled Today</p>
              <p className="text-2xl font-bold">{todayAppointments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payment</p>
              <p className="text-2xl font-bold">{pendingBills.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid Today</p>
              <p className="text-2xl font-bold">{paidBills.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <IndianRupee className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Collection</p>
              <p className="text-2xl font-bold">
                ₹{paidBills.reduce((sum, b) => sum + b.amountPaid, 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="gap-2">
            <Plus className="h-4 w-4" />
            Generate Bill
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingBills.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Paid ({paidBills.length})
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <FileText className="h-4 w-4" />
            Billing Rules
          </TabsTrigger>
        </TabsList>

        {/* Generate Bill Tab */}
        <TabsContent value="generate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Appointments - Awaiting Bill</CardTitle>
              <CardDescription>
                Select an appointment to generate OPD bill
              </CardDescription>
              <div className="flex gap-4 mt-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name, MRN, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No unbilled appointments found for today</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Patient ID</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Visit Type</TableHead>
                      <TableHead>Suggested Fee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">{apt.patientName}</TableCell>
                        <TableCell>{apt.patientId.slice(0, 8)}...</TableCell>
                        <TableCell>{apt.startTime || format(parseISO(apt.appointmentDate), 'HH:mm')}</TableCell>
                        <TableCell>{apt.doctorName || '-'}</TableCell>
                        <TableCell>
                          {apt.billingCheck?.isFreeVisit ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Free ({apt.billingCheck.visitType})
                            </Badge>
                          ) : (
                            <Badge variant="outline">{apt.billingCheck?.visitType || 'new'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {apt.billingCheck?.isFreeVisit ? (
                            <span className="text-green-600 font-medium">₹0</span>
                          ) : (
                            <span>₹{apt.billingCheck?.suggestedFee?.toLocaleString() || '500'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleSelectAppointment(apt)}>
                            <Receipt className="h-4 w-4 mr-2" />
                            Generate Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Bills Tab */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Payments</CardTitle>
              <CardDescription>Bills awaiting payment collection</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending payments</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBills.map((bill) => (
                      <TableRow key={bill.id} className={bill.isFinalized ? 'bg-gray-50' : ''}>
                        <TableCell className="font-mono">
                          {bill.billNumber}
                          {bill.isFinalized && (
                            <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-300">
                              🔒 Finalized
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>Patient #{bill.patientId.slice(0, 8)}</TableCell>
                        <TableCell>₹{bill.netAmount.toLocaleString()}</TableCell>
                        <TableCell>₹{bill.amountPaid.toLocaleString()}</TableCell>
                        <TableCell className="font-medium text-red-600">
                          ₹{bill.balanceDue.toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(bill.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => openPaymentDialog(bill)}
                              disabled={bill.isFinalized && bill.balanceDue === 0}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {bill.isFinalized ? 'View' : 'Collect'}
                            </Button>
                            {!bill.isFinalized && bill.status === 'paid' && (
                              <Button 
                                size="sm" 
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => openFinalizeDialog(bill)}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Finalize
                              </Button>
                            )}
                            {bill.isFinalized && bill.amountPaid > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                onClick={() => openRefundDialog(bill)}
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Refund
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paid Bills Tab */}
        <TabsContent value="paid" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Paid Bills</CardTitle>
              <CardDescription>Completed payments</CardDescription>
            </CardHeader>
            <CardContent>
              {paidBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No paid bills today</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono">{bill.billNumber}</TableCell>
                        <TableCell>Patient #{bill.patientId.slice(0, 8)}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          ₹{bill.amountPaid.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {bill.payments?.[0]?.paymentMode?.toUpperCase() || 'CASH'}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(bill.createdAt), 'HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Printer className="h-4 w-4 mr-2" />
                            Print Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing Rules Configuration</CardTitle>
              <CardDescription>
                Configure free visit rules, consultation fees, and follow-up policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Billing rules configuration coming soon</p>
                <p className="text-sm mt-2">Contact administrator to configure billing rules</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Bill Dialog */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate OPD Bill</DialogTitle>
            <DialogDescription>
              {selectedAppointment && (
                <span>
                  Patient: <strong>{selectedAppointment.patientName}</strong> | 
                  ID: <strong>{selectedAppointment.patientId.slice(0, 8)}...</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Free Visit Info */}
            {billForm.isFreeVisit && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Free Visit Applicable</span>
                </div>
                <p className="text-sm text-green-700 mt-1">{billForm.freeVisitReason}</p>
              </div>
            )}

            {/* Consultation Fee */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="consultationFee" className="text-right">
                Consultation Fee
              </Label>
              <div className="col-span-3 relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="consultationFee"
                  type="number"
                  value={billForm.consultationFee}
                  onChange={(e) => setBillForm({ ...billForm, consultationFee: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                  disabled={billForm.isFreeVisit}
                />
              </div>
            </div>

            {/* Registration Fee */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="registrationFee" className="text-right">
                Registration Fee
              </Label>
              <div className="col-span-3 relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="registrationFee"
                  type="number"
                  value={billForm.registrationFee}
                  onChange={(e) => setBillForm({ ...billForm, registrationFee: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Additional Charges */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="additionalCharges" className="text-right">
                Additional Charges
              </Label>
              <div className="col-span-3 relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="additionalCharges"
                  type="number"
                  value={billForm.additionalCharges}
                  onChange={(e) => setBillForm({ ...billForm, additionalCharges: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Discount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="discount" className="text-right">
                Discount %
              </Label>
              <Input
                id="discount"
                type="number"
                value={billForm.discountPercentage}
                onChange={(e) => setBillForm({ ...billForm, discountPercentage: parseFloat(e.target.value) || 0 })}
                className="col-span-3"
                max={100}
                min={0}
              />
            </div>

            {/* Notes */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={billForm.notes}
                onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
                className="col-span-3"
                placeholder="Optional notes..."
              />
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-primary">₹{calculateBillTotal().toLocaleString()}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateBill} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              {selectedBill && (
                <span>
                  Bill #: <strong>{selectedBill.billNumber}</strong> | 
                  Balance: <strong className="text-red-600">₹{selectedBill.balanceDue.toLocaleString()}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Payment Mode */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select payment mode" />
                </SelectTrigger>
                <SelectContent>
                  {paymentModesLoading ? (
                    <SelectItem value="cash" disabled>Loading…</SelectItem>
                  ) : (
                    paymentModeChoices.map((choice) => {
                      const Icon = PAYMENT_MODE_ICONS[choice.apiMode] ?? Banknote;
                      return (
                        <SelectItem key={choice.masterCode} value={choice.apiMode}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {choice.label}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <div className="col-span-3 relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Card Details */}
            {paymentMode === 'card' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Card Last 4</Label>
                  <Input
                    value={paymentDetails.cardLastFour}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, cardLastFour: e.target.value })}
                    className="col-span-3"
                    maxLength={4}
                    placeholder="1234"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Network</Label>
                  <Select 
                    value={paymentDetails.cardNetwork}
                    onValueChange={(v) => setPaymentDetails({ ...paymentDetails, cardNetwork: v })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="rupay">RuPay</SelectItem>
                      <SelectItem value="amex">American Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* UPI Details */}
            {paymentMode === 'upi' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">UPI ID</Label>
                  <Input
                    value={paymentDetails.upiId}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, upiId: e.target.value })}
                    className="col-span-3"
                    placeholder="name@upi"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Transaction ID</Label>
                  <Input
                    value={paymentDetails.upiTransactionId}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, upiTransactionId: e.target.value })}
                    className="col-span-3"
                    placeholder="UPI transaction reference"
                  />
                </div>
              </>
            )}

            {/* Cheque Details */}
            {paymentMode === 'cheque' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Cheque #</Label>
                  <Input
                    value={paymentDetails.chequeNumber}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, chequeNumber: e.target.value })}
                    className="col-span-3"
                    placeholder="Cheque number"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Bank</Label>
                  <Input
                    value={paymentDetails.bankName}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, bankName: e.target.value })}
                    className="col-span-3"
                    placeholder="Bank name"
                  />
                </div>
              </>
            )}

            {/* Notes */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Notes</Label>
              <Textarea
                value={paymentDetails.notes}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, notes: e.target.value })}
                className="col-span-3"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleApplyCredit} disabled={loading}>
              Allow Credit
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment} disabled={loading || !paymentAmount}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Bill Confirmation Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Finalize Bill - Confirmation Required
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-3">
              <p className="font-medium text-gray-900">
                You are about to finalize bill <strong>{billToFinalize?.billNumber}</strong>
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 space-y-2">
                <p className="text-sm text-yellow-800 font-medium">⚠️ Important:</p>
                <ul className="text-sm text-yellow-700 space-y-1 ml-4 list-disc">
                  <li>This bill will be <strong>locked</strong> from further edits</li>
                  <li>No payments can be added after finalization</li>
                  <li>No discounts can be applied after finalization</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
              {billToFinalize && (
                <div className="bg-gray-50 rounded-md p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Bill Amount:</span>
                    <span className="font-medium">₹{billToFinalize.netAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600">₹{billToFinalize.amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Balance Due:</span>
                    <span className="font-medium text-red-600">₹{billToFinalize.balanceDue.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-600">
                Finalized bills are permanently locked to ensure compliance and prevent unauthorized changes.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setFinalizeDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleFinalizeBill}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              Yes, Finalize Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Request Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-red-600" />
              Request Refund
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                Bill: <strong>{billToRefund?.billNumber}</strong> | Patient: <strong>#{billToRefund?.patientId.slice(0, 8)}</strong>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                <p className="font-medium text-amber-900">⚠️ Refund Authorization Required</p>
                <ul className="text-amber-700 ml-4 mt-1 list-disc space-y-1">
                  <li>Requires manager/admin approval</li>
                  <li>Will be logged for audit</li>
                  <li>Cannot exceed amount paid</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Bill Summary */}
            {billToRefund && (
              <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill Amount:</span>
                  <span className="font-medium">₹{billToRefund.netAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-green-600">₹{billToRefund.amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span className="text-gray-900">Maximum Refund:</span>
                  <span className="text-blue-600">₹{billToRefund.amountPaid.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="refund-amount" className="required">
                Refund Amount
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="refund-amount"
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                  min="0"
                  max={billToRefund?.amountPaid || 0}
                  step="0.01"
                />
              </div>
            </div>

            {/* Refund Mode */}
            <div className="space-y-2">
              <Label htmlFor="refund-mode" className="required">
                Refund Mode
              </Label>
              <Select value={refundMode} onValueChange={(v) => setRefundMode(v as RefundMode)}>
                <SelectTrigger id="refund-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {refundModeChoices.map((choice) => (
                    <SelectItem key={choice.masterCode} value={choice.apiMode as RefundMode}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refund Reason */}
            <div className="space-y-2">
              <Label htmlFor="refund-reason" className="required">
                Reason for Refund
              </Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g., Service not provided, Duplicate payment, Patient cancellation"
                rows={3}
              />
              <p className="text-xs text-gray-500">{refundReason.length}/10 minimum characters</p>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="refund-notes">Additional Notes (Optional)</Label>
              <Textarea
                id="refund-notes"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRefundDialogOpen(false);
                resetRefundForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestRefund}
              disabled={
                loading ||
                !refundAmount ||
                parseFloat(refundAmount) <= 0 ||
                refundReason.trim().length < 10
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Undo2 className="h-4 w-4 mr-2" />
              Submit Refund Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

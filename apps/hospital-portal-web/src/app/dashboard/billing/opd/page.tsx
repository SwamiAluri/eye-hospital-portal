'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  opdBillingApi, 
  OpdBill, 
  CreateOpdBillRequest, 
  BillingCheckResult,
  type BillChargeLine,
} from '@/lib/api/opd-billing.api';
import { chargeReconciliationApi, type ChargeCompleteness } from '@/lib/api/charge-reconciliation.api';
import { ipManagementApi, type PatientJourneyDetailDto } from '@/lib/api/ip-management.api';
import { resolveBillingDeepLink, type BillingDeepLink } from '@/lib/billing/resolve-billing-deep-link';
import { IpBillingWorkstation } from '@/components/billing/IpBillingWorkstation';
import type { ChargeLineItem } from '@/lib/billing/group-bill-items';
import { PatientSearchCombobox } from '@/components/shared/PatientSearchCombobox';
import type { Patient } from '@/lib/api/patients.api';
import {
  WORKSTATION_TEST_IDS,
  pickBillForPatient,
  pickJourneyForPatient,
  shouldRetainReadyBill,
} from '@/lib/billing/workstation-model';
import { CollectPaymentDrawer } from '@/components/ip-management/CollectPaymentDrawer';
import { AddBillItemDialog } from '@/components/billing/AddBillItemDialog';
import { ApplyDiscountDialog } from '@/components/billing/ApplyDiscountDialog';
import { collectJourneyFromOpdBill, finSummaryFromOpdBill } from '@/lib/billing/opd-collect-context';
import {
  BILLING_DESK_VIEW_PERMISSIONS,
  type CollectFinSummary,
} from '@/lib/ip-management/collect-payment';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { visitsApi, CheckInValidation } from '@/lib/api/visits.api';
import { refundsApi, RefundMode } from '@/lib/api/refunds.api';
import { WorkstationRefundActionDialog } from '@/components/billing/WorkstationRefundActionDialog';
import {
  buildRequestRefundRequest,
  canRequestRefundOnBill,
  normalizeRefund,
  REFUND_TEST_IDS,
  type RefundRecord,
} from '@/lib/billing/refund-contract';
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
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  Printer,
  RefreshCw,
  Plus,
  IndianRupee,
  Loader2,
  Undo2,
  ArrowLeft
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'react-hot-toast';
import { usePaymentModes } from '@/hooks/use-payment-modes';

function toChargeLine(row: BillChargeLine): ChargeLineItem {
  return {
    id: row.id,
    serviceName: row.serviceName || row.serviceCode || 'Charge',
    serviceCode: row.serviceCode,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    totalAmount: row.totalAmount,
    sourceType: row.sourceType,
    notes: row.notes,
    status: row.status,
    sourceRefId: row.sourceRefId,
    performedAt: row.performedAt,
  };
}

type TabType = 'generate' | 'pending' | 'paid' | 'rules';

interface AppointmentForBilling extends Appointment {
  billingCheck?: BillingCheckResult;
  checkInValidation?: CheckInValidation;
}

/**
 * The linked bill is held separately from the pending/paid lists because those
 * are filtered to today, and an IP bill can belong to an admission that started
 * days ago - relying on the lists would silently drop it.
 */
type DeepLinkState = BillingDeepLink | { status: 'loading' };

function OpdBillingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkBillId = searchParams.get('billId');
  const linkJourneyId = searchParams.get('journeyId');
  const linkPatientId = searchParams.get('patientId');
  const [deepLink, setDeepLink] = useState<DeepLinkState>(
    linkBillId || linkJourneyId ? { status: 'loading' } : { status: 'none' },
  );
  const [deepLinkItems, setDeepLinkItems] = useState<ChargeLineItem[]>([]);
  const [deepLinkItemsLoading, setDeepLinkItemsLoading] = useState(false);
  const [deepLinkItemsError, setDeepLinkItemsError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [deskPatient, setDeskPatient] = useState<Patient | null>(null);
  const [deskSearchBusy, setDeskSearchBusy] = useState(false);
  const [deskSearchError, setDeskSearchError] = useState<string | null>(null);
  const [ipExtras, setIpExtras] = useState<{
    loading: boolean;
    journey: PatientJourneyDetailDto | null;
    summary: Awaited<ReturnType<typeof ipManagementApi.getFinancialSummary>>;
    completeness: ChargeCompleteness | null;
  }>({ loading: false, journey: null, summary: null, completeness: null });

  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Generate Bill state
  const [todayAppointments, setTodayAppointments] = useState<AppointmentForBilling[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentForBilling | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  
  // Payment — CollectPaymentDrawer is the only collect UI (shared with census/discharge).
  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<OpdBill | null>(null);
  const [collectIpSummary, setCollectIpSummary] = useState<
    Awaited<ReturnType<typeof ipManagementApi.getFinancialSummary>>
  >(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditNotes, setCreditNotes] = useState('');

  // usePaymentModes was imported but never called, leaving paymentModeChoices,
  // paymentModesLoading and refundModeChoices undefined - the effect below threw
  // on mount, so this page could not open at all.
  const { modes: paymentModeChoices } = usePaymentModes();

  // RefundMode is the subset of PaymentMode that money can be returned through.
  const refundModeChoices = useMemo(
    () => paymentModeChoices.filter(
      (m): m is typeof m & { apiMode: RefundMode } =>
        (['cash', 'card', 'upi', 'net_banking', 'cheque'] as const)
          .includes(m.apiMode as RefundMode),
    ),
    [paymentModeChoices],
  );
  
  // Finalize Bill state (Phase 1 Critical Gates)
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [billToFinalize, setBillToFinalize] = useState<OpdBill | null>(null);
  const [finalizeCompleteness, setFinalizeCompleteness] = useState<ChargeCompleteness | null>(null);
  const finalizeCompletenessBlocked = Boolean(
    finalizeCompleteness?.warnings?.length
    || (finalizeCompleteness?.implantsMissingCharge ?? 0) > 0
    || (finalizeCompleteness?.consumablesPending ?? 0) > 0
    || (finalizeCompleteness?.exceptionsOpen ?? 0) > 0,
  );
  
  // Refund state (Phase 1 Critical Gates)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [billToRefund, setBillToRefund] = useState<OpdBill | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMode, setRefundMode] = useState<RefundMode>('cash');
  const [refundNotes, setRefundNotes] = useState('');
  const [workstationRefunds, setWorkstationRefunds] = useState<RefundRecord[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState<string | null>(null);
  const [refundAction, setRefundAction] = useState<{
    kind: 'approve' | 'reject' | 'complete';
    refund: RefundRecord;
  } | null>(null);
  const [refundActionNotes, setRefundActionNotes] = useState('');
  const [completeRefundMode, setCompleteRefundMode] = useState<RefundMode>('cash');

  useEffect(() => {
    if (refundModeChoices.length === 0) return;
    if (!refundModeChoices.some((m) => m.apiMode === refundMode)) {
      setRefundMode(refundModeChoices[0].apiMode);
    }
  }, [refundModeChoices, refundMode]);
  
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

  const { user, permissions } = useAuthStore();
  const branchId = user?.branchId || '';
  const billingActions = resolveIpRoleActions(permissions);
  const canCollect = billingActions.canBill;
  const canUpdateBill = billingActions.canBill || billingActions.canAdjustFinance;
  const canRefund = billingActions.canRefund;
  const canAuthorizeRefund = billingActions.canAuthorizeRefund;
  const collectedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  const refreshWorkstation = () => {
    setRefreshNonce((n) => n + 1);
    void loadTodayAppointments();
    void loadPendingBills();
    void loadPaidBills();
  };

  const handleDeskPatient = async (patient: Patient | null) => {
    setDeskPatient(patient);
    setDeskSearchError(null);
    if (!patient) return;
    setDeskSearchBusy(true);
    try {
      const result = await opdBillingApi.getOpdBills({ patientId: patient.id, pageSize: 50 });
      const picked = pickBillForPatient(result.bills || []);
      if (picked) {
        router.replace(`/dashboard/billing/opd?billId=${picked.id}&patientId=${patient.id}`);
        return;
      }
      const uhid = patient.medicalRecordNumber?.trim();
      if (!uhid) {
        setDeskSearchError('This patient does not have a bill yet.');
        return;
      }
      const journeys = await ipManagementApi.listJourneys({ uhid });
      const match = pickJourneyForPatient(journeys, patient.id);
      if (match) {
        router.replace(`/dashboard/billing/opd?journeyId=${match.id}&patientId=${patient.id}`);
        return;
      }
      setDeskSearchError('This patient does not have a bill or IP encounter yet.');
    } catch {
      setDeskSearchError("We couldn't load this patient's bills. Try again.");
    } finally {
      setDeskSearchBusy(false);
    }
  };

  useEffect(() => {
    loadTodayAppointments();
    loadPendingBills();
    loadPaidBills();
  }, [branchId]);

  // Resolve an inbound deep link from IP Management to a specific bill.
  useEffect(() => {
    let cancelled = false;

    if (!linkBillId && !linkJourneyId) {
      setDeepLink({ status: 'none' });
      return;
    }

    (async () => {
      setDeepLink((current) => {
        if (
          current.status === 'ready'
          && shouldRetainReadyBill({
            currentBillId: current.bill.id,
            currentJourneyId: current.bill.patientJourneyId,
            linkBillId,
            linkJourneyId,
          })
        ) {
          return current;
        }
        return { status: 'loading' };
      });
      const result = await resolveBillingDeepLink(
        { billId: linkBillId, journeyId: linkJourneyId },
        {
          getFinancialSummary: id => ipManagementApi.getFinancialSummary(id),
          getOpdBill: id => opdBillingApi.getOpdBill(id),
        },
      );
      if (cancelled) return;

      setDeepLink(result);
      setAsOf(new Date().toISOString());
      if (result.status === 'ready') {
        setSelectedBill(result.bill);
        setActiveTab(result.bill.balanceDue > 0 ? 'pending' : 'paid');
      } else if (result.status === 'no-bill') {
        setActiveTab('generate');
      }
    })();

    return () => { cancelled = true; };
  }, [linkBillId, linkJourneyId, refreshNonce]);

  // Patient-only deep link: open the latest OpdBill for that MPI record.
  useEffect(() => {
    if (!linkPatientId || linkBillId || linkJourneyId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await opdBillingApi.getOpdBills({ patientId: linkPatientId, pageSize: 50 });
        if (cancelled) return;
        const picked = pickBillForPatient(result.bills || []);
        if (picked) {
          router.replace(`/dashboard/billing/opd?billId=${picked.id}&patientId=${linkPatientId}`);
        }
      } catch {
        /* empty workstation remains */
      }
    })();
    return () => { cancelled = true; };
  }, [linkPatientId, linkBillId, linkJourneyId, router]);

  useEffect(() => {
    if (deepLink.status !== 'ready') {
      setDeepLinkItems([]);
      setDeepLinkItemsLoading(false);
      setDeepLinkItemsError(null);
      return;
    }
    const billId = deepLink.bill.id;
    let cancelled = false;
    setDeepLinkItemsLoading(true);
    setDeepLinkItemsError(null);
    opdBillingApi.getBillItems(billId)
      .then((rows) => {
        if (!cancelled) setDeepLinkItems(rows.map(toChargeLine));
      })
      .catch(() => {
        if (!cancelled) {
          setDeepLinkItems([]);
          setDeepLinkItemsError("We couldn't load charge lines. Try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setDeepLinkItemsLoading(false);
      });
    return () => { cancelled = true; };
  }, [deepLink]);

  useEffect(() => {
    if (deepLink.status !== 'ready') {
      setWorkstationRefunds([]);
      setRefundsLoading(false);
      setRefundsError(null);
      return;
    }
    const billId = deepLink.bill.id;
    let cancelled = false;
    setRefundsLoading(true);
    setRefundsError(null);
    refundsApi.getRefundsByBill(billId)
      .then((rows) => {
        if (!cancelled) setWorkstationRefunds(rows.map(normalizeRefund));
      })
      .catch(() => {
        if (!cancelled) {
          setWorkstationRefunds([]);
          setRefundsError("We couldn't load refunds for this bill. Try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setRefundsLoading(false);
      });
    return () => { cancelled = true; };
  }, [deepLink]);

  useEffect(() => {
    if (deepLink.status !== 'ready') {
      setIpExtras({ loading: false, journey: null, summary: null, completeness: null });
      return;
    }
    const journeyId = deepLink.bill.patientJourneyId || linkJourneyId;
    const billId = deepLink.bill.id;
    let cancelled = false;
    setIpExtras((current) => ({ ...current, loading: Boolean(journeyId) }));

    (async () => {
      const [journey, summary, completeness] = await Promise.all([
        journeyId ? ipManagementApi.getJourneyDetail(journeyId) : Promise.resolve(null),
        journeyId ? ipManagementApi.getFinancialSummary(journeyId) : Promise.resolve(null),
        chargeReconciliationApi.getCompleteness(billId, journeyId || undefined).catch(() => null),
      ]);
      if (cancelled) return;
      setIpExtras({
        loading: false,
        journey,
        summary,
        completeness,
      });
    })();

    return () => { cancelled = true; };
  }, [deepLink, linkJourneyId]);

  const backToIpHref = linkJourneyId
    ? `/dashboard/ip-management?patient=${encodeURIComponent(linkJourneyId)}`
    : '/dashboard/ip-management';

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

      if (appointments.length === 0) {
        const allTodayResponse = await appointmentsApi.getAll({
          startDate: today,
          endDate: today
        });
        const allAppointments = allTodayResponse?.data?.items || [];
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
        toast('Free visit - No payment required. Patient can proceed to check-in.');
      } else if (canCollect) {
        setSelectedBill(bill);
        setCollectOpen(true);
      }
    } catch (error: any) {
      console.error('Error generating bill:', error);
      toast.error(error.response?.data?.message || 'Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCredit = async () => {
    if (!selectedBill) return;
    
    try {
      setLoading(true);
      await opdBillingApi.applyCredit({
        opdBillId: selectedBill.id,
        creditNotes: creditNotes.trim() || 'Credit approved for later payment',
      });
      
      toast.success('Credit applied - Patient can proceed to check-in');
      setCreditDialogOpen(false);
      setSelectedBill(null);
      setCreditNotes('');
      
      await Promise.all([loadPendingBills(), loadPaidBills()]);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to apply credit';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeBill = async () => {
    if (!billToFinalize) return;
    if (finalizeCompletenessBlocked) {
      toast.error('Cannot finalize until charges are posted or mapped.');
      return;
    }
    
    try {
      setLoading(true);
      await opdBillingApi.finalizeBill(billToFinalize.id);
      
      toast.success('Bill finalized - No further edits allowed');
      setFinalizeDialogOpen(false);
      setBillToFinalize(null);
      setFinalizeCompleteness(null);
      refreshWorkstation();
    } catch (error: any) {
      console.error('Error finalizing bill:', error);
      toast.error(error.response?.data?.message || 'Failed to finalize bill');
    } finally {
      setLoading(false);
    }
  };

  const openFinalizeDialog = async (bill: OpdBill) => {
    setBillToFinalize(bill);
    setFinalizeCompleteness(null);
    setFinalizeDialogOpen(true);
    try {
      const completeness = await chargeReconciliationApi.getCompleteness(bill.id);
      setFinalizeCompleteness(completeness);
    } catch {
      setFinalizeCompleteness(null);
    }
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
      await refundsApi.requestRefund(buildRequestRefundRequest({
        opdBillId: billToRefund.id,
        refundAmount: amount,
        refundReason: refundReason.trim(),
        refundMode,
        notes: refundNotes.trim() || undefined,
      }));

      toast.success('Refund request submitted for authorization');
      setRefundDialogOpen(false);
      resetRefundForm();
      refreshWorkstation();
    } catch (error: any) {
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

  const openRefundAction = (
    kind: 'approve' | 'reject' | 'complete',
    refund: RefundRecord,
  ) => {
    setRefundAction({ kind, refund });
    setRefundActionNotes('');
    const mode = refund.refundMode as RefundMode;
    if ((['cash', 'card', 'upi', 'net_banking', 'cheque'] as const).includes(mode)) {
      setCompleteRefundMode(mode);
    }
  };

  const handleRefundAction = async () => {
    if (!refundAction) return;
    try {
      setLoading(true);
      if (refundAction.kind === 'complete') {
        await refundsApi.completeRefund({
          refundId: refundAction.refund.id,
          refundMode: completeRefundMode,
          notes: refundActionNotes.trim() || undefined,
        });
        toast.success('Refund posted to the payment ledger');
      } else {
        await refundsApi.authorizeRefund({
          refundId: refundAction.refund.id,
          approved: refundAction.kind === 'approve',
          notes: refundActionNotes.trim() || undefined,
        });
        toast.success(
          refundAction.kind === 'approve'
            ? 'Refund authorized. Complete payout to post the ledger line.'
            : 'Refund rejected',
        );
      }
      setRefundAction(null);
      setRefundActionNotes('');
      refreshWorkstation();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Refund action failed');
    } finally {
      setLoading(false);
    }
  };

  const resetRefundForm = () => {
    setBillToRefund(null);
    setRefundAmount('');
    setRefundReason('');
    setRefundMode('cash');
    setRefundNotes('');
  };

  const openCollectDrawer = (bill: OpdBill) => {
    setSelectedBill(bill);
    setCollectOpen(true);
  };

  const openCreditDialog = (bill: OpdBill) => {
    setSelectedBill(bill);
    setCreditNotes('');
    setCreditDialogOpen(true);
  };

  const collectJourney = selectedBill ? collectJourneyFromOpdBill(selectedBill) : null;
  const collectObligationSource = collectIpSummary ?? ipExtras.summary;
  const collectSummary: CollectFinSummary = selectedBill
    ? finSummaryFromOpdBill(selectedBill, collectObligationSource)
    : null;

  useEffect(() => {
    if (!collectOpen) return;
    const journeyId = selectedBill?.patientJourneyId;
    if (!journeyId) {
      setCollectIpSummary(null);
      return;
    }
    let cancelled = false;
    void ipManagementApi.getFinancialSummary(journeyId).then((summary) => {
      if (!cancelled) setCollectIpSummary(summary);
    });
    return () => { cancelled = true; };
  }, [collectOpen, selectedBill?.id, selectedBill?.patientJourneyId]);

  const refreshCollectSummary = async (): Promise<CollectFinSummary> => {
    if (!selectedBill) return null;
    const bill = await opdBillingApi.getOpdBill(selectedBill.id);
    setSelectedBill(bill);
    setDeepLink(current => (
      current.status === 'ready' && current.bill.id === bill.id
        ? { status: 'ready', bill }
        : current
    ));
    const journeyId = bill.patientJourneyId;
    const ipSummary = journeyId
      ? await ipManagementApi.getFinancialSummary(journeyId)
      : null;
    setCollectIpSummary(ipSummary);
    await Promise.all([loadPendingBills(), loadPaidBills()]);
    return finSummaryFromOpdBill(bill, ipSummary);
  };

  const onCollected = () => {
    void Promise.all([loadPendingBills(), loadPaidBills()]);
    if (selectedBill) {
      void opdBillingApi.getOpdBill(selectedBill.id).then(bill => {
        setSelectedBill(bill);
        setDeepLink(current => (
          current.status === 'ready' && current.bill.id === bill.id
            ? { status: 'ready', bill }
            : current
        ));
      }).catch(() => { /* keep last known bill */ });
    }
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
    <div className="ip-target staff-page staff-page-stack">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start">
        <div className="min-w-0">
          {(linkJourneyId || linkBillId || linkPatientId) && (
            <Link
              href={backToIpHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to IP Management
            </Link>
          )}
          <h1 className="text-xl font-semibold">IP Billing</h1>
          <p className="text-muted-foreground text-sm">
            Authoritative OpdBill workstation — charges, payments, and the next permitted collection
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full lg:w-auto lg:max-w-xl">
          <div
            className="flex-1 min-w-[16rem]"
            data-testid={WORKSTATION_TEST_IDS.search}
            aria-label="Search patient for billing"
          >
            <PatientSearchCombobox
              value={deskPatient}
              onChange={(p) => { void handleDeskPatient(p); }}
              placeholder="Search patient by name, UHID, or phone"
            />
          </div>
          <Button
            data-testid={WORKSTATION_TEST_IDS.refresh}
            onClick={refreshWorkstation}
            disabled={loading || deskSearchBusy}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading || deskSearchBusy ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {deskSearchBusy && (
        <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening this patient&apos;s bill…
        </p>
      )}
      {deskSearchError && (
        <p className="text-sm text-red-800 flex items-center gap-2" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {deskSearchError}
        </p>
      )}

      {deepLink.status === 'none' && !deskSearchBusy && (
        <Card data-testid={WORKSTATION_TEST_IDS.empty}>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Search for a patient, open a bill from Pending, or follow a link from IP Census / Ward.
          </CardContent>
        </Card>
      )}

      {deepLink.status === 'loading' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-blue-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening the bill you selected…
          </CardContent>
        </Card>
      )}

      {deepLink.status === 'error' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-red-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{deepLink.message}</span>
          </CardContent>
        </Card>
      )}

      {deepLink.status === 'no-bill' && (
        <Card className="border-amber-200 bg-amber-50/50" data-testid={WORKSTATION_TEST_IDS.noBill}>
          <CardContent className="p-4 flex items-start gap-3 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">This patient does not have a bill yet.</p>
              <p className="text-amber-800">
                Nothing has been charged on the OpdBill ledger. Generate an OPD bill below if this is an outpatient visit.
                IP charge capture is not performed on this workstation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {deepLink.status === 'ready' && (
        <>
        <IpBillingWorkstation
          bill={deepLink.bill}
          journey={ipExtras.journey}
          journeyLoading={ipExtras.loading}
          ipSummary={ipExtras.summary}
          completeness={ipExtras.completeness}
          items={deepLinkItems}
          itemsLoading={deepLinkItemsLoading}
          itemsError={deepLinkItemsError}
          canCollect={canCollect}
          canUpdateBill={canUpdateBill}
          asOf={asOf}
          onCollect={() => openCollectDrawer(deepLink.bill)}
          onFinalize={() => { void openFinalizeDialog(deepLink.bill); }}
          onAddItem={() => setAddItemOpen(true)}
          onDiscount={() => setDiscountOpen(true)}
          onPrint={() => window.print()}
          onRetryItems={() => setRefreshNonce((n) => n + 1)}
          refunds={workstationRefunds}
          refundsLoading={refundsLoading}
          refundsError={refundsError}
          canRefund={canRefund}
          canAuthorizeRefund={canAuthorizeRefund}
          onRequestRefund={() => openRefundDialog(deepLink.bill)}
          onApproveRefund={(refund) => openRefundAction('approve', refund)}
          onRejectRefund={(refund) => openRefundAction('reject', refund)}
          onCompleteRefund={(refund) => openRefundAction('complete', refund)}
        />
        <AddBillItemDialog
          open={addItemOpen}
          onOpenChange={setAddItemOpen}
          opdBillId={deepLink.bill.id}
          billNumber={deepLink.bill.billNumber}
          currentNet={Number(deepLink.bill.netAmount) || 0}
          currentDue={Number(deepLink.bill.balanceDue) || 0}
          onAdded={() => {
            toast.success('Item posted to the OpdBill ledger');
            refreshWorkstation();
          }}
        />
        <ApplyDiscountDialog
          open={discountOpen}
          onOpenChange={setDiscountOpen}
          opdBillId={deepLink.bill.id}
          billNumber={deepLink.bill.billNumber}
          grossAmount={Number(deepLink.bill.grossAmount) || 0}
          netAmount={Number(deepLink.bill.netAmount) || 0}
          onApplied={() => {
            toast.success('Discount posted to the OpdBill ledger');
            refreshWorkstation();
          }}
        />
        </>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 staff-kpi-grid">
        <Card>
          <CardContent className="staff-kpi-pad flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unbilled Today</p>
              <p className="staff-kpi-value font-bold">{todayAppointments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="staff-kpi-pad flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payment</p>
              <p className="staff-kpi-value font-bold">{pendingBills.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="staff-kpi-pad flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid Today</p>
              <p className="staff-kpi-value font-bold">{paidBills.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="staff-kpi-pad flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <IndianRupee className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Collection</p>
              <p className="staff-kpi-value font-bold">
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
                              variant="outline"
                              data-testid="billing-opd-open-workstation"
                              onClick={() => router.replace(`/dashboard/billing/opd?billId=${bill.id}`)}
                            >
                              Open
                            </Button>
                            {canCollect && (
                            <Button 
                              size="sm"
                              data-testid="billing-opd-collect"
                              onClick={() => openCollectDrawer(bill)}
                              disabled={bill.isFinalized && bill.balanceDue === 0}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {bill.isFinalized ? 'View' : 'Collect'}
                            </Button>
                            )}
                            {canCollect && !bill.isFinalized && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid="billing-opd-credit"
                              onClick={() => openCreditDialog(bill)}
                            >
                              Allow credit
                            </Button>
                            )}
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
                            {canRequestRefundOnBill(bill, canRefund) && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                data-testid={REFUND_TEST_IDS.trigger}
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid="billing-opd-open-workstation"
                              onClick={() => router.replace(`/dashboard/billing/opd?billId=${bill.id}`)}
                            >
                              Open
                            </Button>
                            <Button size="sm" variant="outline">
                              <Printer className="h-4 w-4 mr-2" />
                              Print Receipt
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

      {collectJourney && (
        <CollectPaymentDrawer
          open={collectOpen}
          onOpenChange={setCollectOpen}
          journey={collectJourney}
          finSummary={collectSummary}
          canCreateBill={false}
          initialKind="Payment"
          collectedBy={collectedBy}
          billingHref={selectedBill ? `/dashboard/billing/opd?billId=${selectedBill.id}` : '/dashboard/billing/opd'}
          onCollected={onCollected}
          onRefreshSummary={refreshCollectSummary}
        />
      )}

      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Allow credit</DialogTitle>
            <DialogDescription>
              {selectedBill ? (
                <>Approve later payment on bill <strong>{selectedBill.billNumber}</strong>. This is not a cash collection.</>
              ) : (
                'Approve later payment on this bill.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="credit-notes">Notes</Label>
            <Textarea
              id="credit-notes"
              value={creditNotes}
              onChange={(e) => setCreditNotes(e.target.value)}
              placeholder="Reason for credit..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleApplyCredit()} disabled={loading || !selectedBill}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve credit
            </Button>
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
              {finalizeCompleteness?.warnings?.length ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
                  <p className="text-sm text-red-800 font-medium">Charges may be incomplete</p>
                  {finalizeCompleteness.warnings.map((w) => (
                    <p key={w} className="text-sm text-red-700">{w}</p>
                  ))}
                  <p className="text-xs text-red-600">
                    Cannot finalize until these charges are posted or mapped. Late charges cannot be added after lock.
                  </p>
                </div>
              ) : null}
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
              disabled={loading || finalizeCompletenessBlocked}
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
        <DialogContent className="sm:max-w-[550px]" data-testid={REFUND_TEST_IDS.dialog}>
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
                  data-testid={REFUND_TEST_IDS.amount}
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
                data-testid={REFUND_TEST_IDS.reason}
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
              data-testid={REFUND_TEST_IDS.submit}
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

      <WorkstationRefundActionDialog
        action={refundAction}
        notes={refundActionNotes}
        refundMode={completeRefundMode}
        modeChoices={refundModeChoices}
        submitting={loading}
        onNotesChange={setRefundActionNotes}
        onModeChange={setCompleteRefundMode}
        onClose={() => {
          setRefundAction(null);
          setRefundActionNotes('');
        }}
        onConfirm={() => { void handleRefundAction(); }}
      />
    </div>
  );
}

export default function OpdBillingPage() {
  // useSearchParams opts the subtree into client-side rendering, which the App
  // Router requires be wrapped in a Suspense boundary.
  return (
    <ProtectedRoute requiredAnyPermission={[...BILLING_DESK_VIEW_PERMISSIONS]}>
      <Suspense
        fallback={
          <div className="p-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading billing…
          </div>
        }
      >
        <OpdBillingPageInner />
      </Suspense>
    </ProtectedRoute>
  );
}

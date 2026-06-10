'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Globe,
  IndianRupee,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMasterValues } from '@/hooks/use-master-values';

export type PaymentMode = 'cash' | 'card' | 'upi' | 'online' | 'insurance' | 'credit';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentData) => void;
  billAmount: number;
  billNumber?: string;
  patientName?: string;
  balanceDue?: number;
}

export interface PaymentData {
  paymentMode: PaymentMode;
  amount: number;
  // Card details
  cardLastFour?: string;
  cardNetwork?: string;
  cardTransactionId?: string;
  // UPI details
  upiId?: string;
  upiTransactionId?: string;
  // Online details
  gatewayName?: string;
  gatewayTransactionId?: string;
  // Insurance details
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceClaimNumber?: string;
  // General
  notes?: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-800' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-100 text-blue-800' },
  { value: 'upi', label: 'UPI', icon: Smartphone, color: 'bg-purple-100 text-purple-800' },
  {
    value: 'online',
    label: 'Online',
    icon: Globe,
    color: 'bg-indigo-100 text-indigo-800',
  },
  {
    value: 'insurance',
    label: 'Insurance',
    icon: Building2,
    color: 'bg-orange-100 text-orange-800',
  },
  {
    value: 'credit',
    label: 'Credit',
    icon: AlertCircle,
    color: 'bg-yellow-100 text-yellow-800',
  },
];

const CARD_NETWORKS = ['Visa', 'Mastercard', 'RuPay', 'American Express', 'Diners Club'];

const MASTER_TO_DIALOG_MODE: Record<string, PaymentMode> = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  ONLINE: 'online',
  INSURANCE: 'insurance',
  CREDIT: 'credit',
  NEFT: 'online',
  RTGS: 'online',
  CHEQUE: 'cash',
};

const DIALOG_MODE_META: Record<PaymentMode, { icon: typeof Banknote; color: string }> = {
  cash: { icon: Banknote, color: 'bg-green-100 text-green-800' },
  card: { icon: CreditCard, color: 'bg-blue-100 text-blue-800' },
  upi: { icon: Smartphone, color: 'bg-purple-100 text-purple-800' },
  online: { icon: Globe, color: 'bg-indigo-100 text-indigo-800' },
  insurance: { icon: Building2, color: 'bg-orange-100 text-orange-800' },
  credit: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-800' },
};

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  billAmount,
  billNumber,
  patientName,
  balanceDue,
}) => {
  const { options: paymentModeOptions } = useMasterValues('billing.payment_mode');
  const paymentMethods = useMemo(() => {
    const fromMaster = paymentModeOptions
      .map((o) => {
        const value = MASTER_TO_DIALOG_MODE[o.value.toUpperCase()];
        if (!value) return null;
        const meta = DIALOG_MODE_META[value];
        return { value, label: o.label, icon: meta.icon, color: meta.color };
      })
      .filter((m): m is NonNullable<typeof m> => m != null);
    const seen = new Set<string>();
    const unique = fromMaster.filter((m) => {
      if (seen.has(m.value)) return false;
      seen.add(m.value);
      return true;
    });
    return unique.length > 0 ? unique : PAYMENT_METHODS;
  }, [paymentModeOptions]);

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');

  useEffect(() => {
    if (!paymentMethods.some((m) => m.value === paymentMode)) {
      setPaymentMode(paymentMethods[0]?.value ?? 'cash');
    }
  }, [paymentMethods, paymentMode]);
  const [amount, setAmount] = useState(balanceDue?.toString() || billAmount.toString());
  const [cardDetails, setCardDetails] = useState({
    cardLastFour: '',
    cardNetwork: '',
    cardTransactionId: '',
  });
  const [upiDetails, setUpiDetails] = useState({
    upiId: '',
    upiTransactionId: '',
  });
  const [onlineDetails, setOnlineDetails] = useState({
    gatewayName: '',
    gatewayTransactionId: '',
  });
  const [insuranceDetails, setInsuranceDetails] = useState({
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceClaimNumber: '',
  });
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const availableBalance = balanceDue !== undefined ? balanceDue : billAmount;
    if (parsedAmount > availableBalance) {
      toast.error(`Amount cannot exceed balance due: ₹${availableBalance.toFixed(2)}`);
      return;
    }

    // Validate required fields based on payment mode
    if (paymentMode === 'card') {
      if (!cardDetails.cardLastFour) {
        toast.error('Please enter last 4 digits of card');
        return;
      }
      if (cardDetails.cardLastFour.length !== 4) {
        toast.error('Card last 4 digits must be exactly 4 characters');
        return;
      }
    }

    if (paymentMode === 'upi') {
      if (!upiDetails.upiId || !upiDetails.upiTransactionId) {
        toast.error('Please enter UPI ID and transaction ID');
        return;
      }
    }

    if (paymentMode === 'online') {
      if (!onlineDetails.gatewayTransactionId) {
        toast.error('Please enter gateway transaction ID');
        return;
      }
    }

    if (paymentMode === 'insurance') {
      if (!insuranceDetails.insuranceProvider || !insuranceDetails.insurancePolicyNumber) {
        toast.error('Please enter insurance provider and policy number');
        return;
      }
    }

    const paymentData: PaymentData = {
      paymentMode,
      amount: parsedAmount,
      notes: notes || undefined,
    };

    // Add mode-specific details
    if (paymentMode === 'card') {
      paymentData.cardLastFour = cardDetails.cardLastFour;
      paymentData.cardNetwork = cardDetails.cardNetwork || undefined;
      paymentData.cardTransactionId = cardDetails.cardTransactionId || undefined;
    }

    if (paymentMode === 'upi') {
      paymentData.upiId = upiDetails.upiId;
      paymentData.upiTransactionId = upiDetails.upiTransactionId;
    }

    if (paymentMode === 'online') {
      paymentData.gatewayName = onlineDetails.gatewayName || undefined;
      paymentData.gatewayTransactionId = onlineDetails.gatewayTransactionId;
    }

    if (paymentMode === 'insurance') {
      paymentData.insuranceProvider = insuranceDetails.insuranceProvider;
      paymentData.insurancePolicyNumber = insuranceDetails.insurancePolicyNumber;
      paymentData.insuranceClaimNumber = insuranceDetails.insuranceClaimNumber || undefined;
    }

    onSubmit(paymentData);
  };

  const selectedMethod = paymentMethods.find((m) => m.value === paymentMode);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {billNumber && `Bill: ${billNumber}`}
            {patientName && ` • Patient: ${patientName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Amount Summary */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Bill Amount:</span>
              <span className="font-medium">₹{billAmount.toFixed(2)}</span>
            </div>
            {balanceDue !== undefined && (
              <div className="flex justify-between text-sm font-semibold">
                <span>Balance Due:</span>
                <span className="text-red-600">₹{balanceDue.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div>
            <Label className="mb-3 block">Payment Method</Label>
            <div className="grid grid-cols-3 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMode === method.value;
                return (
                  <button
                    key={method.value}
                    onClick={() => setPaymentMode(method.value as PaymentMode)}
                    className={`
                      p-4 rounded-lg border-2 transition-all
                      ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <Icon
                      className={`h-6 w-6 mx-auto mb-2 ${
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <div className="text-sm font-medium text-center">{method.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <Label>Payment Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                max={balanceDue !== undefined ? balanceDue : billAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                placeholder="Enter amount"
              />
            </div>
          </div>

          {/* Payment Mode Specific Fields */}
          {paymentMode === 'card' && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <h4 className="font-semibold text-sm">Card Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Last 4 Digits *</Label>
                  <Input
                    maxLength={4}
                    placeholder="1234"
                    value={cardDetails.cardLastFour}
                    onChange={(e) =>
                      setCardDetails({ ...cardDetails, cardLastFour: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Card Network</Label>
                  <Select
                    value={cardDetails.cardNetwork}
                    onValueChange={(value) =>
                      setCardDetails({ ...cardDetails, cardNetwork: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_NETWORKS.map((network) => (
                        <SelectItem key={network} value={network}>
                          {network}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Transaction ID (optional)</Label>
                <Input
                  placeholder="Enter transaction ID"
                  value={cardDetails.cardTransactionId}
                  onChange={(e) =>
                    setCardDetails({ ...cardDetails, cardTransactionId: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {paymentMode === 'upi' && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <h4 className="font-semibold text-sm">UPI Details</h4>
              <div>
                <Label>UPI ID *</Label>
                <Input
                  placeholder="user@upi"
                  value={upiDetails.upiId}
                  onChange={(e) => setUpiDetails({ ...upiDetails, upiId: e.target.value })}
                />
              </div>
              <div>
                <Label>Transaction ID *</Label>
                <Input
                  placeholder="Enter UPI transaction ID"
                  value={upiDetails.upiTransactionId}
                  onChange={(e) =>
                    setUpiDetails({ ...upiDetails, upiTransactionId: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {paymentMode === 'online' && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <h4 className="font-semibold text-sm">Online Payment Details</h4>
              <div>
                <Label>Gateway Name</Label>
                <Input
                  placeholder="Razorpay, Paytm, etc."
                  value={onlineDetails.gatewayName}
                  onChange={(e) =>
                    setOnlineDetails({ ...onlineDetails, gatewayName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Transaction ID *</Label>
                <Input
                  placeholder="Enter gateway transaction ID"
                  value={onlineDetails.gatewayTransactionId}
                  onChange={(e) =>
                    setOnlineDetails({
                      ...onlineDetails,
                      gatewayTransactionId: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          {paymentMode === 'insurance' && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <h4 className="font-semibold text-sm">Insurance Details</h4>
              <div>
                <Label>Insurance Provider *</Label>
                <Input
                  placeholder="ICICI Lombard, Star Health, etc."
                  value={insuranceDetails.insuranceProvider}
                  onChange={(e) =>
                    setInsuranceDetails({
                      ...insuranceDetails,
                      insuranceProvider: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Policy Number *</Label>
                <Input
                  placeholder="Enter policy number"
                  value={insuranceDetails.insurancePolicyNumber}
                  onChange={(e) =>
                    setInsuranceDetails({
                      ...insuranceDetails,
                      insurancePolicyNumber: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Claim Number</Label>
                <Input
                  placeholder="Enter claim number (if available)"
                  value={insuranceDetails.insuranceClaimNumber}
                  onChange={(e) =>
                    setInsuranceDetails({
                      ...insuranceDetails,
                      insuranceClaimNumber: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          {paymentMode === 'credit' && (
            <div className="border rounded-lg p-4 bg-yellow-50">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Credit Payment</p>
                  <p className="text-yellow-700 mt-1">
                    Patient will be allowed to proceed without immediate payment. Credit must
                    be approved by authorized personnel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Additional notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {paymentMode === 'credit' ? 'Apply Credit' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

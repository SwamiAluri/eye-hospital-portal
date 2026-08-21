'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Package, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSessionPackages, useCreatePackage, usePackageTemplates } from '@/hooks/use-packages';
import { usePayments, useCreatePayment } from '@/hooks/use-payments';
import type { CounselorPackageDto, PaymentTransaction } from '@/types/counselor';
import { CoveragePaymentTerms } from '@/lib/ip-management/coverage-payment-terminology';

interface FinancialClearanceProps {
  sessionId: string;
  patientId: string;
  patientName?: string;
  onClearanceStatusChange?: () => void;
}

export function FinancialClearance({
  sessionId,
  patientId,
  patientName,
  onClearanceStatusChange,
}: FinancialClearanceProps) {
  // State for dialogs
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  // Package form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customNotes, setCustomNotes] = useState('');
  
  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentFor, setPaymentFor] = useState('Advance');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Fetch data
  const { data: packages = [], isLoading: packagesLoading } = useSessionPackages(sessionId);
  const { data: paymentsResponse, isLoading: paymentsLoading } = usePayments(sessionId, 1, 100);
  const payments = paymentsResponse?.payments || paymentsResponse?.Payments || [];
  const { data: templates = [] } = usePackageTemplates({ isActive: true });

  // Mutations
  const createPackageMutation = useCreatePackage();
  const createPaymentMutation = useCreatePayment();

  // Calculate financial summary
  const activePackage = packages.find((p) => p.packageStatus === 'Active' || p.packageStatus === 'Finalized');
  const totalPackageAmount = activePackage?.finalPrice || 0;
  const completedPayments = payments.filter((p) => p.transactionStatus === 'Completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = totalPackageAmount - totalPaid;
  const hasClearance = totalPackageAmount > 0 && pendingAmount <= 0;

  // Handle package creation
  const handleCreatePackage = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a package template');
      return;
    }

    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const discountAmount = (template.basePrice * discountPercent) / 100;
    const finalPrice = template.basePrice - discountAmount;

    try {
      await createPackageMutation.mutateAsync({
        templateId: selectedTemplateId,
        sessionId,
        patientId,
        packageName: template.packageName,
        finalPrice,
        discountPercent,
        discountAmount,
        counselorNotes: customNotes,
      });

      toast.success('Package created successfully');
      setShowPackageDialog(false);
      setSelectedTemplateId('');
      setDiscountPercent(0);
      setCustomNotes('');
      onClearanceStatusChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create package');
    }
  };

  // Handle payment creation
  const handleCreatePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      await createPaymentMutation.mutateAsync({
        sessionId,
        patientId,
        transactionType: paymentFor as any,
        paymentMethod: paymentMethod as any,
        amount,
        paymentFor: `${paymentFor} Payment`,
        receiptRequired: true,
      });

      toast.success('Payment recorded successfully');
      setShowPaymentDialog(false);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentFor('Advance');
      setPaymentNotes('');
      onClearanceStatusChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to record payment');
    }
  };

  if (packagesLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{CoveragePaymentTerms.patientPaymentStatus}</h3>
        {hasClearance ? (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Patient payment complete
          </Badge>
        ) : (
          <Badge variant="secondary">
            <AlertCircle className="w-4 h-4 mr-1" />
            Outstanding ₹{pendingAmount.toFixed(2)}
          </Badge>
        )}
      </div>

      {/* Financial Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <DollarSign className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-muted-foreground">Package Amount</p>
            <p className="text-2xl font-bold">₹{totalPackageAmount.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">Amount Paid</p>
            <p className="text-2xl font-bold text-green-600">₹{totalPaid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
            <p className="text-sm text-muted-foreground">Pending Amount</p>
            <p className="text-2xl font-bold text-orange-600">₹{pendingAmount.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* Package Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <h4 className="font-semibold">Surgery Package</h4>
          </div>
          {!activePackage && (
            <Button size="sm" onClick={() => setShowPackageDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Select Package
            </Button>
          )}
        </div>

        {activePackage ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Package Name:</span>
              <span className="font-medium">{activePackage.packageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Base Price:</span>
              <span>₹{activePackage.basePrice.toFixed(2)}</span>
            </div>
            {activePackage.discountPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Discount ({activePackage.discountPercent}%):</span>
                <span className="text-green-600">-₹{activePackage.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Final Price:</span>
              <span>₹{activePackage.finalPrice.toFixed(2)}</span>
            </div>
            <Badge variant={activePackage.packageStatus === 'Finalized' ? 'default' : 'secondary'}>
              {activePackage.packageStatus}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No package selected. Please select a surgery package.
          </p>
        )}
      </Card>

      {/* Payments Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <h4 className="font-semibold">Payments</h4>
          </div>
          {activePackage && pendingAmount > 0 && (
            <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Payment
            </Button>
          )}
        </div>

        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">₹{payment.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.paymentMethod} • {payment.transactionType}
                  </p>
                </div>
                <Badge variant={payment.transactionStatus === 'Completed' ? 'default' : 'secondary'}>
                  {payment.transactionStatus}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payments recorded yet.
          </p>
        )}
      </Card>

      {/* Package Selection Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Surgery Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Package Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a package" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.packageName} - ₹{template.basePrice.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplateId && (
              <>
                <div>
                  <Label>Discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={templates.find((t) => t.id === selectedTemplateId)?.maxDiscountPercent || 100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Input
                    placeholder="Additional notes about package customization"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                  />
                </div>

                {/* Price Calculation */}
                {(() => {
                  const template = templates.find((t) => t.id === selectedTemplateId);
                  if (!template) return null;
                  const discountAmount = (template.basePrice * discountPercent) / 100;
                  const finalPrice = template.basePrice - discountAmount;
                  return (
                    <div className="p-4 bg-gray-50 rounded space-y-2">
                      <div className="flex justify-between">
                        <span>Base Price:</span>
                        <span className="font-medium">₹{template.basePrice.toFixed(2)}</span>
                      </div>
                      {discountPercent > 0 && (
                        <div className="flex justify-between">
                          <span>Discount ({discountPercent}%):</span>
                          <span className="text-green-600">-₹{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Final Price:</span>
                        <span>₹{finalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreatePackage}
                disabled={!selectedTemplateId || createPackageMutation.isPending}
              >
                {createPackageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Create Package
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Collection Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              {pendingAmount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Pending: ₹{pendingAmount.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="NetBanking">Net Banking</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Type</Label>
              <Select value={paymentFor} onValueChange={setPaymentFor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Payment notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreatePayment}
                disabled={createPaymentMutation.isPending}
              >
                {createPaymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

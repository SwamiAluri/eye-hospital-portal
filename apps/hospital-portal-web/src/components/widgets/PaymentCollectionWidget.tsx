/**
 * Payment Collection Widget
 * Payment mode selection, amount entry, transaction processing, and receipt generation
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  CheckCircle2 as Check,
  Printer,
  Activity as RefreshCw,
  Activity,
  Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { widgetsApi } from '@/lib/api/widgets.api';
import type { PaymentMode } from '@/lib/api/opd-billing.api';
import { usePaymentModes } from '@/hooks/use-payment-modes';
import { useTransactionTypes } from '@/hooks/use-billing-masters';

const WIDGET_PAYMENT_ICONS: Partial<Record<PaymentMode, LucideIcon>> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
  net_banking: Building2,
  cheque: Building2,
  insurance: CreditCard,
  wallet: Smartphone,
};

interface PaymentLink {
  url: string;
  qrCode: string;
  expiresAt: Date;
}

export default function PaymentCollectionWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const [amount, setAmount] = useState<string>((data as any)?.amount || '');
  const { modes: paymentModeChoices, loading: paymentModesLoading } = usePaymentModes();
  const { types: transactionTypes } = useTransactionTypes();
  const [transactionType, setTransactionType] = useState<string>(
    (data as any)?.transactionType || 'PAYMENT',
  );
  const [selectedMode, setSelectedMode] = useState<PaymentMode>((data as any)?.paymentMode || 'cash');
  const [transactionRef, setTransactionRef] = useState<string>((data as any)?.transactionRef || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [receiptGenerated, setReceiptGenerated] = useState(false);
  const [balanceDue, setBalanceDue] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load balance due from payment summary
  useEffect(() => {
    if (patientId) loadBalanceDue();
  }, [patientId]);

  const loadBalanceDue = async () => {
    try {
      setLoading(true);
      const paymentSummary = await widgetsApi.getPaymentSummary(patientId!);
      setBalanceDue(paymentSummary.balanceDue);
    } catch (err) {
      console.error('Failed to load balance:', err);
      setBalanceDue(42100); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [5000, 10000, 20000, balanceDue];

  const paymentModes = useMemo(
    () =>
      paymentModeChoices.map((m) => ({
        id: m.apiMode,
        label: m.label,
        icon: WIDGET_PAYMENT_ICONS[m.apiMode] ?? Banknote,
      })),
    [paymentModeChoices],
  );

  useEffect(() => {
    if (paymentModeChoices.length === 0) return;
    const valid = paymentModeChoices.some((m) => m.apiMode === selectedMode);
    if (!valid) setSelectedMode(paymentModeChoices[0].apiMode);
  }, [paymentModeChoices, selectedMode]);

  useEffect(() => {
    if (transactionTypes.length === 0) return;
    const valid = transactionTypes.some((t) => t.value === transactionType);
    if (!valid) setTransactionType(transactionTypes[0].value);
  }, [transactionTypes, transactionType]);

  const handleGeneratePaymentLink = () => {
    // Mock payment link generation
    const link: PaymentLink = {
      url: `https://pay.hospital.com/${patientId}/xyz123`,
      qrCode: 'data:image/svg+xml;base64,PHN2Zy...', // Mock QR code
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    };
    setPaymentLink(link);
    onAction?.({
      type: 'PAYMENT_LINK_GENERATED',
      payload: { link },
      timestamp: new Date(),
    });
  };

  const handleCollectPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    setIsProcessing(true);

    try {
      // API call to collect payment
      await widgetsApi.collectPayment({
        patientId: patientId!,
        amount: parseFloat(amount),
        mode: selectedMode,
        transactionRef,
        sessionId: sessionId || '',
      });

      setReceiptGenerated(true);
      
      onAction?.({
        type: 'PAYMENT_COLLECTED',
        payload: {
          amount: parseFloat(amount),
          mode: selectedMode,
          transactionRef,
        },
        timestamp: new Date(),
      });

      // Reload balance
      await loadBalanceDue();
    } catch (err) {
      console.error('Payment collection failed:', err);
      alert('Payment collection failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Activity className="h-6 w-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading payment info...</span>
      </div>
    );
  }

  const handlePrintReceipt = () => {
    onAction?.({ type: 'PRINT_RECEIPT', timestamp: new Date() });
  };

  if (!patientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
        <DollarSign className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No patient selected</p>
        <p className="text-xs text-gray-400 mt-1">Select a patient to collect payment</p>
      </div>
    );
  }

  const isCompact = size === 'small';

  if (isCompact) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">Quick Payment</p>
        <div className="bg-orange-50 rounded p-2 border border-orange-200">
          <p className="text-xs text-gray-600">Balance Due</p>
          <p className="text-lg font-bold text-orange-600">₹{balanceDue.toLocaleString()}</p>
        </div>
        <button
          className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Collect Payment
        </button>
      </div>
    );
  }

  if (receiptGenerated) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <Check className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-900 mb-1">Payment Successful!</p>
          <p className="text-sm text-gray-600">Amount: ₹{parseFloat(amount).toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Receipt generated successfully</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePrintReceipt}
            className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
          <button
            onClick={() => {
              setReceiptGenerated(false);
              setAmount('');
              setTransactionRef('');
            }}
            className="py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            New Payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance Due Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Current Balance Due</p>
            <p className="text-2xl font-bold text-orange-600">₹{balanceDue.toLocaleString()}</p>
          </div>
          <DollarSign className="h-8 w-8 text-orange-400" />
        </div>
      </div>

      {/* Transaction Type */}
      <div className="border border-gray-200 rounded-lg p-3">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Transaction Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {transactionTypes.map((t) => {
            const isSelected = transactionType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTransactionType(t.value)}
                className={cn(
                  'py-2 px-3 text-xs font-medium rounded-lg border transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Entry */}
      <div className="border border-gray-200 rounded-lg p-3">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Enter Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full pl-8 pr-3 py-3 text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt.toString())}
              className="py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-400 transition-colors"
            >
              {amt === balanceDue ? 'Full' : `₹${(amt / 1000).toFixed(0)}k`}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Mode Selection */}
      <div className="border border-gray-200 rounded-lg p-3">
        <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Mode</label>
        {paymentModesLoading ? (
          <p className="text-xs text-gray-500">Loading payment modes…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {paymentModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <Icon className={cn('h-6 w-6', isSelected ? 'text-blue-600' : 'text-gray-600')} />
                  <span className={cn('text-sm font-medium', isSelected ? 'text-gray-900' : 'text-gray-600')}>
                    {mode.label}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-green-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Reference (for card/UPI/netbanking) */}
      {selectedMode !== 'cash' && (
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Transaction Reference / UTR Number
          </label>
          <input
            type="text"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="Enter transaction reference"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Payment Link Option (for UPI/netbanking) */}
      {(selectedMode === 'upi' || selectedMode === 'netbanking') && !paymentLink && (
        <button
          onClick={handleGeneratePaymentLink}
          className="w-full py-2 border-2 border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          Generate Payment Link / QR Code
        </button>
      )}

      {/* Payment Link Display */}
      {paymentLink && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
          <p className="text-sm font-semibold text-gray-900 mb-2">Payment Link Generated</p>
          <div className="bg-white rounded p-2 mb-2">
            <p className="text-xs text-gray-600 break-all">{paymentLink.url}</p>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Copy Link
            </button>
            <button className="flex-1 py-1.5 text-xs border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors">
              Show QR Code
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Expires in {Math.ceil((paymentLink.expiresAt.getTime() - Date.now()) / 60000)} minutes
          </p>
        </div>
      )}

      {/* Collect Payment Button */}
      <button
        onClick={handleCollectPayment}
        disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
        className={cn(
          'w-full py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2',
          !amount || parseFloat(amount) <= 0 || isProcessing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        )}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Collect Payment
          </>
        )}
      </button>

      {/* Recent Transactions Link */}
      <button
        onClick={() => onAction?.({ type: 'VIEW_TRANSACTION_HISTORY', timestamp: new Date() })}
        className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
      >
        View Transaction History
      </button>
    </div>
  );
}

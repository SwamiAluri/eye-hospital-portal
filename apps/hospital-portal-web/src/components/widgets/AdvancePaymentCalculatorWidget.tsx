/**
 * Advance Payment Calculator Widget
 * Displays package cost breakdown for Cash patients (50% advance, 50% balance)
 * READ-ONLY - No payment collection, just information display
 */

'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, Activity as Calculator, AlertCircle, Activity as Loader, Activity as CreditCard, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/lib/widgets/widget-types';
import { useCounselingSession } from '@/hooks/use-counseling-sessions';
import { toast } from '@/lib/toast';

export default function AdvancePaymentCalculatorWidget({
  widgetId,
  patientId,
  sessionId,
  size,
  isMinimized,
  data,
  onAction,
  onDataChange,
}: WidgetProps) {
  const { data: session, isLoading } = useCounselingSession(sessionId || '', {
    enabled: !!sessionId,
  });

  const [packageAmount, setPackageAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [balanceAmount, setBalanceAmount] = useState<number>(0);

  useEffect(() => {
    if (session?.packageAmount) {
      const total = session.packageAmount;
      const advance = Math.round(total * 0.5); // 50% advance
      const balance = total - advance;

      setPackageAmount(total);
      setAdvanceAmount(advance);
      setBalanceAmount(balance);

      onDataChange?.({
        packageAmount: total,
        advanceAmount: advance,
        balanceAmount: balance,
      });
    }
  }, [session]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-6">
        <Loader className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading payment details...</p>
      </div>
    );
  }

  // No session
  if (!sessionId || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Calculator className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No active session</p>
        <p className="text-xs text-gray-400 mt-1">Session required to calculate advance payment</p>
      </div>
    );
  }

  // No package selected
  if (!packageAmount || packageAmount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <AlertCircle className="h-12 w-12 text-orange-300 mb-3" />
        <p className="text-sm text-gray-500">No package selected</p>
        <p className="text-xs text-gray-400 mt-1">Please select a package to calculate advance payment</p>
      </div>
    );
  }

  // Compact view
  const isCompact = size === 'small' || isMinimized;
  if (isCompact) {
    return (
      <div className="space-y-2 p-3">
        <p className="text-xs text-gray-500 font-medium">Advance Payment</p>
        <div className="bg-yellow-50 rounded-lg p-3 border-2 border-yellow-200">
          <p className="text-sm text-gray-600">Advance Required</p>
          <p className="text-2xl font-bold text-yellow-700">₹{advanceAmount.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">50% of package cost</p>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Advance Payment Calculation</h3>
          <p className="text-sm text-gray-500">Cash Payment - 50% advance required</p>
        </div>
      </div>

      {/* Package Cost Breakdown */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200">
        <div className="space-y-3">
          {/* Total Package Cost */}
          <div className="flex items-center justify-between pb-3 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Total Package Cost</span>
            </div>
            <span className="text-lg font-bold text-gray-900">₹{packageAmount.toLocaleString()}</span>
          </div>

          {/* Advance Required (50%) */}
          <div className="bg-yellow-50 rounded-lg p-3 border-2 border-yellow-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-700" />
                <span className="text-sm font-semibold text-yellow-900">Advance Required (50%)</span>
              </div>
              <span className="text-2xl font-bold text-yellow-700">₹{advanceAmount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-yellow-800 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              To be paid before surgery scheduling
            </p>
          </div>

          {/* Balance Due (50%) */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Balance Due (50%)</span>
                <p className="text-xs text-gray-500 mt-1">Payable before admission</p>
              </div>
              <span className="text-xl font-bold text-gray-900">₹{balanceAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-2">Payment Instructions</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <strong>Advance payment (₹{advanceAmount.toLocaleString()})</strong> required before surgery scheduling</li>
              <li>• <strong>Balance amount (₹{balanceAmount.toLocaleString()})</strong> due before admission</li>
              <li>• Proceed to <strong>Billing Desk</strong> for payment collection</li>
              <li>• Counselors <strong>do not collect payments</strong> - only provide cost information</li>
              <li>• Payment receipt required for surgery scheduling</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            toast.info('Instructing patient to proceed to billing desk...', {
              description: 'Counselor to guide patient to billing counter for payment',
            });
            onAction?.({
              type: 'PROCEED_TO_BILLING',
              payload: {
                advanceAmount,
                balanceAmount,
                packageAmount,
              },
              timestamp: new Date(),
            });
          }}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Guide Patient to Billing Desk
        </button>

        <button
          onClick={() => {
            // Copy breakdown to clipboard
            const breakdown = `Payment Breakdown\n\nTotal Package: ₹${packageAmount.toLocaleString()}\nAdvance (50%): ₹${advanceAmount.toLocaleString()}\nBalance (50%): ₹${balanceAmount.toLocaleString()}`;
            navigator.clipboard.writeText(breakdown);
            toast.success('Payment breakdown copied to clipboard');
          }}
          className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          Copy Payment Breakdown
        </button>
      </div>

      {/* Additional Info */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> All payments are collected by the billing department. Counselors provide cost information and guidance only.
        </p>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import type { Settlement } from '../../lib/api/ccms/ccms-settlements.api';
import { CheckCircle2, Clock } from 'lucide-react';

interface Props {
  settlement: Settlement;
}

export function SettlementReceipt({ settlement: s }: Props) {
  const isReconciled = !!s.reconciledAt;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isReconciled
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Clock className="w-4 h-4 text-yellow-500" />}
          <p className="text-sm font-bold text-gray-800">{s.settlementNumber}</p>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          isReconciled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>{isReconciled ? 'Reconciled' : s.status}</span>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-[10px] text-blue-400">Settled</p>
          <p className="text-xs font-bold text-blue-800">₹{s.settledAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-2">
          <p className="text-[10px] text-orange-400">Deduction</p>
          <p className="text-xs font-bold text-orange-800">₹{s.deductionAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-[10px] text-green-400">Net Received</p>
          <p className="text-xs font-bold text-green-800">₹{s.netReceivedAmount.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Details */}
      {(s.paymentMode || s.utrNumber || s.settledAt) && (
        <div className="text-[11px] text-gray-500 space-y-0.5">
          {s.paymentMode && <p>Mode: <span className="font-medium text-gray-700">{s.paymentMode}</span></p>}
          {s.utrNumber   && <p>UTR: <span className="font-medium text-gray-700">{s.utrNumber}</span></p>}
          {s.settledAt   && <p>Date: <span className="font-medium text-gray-700">{new Date(s.settledAt).toLocaleDateString('en-IN')}</span></p>}
        </div>
      )}
    </div>
  );
}

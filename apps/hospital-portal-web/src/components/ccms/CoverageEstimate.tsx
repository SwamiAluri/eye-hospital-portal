'use client';

import React from 'react';

interface Props {
  estimatedAmount: number;
  approvedAmount?: number;
  coveredAmount?: number;
  patientPayable?: number;
  nonPayableAmount?: number;
}

export function CoverageEstimate({ estimatedAmount, approvedAmount, coveredAmount, patientPayable, nonPayableAmount }: Props) {
  const covered   = coveredAmount ?? approvedAmount ?? 0;
  const patient   = patientPayable ?? Math.max(0, estimatedAmount - covered);
  const nonPayable= nonPayableAmount ?? 0;
  const pct       = estimatedAmount > 0 ? Math.round((covered / estimatedAmount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Insurance covers {pct}%</span>
          <span>₹{covered.toLocaleString('en-IN')} / ₹{estimatedAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400">Estimated Total</p>
          <p className="text-sm font-bold text-gray-800">₹{estimatedAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2.5">
          <p className="text-[10px] text-green-500">Insurance Covered</p>
          <p className="text-sm font-bold text-green-800">₹{covered.toLocaleString('en-IN')}</p>
        </div>
        {nonPayable > 0 && (
          <div className="bg-orange-50 rounded-lg p-2.5">
            <p className="text-[10px] text-orange-500">Non-Payable</p>
            <p className="text-sm font-bold text-orange-800">₹{nonPayable.toLocaleString('en-IN')}</p>
          </div>
        )}
        <div className="bg-red-50 rounded-lg p-2.5">
          <p className="text-[10px] text-red-500">Patient Payable</p>
          <p className="text-sm font-bold text-red-800">₹{patient.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
}

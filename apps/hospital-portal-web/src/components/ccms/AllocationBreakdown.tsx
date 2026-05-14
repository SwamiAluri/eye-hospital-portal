'use client';

import React from 'react';
import type { BillAllocation } from '../../lib/api/ccms/ccms-billing.api';

interface Props {
  allocation: BillAllocation;
}

export function AllocationBreakdown({ allocation: a }: Props) {
  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-[10px] text-blue-500 mb-0.5">Total Bill</p>
          <p className="text-sm font-bold text-blue-800">₹{a.totalBillAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-[10px] text-green-500 mb-0.5">Insurance Covered</p>
          <p className="text-sm font-bold text-green-800">₹{a.coveredAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-[10px] text-orange-500 mb-0.5">Patient Payable</p>
          <p className="text-sm font-bold text-orange-800">₹{a.patientPayableTotal.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Line items */}
      {a.lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Item</th>
                <th className="py-1.5 pr-3 font-medium text-right">Total</th>
                <th className="py-1.5 pr-3 font-medium text-right">Covered</th>
                <th className="py-1.5 pr-3 font-medium text-right">Non-payable</th>
                <th className="py-1.5 font-medium text-right">Patient</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {a.lines.map((line, i) => (
                <tr key={i} className="text-gray-700">
                  <td className="py-1.5 pr-3 truncate max-w-[180px]" title={line.description}>{line.description}</td>
                  <td className="py-1.5 pr-3 text-right">₹{line.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="py-1.5 pr-3 text-right text-green-700">₹{line.coveredAmount.toLocaleString('en-IN')}</td>
                  <td className="py-1.5 pr-3 text-right text-orange-600">₹{line.nonPayableAmount.toLocaleString('en-IN')}</td>
                  <td className="py-1.5 text-right text-red-600">₹{line.patientPayable.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { PreAuthStatusBadge } from './PreAuthStatusBadge';
import type { CoverageCase } from '../../lib/api/ccms/ccms-coverage-cases.api';

interface Props {
  case_: CoverageCase;
  isLoading?: boolean;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-500 shrink-0 mr-3">{label}</span>
      <span className="text-[11px] font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

export function CaseSummaryPanel({ case_: c, isLoading }: Props) {
  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-40" />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-800">{c.caseNumber}</p>
        <PreAuthStatusBadge state={c.currentState} />
      </div>

      <Row label="Payer Type"   value={c.payerType} />
      <Row label="Payment Mode" value={c.paymentType} />
      {c.membershipNumber && <Row label="Membership No." value={c.membershipNumber} />}
      {c.policyNumber     && <Row label="Policy No."     value={c.policyNumber} />}
      {c.estimatedAmount != null && (
        <Row label="Estimated" value={`₹${c.estimatedAmount.toLocaleString('en-IN')}`} />
      )}
      {c.approvedAmount != null && c.approvedAmount > 0 && (
        <Row label="Approved" value={
          <span className="text-green-700 font-bold">₹{c.approvedAmount.toLocaleString('en-IN')}</span>
        } />
      )}
      {c.patientPayableAmount != null && (
        <Row label="Patient Payable" value={
          <span className="text-red-600 font-bold">₹{c.patientPayableAmount.toLocaleString('en-IN')}</span>
        } />
      )}
      <Row label="Created" value={new Date(c.createdAt).toLocaleDateString('en-IN')} />
    </div>
  );
}

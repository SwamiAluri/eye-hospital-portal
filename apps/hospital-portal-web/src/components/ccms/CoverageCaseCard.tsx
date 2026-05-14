'use client';

import React from 'react';
import Link from 'next/link';
import { PreAuthStatusBadge } from './PreAuthStatusBadge';
import type { CoverageCase } from '../../lib/api/ccms/ccms-coverage-cases.api';

interface Props {
  case_: CoverageCase;
  href?: string;
}

export function CoverageCaseCard({ case_: c, href }: Props) {
  const inner = (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-800">{c.caseNumber}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{c.payerType} · {c.paymentType}</p>
        </div>
        <PreAuthStatusBadge state={c.currentState} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
        {c.estimatedAmount != null && (
          <div>
            <span className="block text-gray-400">Estimated</span>
            <span className="font-semibold text-gray-700">
              ₹{c.estimatedAmount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
        {c.approvedAmount != null && c.approvedAmount > 0 && (
          <div>
            <span className="block text-gray-400">Approved</span>
            <span className="font-semibold text-green-700">
              ₹{c.approvedAmount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
        <div>
          <span className="block text-gray-400">Created</span>
          <span>{new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
        <div>
          <span className="block text-gray-400">Updated</span>
          <span>{new Date(c.updatedAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

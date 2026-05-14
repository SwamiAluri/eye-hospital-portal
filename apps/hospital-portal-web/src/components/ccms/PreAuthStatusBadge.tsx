'use client';

import React from 'react';
import type { CcmsState } from '../../lib/api/ccms/ccms-coverage-cases.api';

const STATE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  DRAFT:                   { label: 'Draft',                bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400'   },
  ELIGIBILITY_VERIFIED:    { label: 'Verified',             bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500'   },
  PREAUTH_GENERATED:       { label: 'Pre-Auth Sent',        bg: 'bg-indigo-100',  text: 'text-indigo-700', dot: 'bg-indigo-500' },
  WAITING_APPROVAL:        { label: 'Waiting Approval',     bg: 'bg-yellow-100',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  APPROVED:                { label: 'Approved',             bg: 'bg-green-100',   text: 'text-green-700',  dot: 'bg-green-500'  },
  PARTIAL_APPROVAL:        { label: 'Partial Approval',     bg: 'bg-teal-100',    text: 'text-teal-700',   dot: 'bg-teal-500'   },
  REJECTED:                { label: 'Rejected',             bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-500'    },
  CLARIFICATION_REQUIRED:  { label: 'Clarification Needed', bg: 'bg-orange-100',  text: 'text-orange-700', dot: 'bg-orange-500' },
  RESUBMITTED:             { label: 'Resubmitted',          bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500' },
  EXPIRED:                 { label: 'Expired',              bg: 'bg-gray-200',    text: 'text-gray-500',   dot: 'bg-gray-400'   },
  CANCELLED:               { label: 'Cancelled',            bg: 'bg-gray-200',    text: 'text-gray-500',   dot: 'bg-gray-400'   },
  ABORTED:                 { label: 'Aborted',              bg: 'bg-gray-200',    text: 'text-gray-500',   dot: 'bg-gray-400'   },
};

interface Props {
  state: CcmsState | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function PreAuthStatusBadge({ state, size = 'sm', showDot = true }: Props) {
  const cfg = STATE_CONFIG[state] ?? {
    label: state,
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  };

  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const px = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded ${textSize} ${px} ${cfg.bg} ${cfg.text}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}

'use client';

import React from 'react';
import { Clock, CheckCircle, AlertCircle, XCircle, RefreshCw, HelpCircle, Send } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const PROCESS_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: <Clock className="w-3 h-3" />,
  },
  docs_awaited: {
    label: 'Docs Awaited',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  query_raised: {
    label: 'Query Raised',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    icon: <HelpCircle className="w-3 h-3" />,
  },
  partial_response: {
    label: 'Partial Response',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  query_responded: {
    label: 'Responded',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    icon: <Send className="w-3 h-3" />,
  },
  resubmitted: {
    label: 'Resubmitted',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  approved_with_conditions: {
    label: 'Approved (Conditions)',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: <XCircle className="w-3 h-3" />,
  },
  escalated: {
    label: 'Escalated',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  processStatus?: string | null;
  size?: 'xs' | 'sm';
  showIcon?: boolean;
  className?: string;
}

export function ProcessStatusBadge({
  processStatus,
  size = 'xs',
  showIcon = true,
  className = '',
}: Props) {
  if (!processStatus) return null;

  const cfg = PROCESS_STATUS_CONFIG[processStatus.toLowerCase()] ?? {
    label:   processStatus,
    color:   'text-gray-600',
    bgColor: 'bg-gray-100',
    icon:    <Clock className="w-3 h-3" />,
  };

  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium
        ${cfg.color} ${cfg.bgColor} ${sizeClasses} ${className}`}
    >
      {showIcon && cfg.icon}
      {cfg.label}
    </span>
  );
}

export function getProcessStatusLabel(processStatus?: string | null): string {
  if (!processStatus) return '';
  return PROCESS_STATUS_CONFIG[processStatus.toLowerCase()]?.label ?? processStatus;
}

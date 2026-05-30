'use client';

import React from 'react';
import {
  FileEdit, Clock, ShieldCheck, Folder, AlertCircle, SendHorizonal,
  Loader2, MessageCircleQuestion, RotateCcw, CheckCircle2, CheckCircle,
  XCircle, Ban, TimerOff, CalendarCheck, Activity, Scissors,
  ClipboardList, Send, RefreshCw, Landmark, Scale, Archive,
  ClipboardCheck, HelpCircle,
} from 'lucide-react';
import type { CcmsState } from '../../lib/api/ccms/ccms-coverage-cases.api';

type BadgeCfg = {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
};

const STATE_CONFIG: Record<string, BadgeCfg> = {
  // Intake
  DRAFT:                   { label: 'Draft',                icon: FileEdit,             bg: 'bg-gray-100',        text: 'text-gray-600',    ring: 'ring-gray-200'    },
  ELIGIBILITY_PENDING:     { label: 'Eligibility Check',    icon: Clock,                bg: 'bg-amber-50',        text: 'text-amber-700',   ring: 'ring-amber-200'   },
  ELIGIBILITY_VERIFIED:    { label: 'Eligibility Verified', icon: ShieldCheck,          bg: 'bg-blue-50',         text: 'text-blue-700',    ring: 'ring-blue-200'    },
  POLICY_CAPTURED:         { label: 'Policy Captured',      icon: Folder,               bg: 'bg-blue-50',         text: 'text-blue-700',    ring: 'ring-blue-200'    },
  AUTHORIZATION_REQUIRED:  { label: 'Auth Required',        icon: AlertCircle,          bg: 'bg-amber-50',        text: 'text-amber-700',   ring: 'ring-amber-200'   },
  // Pre-auth track
  PREAUTH_GENERATED:       { label: 'Ready to Send',        icon: ClipboardList,        bg: 'bg-indigo-50',       text: 'text-indigo-700',  ring: 'ring-indigo-200'  },
  PREAUTH_SENT:            { label: 'Sent to TPA',          icon: SendHorizonal,        bg: 'bg-indigo-50',       text: 'text-indigo-700',  ring: 'ring-indigo-200'  },
  WAITING_APPROVAL:        { label: 'Awaiting TPA',         icon: Loader2,              bg: 'bg-yellow-50',       text: 'text-yellow-700',  ring: 'ring-yellow-200'  },
  CLARIFICATION_REQUIRED:  { label: 'Clarification Needed', icon: MessageCircleQuestion,bg: 'bg-orange-50',       text: 'text-orange-700',  ring: 'ring-orange-200'  },
  RESUBMITTED:             { label: 'Resubmitted',          icon: RotateCcw,            bg: 'bg-purple-50',       text: 'text-purple-700',  ring: 'ring-purple-200'  },
  // Approval
  APPROVED:                { label: 'Approved',             icon: CheckCircle2,         bg: 'bg-green-50',        text: 'text-green-700',   ring: 'ring-green-200'   },
  PARTIAL_APPROVAL:        { label: 'Partial Approval',     icon: CheckCircle,          bg: 'bg-teal-50',         text: 'text-teal-700',    ring: 'ring-teal-200'    },
  // Terminal negative
  REJECTED:                { label: 'Rejected',             icon: XCircle,              bg: 'bg-red-50',          text: 'text-red-700',     ring: 'ring-red-200'     },
  EXPIRED:                 { label: 'Expired',              icon: TimerOff,             bg: 'bg-gray-100',        text: 'text-gray-500',    ring: 'ring-gray-200'    },
  CANCELLED:               { label: 'Cancelled',            icon: Ban,                  bg: 'bg-gray-100',        text: 'text-gray-500',    ring: 'ring-gray-200'    },
  ABORTED:                 { label: 'Aborted',              icon: Ban,                  bg: 'bg-gray-100',        text: 'text-gray-500',    ring: 'ring-gray-200'    },
  // Admission / clinical
  ADMISSION_READY:         { label: 'Admission Ready',      icon: CalendarCheck,        bg: 'bg-teal-50',         text: 'text-teal-700',    ring: 'ring-teal-200'    },
  ADMITTED:                { label: 'Admitted',             icon: Activity,             bg: 'bg-teal-50',         text: 'text-teal-700',    ring: 'ring-teal-200'    },
  SURGERY_SCHEDULED:       { label: 'Surgery Scheduled',    icon: CalendarCheck,        bg: 'bg-cyan-50',         text: 'text-cyan-700',    ring: 'ring-cyan-200'    },
  SURGERY_COMPLETED:       { label: 'Surgery Done',         icon: Scissors,             bg: 'bg-cyan-50',         text: 'text-cyan-700',    ring: 'ring-cyan-200'    },
  // Billing / claim
  BILL_PENDING:            { label: 'Bill Pending',         icon: ClipboardList,        bg: 'bg-amber-50',        text: 'text-amber-700',   ring: 'ring-amber-200'   },
  BILL_FINALIZED:          { label: 'Bill Finalized',       icon: ClipboardCheck,       bg: 'bg-blue-50',         text: 'text-blue-700',    ring: 'ring-blue-200'    },
  CLAIM_READY:             { label: 'Claim Ready',          icon: Send,                 bg: 'bg-indigo-50',       text: 'text-indigo-700',  ring: 'ring-indigo-200'  },
  CLAIM_SUBMITTED:         { label: 'Claim Submitted',      icon: Send,                 bg: 'bg-indigo-50',       text: 'text-indigo-700',  ring: 'ring-indigo-200'  },
  CLAIM_IN_PROCESS:        { label: 'Claim Processing',     icon: RefreshCw,            bg: 'bg-yellow-50',       text: 'text-yellow-700',  ring: 'ring-yellow-200'  },
  // Settlement
  SETTLEMENT_PENDING:      { label: 'Settlement Pending',   icon: Clock,                bg: 'bg-blue-50',         text: 'text-blue-700',    ring: 'ring-blue-200'    },
  PARTIAL_SETTLEMENT:      { label: 'Partial Settlement',   icon: Scale,                bg: 'bg-teal-50',         text: 'text-teal-700',    ring: 'ring-teal-200'    },
  FULL_SETTLEMENT:         { label: 'Fully Settled',        icon: Landmark,             bg: 'bg-green-50',        text: 'text-green-700',   ring: 'ring-green-200'   },
  RECONCILED:              { label: 'Reconciled',           icon: CheckCircle2,         bg: 'bg-green-50',        text: 'text-green-700',   ring: 'ring-green-200'   },
  CLOSED:                  { label: 'Closed',               icon: Archive,              bg: 'bg-gray-100',        text: 'text-gray-500',    ring: 'ring-gray-200'    },
};

interface Props {
  state: CcmsState | string;
  processStatus?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function PreAuthStatusBadge({ state, size = 'sm' }: Props) {
  const safeState = (state ?? '').toUpperCase().replace(/-/g, '_');
  const cfg: BadgeCfg = STATE_CONFIG[safeState] ?? {
    label: (state ?? 'Unknown').replace(/_/g, ' '),
    icon: HelpCircle,
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    ring: 'ring-gray-200',
  };

  const Icon = cfg.icon;

  const sizeClasses =
    size === 'xs' ? 'text-[9px] px-1.5 py-0.5 gap-0.5' :
    size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' :
                   'text-xs px-2.5 py-1 gap-1';

  const iconSize =
    size === 'xs' ? 'w-2.5 h-2.5' :
    size === 'sm' ? 'w-3 h-3' :
                   'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ring-1 whitespace-nowrap
        ${sizeClasses} ${cfg.bg} ${cfg.text} ${cfg.ring}`}
    >
      <Icon className={`${iconSize} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

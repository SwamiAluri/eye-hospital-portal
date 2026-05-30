'use client';

import React, { useMemo } from 'react';
import {
  CheckCircle2, Clock, Mail, MessageSquare, Zap, Info, ChevronRight, Send,
} from 'lucide-react';
import type { WorkflowHistoryEntry } from '@/lib/api/ccms/ccms-workflow.api';
import type { CcmsCommunicationLog } from '@/lib/api/ccms/ccms-communications.api';
import type { ApprovalEvent } from '@/lib/api/ccms/ccms-approvals.api';
import { getStateLabel, getTriggerLabel } from '@/lib/api/ccms/ccms-state-labels';

type ActivityKind = 'workflow' | 'communication' | 'event';

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  subtitle?: string;
  detail?: string;
  status?: string;
}

interface Props {
  history: WorkflowHistoryEntry[];
  communications: CcmsCommunicationLog[];
  events: ApprovalEvent[];
  currentState: string;
  loading?: boolean;
  onCompose?: () => void;
}

function channelIcon(channel: string) {
  const c = channel.toLowerCase();
  if (c === 'email') return <Mail className="w-3 h-3" />;
  if (c === 'sms' || c === 'whatsapp') return <MessageSquare className="w-3 h-3" />;
  return <Send className="w-3 h-3" />;
}

export function CaseActivityTimeline({
  history,
  communications,
  events,
  currentState,
  loading,
  onCompose,
}: Props) {
  const items = useMemo(() => {
    const list: ActivityItem[] = [];

    history.forEach((h, i) => {
      list.push({
        id: `wf-${i}`,
        kind: 'workflow',
        at: h.performedAt,
        title: `${getStateLabel(h.fromState)} → ${getStateLabel(h.toState)}`,
        subtitle: getTriggerLabel(h.actionCode),
        detail: h.comment,
      });
    });

    communications.forEach(c => {
      const at = c.sentAt ?? c.createdAt ?? '';
      list.push({
        id: `comm-${c.id}`,
        kind: 'communication',
        at,
        title: `${c.communicationType?.toUpperCase() ?? 'MSG'} to ${c.recipientType}`,
        subtitle: c.subject ?? c.recipientAddress,
        detail: c.bodySummary,
        status: c.deliveryStatus,
      });
    });

    events.forEach(e => {
      list.push({
        id: `evt-${e.id}`,
        kind: 'event',
        at: e.recordedAt ?? e.occurredAt,
        title: `TPA ${e.approvalStatus}`,
        subtitle: e.tpaReferenceNumber,
        detail: e.rejectionReason ?? e.partialApprovalReason,
      });
    });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [history, communications, events]);

  if (loading) {
    return <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Activity</p>
        {onCompose && (
          <button
            type="button"
            onClick={onCompose}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
          >
            + Message TPA / Patient
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No activity yet</p>
        </div>
      ) : (
        <ol className="relative border-l-2 border-gray-100 ml-2 space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {items.map((item, i) => (
            <li key={item.id} className="ml-5 relative">
              <span className={`absolute -left-[21px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${
                item.kind === 'workflow' ? 'bg-emerald-400' :
                item.kind === 'communication' ? 'bg-violet-500' : 'bg-amber-400'
              }`}>
                {item.kind === 'workflow' ? <CheckCircle2 className="w-2.5 h-2.5 text-white" /> :
                 item.kind === 'communication' ? channelIcon(item.subtitle ?? '') :
                 <Zap className="w-2.5 h-2.5 text-white" />}
              </span>
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[11px] font-bold text-gray-700">{item.title}</p>
                {item.subtitle && (
                  <p className="text-[10px] text-indigo-600 font-medium mt-0.5">{item.subtitle}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {item.at ? new Date(item.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  {item.status && (
                    <span className={`ml-1 font-semibold ${item.status === 'sent' ? 'text-green-600' : 'text-red-500'}`}>
                      · {item.status}
                    </span>
                  )}
                </p>
                {item.detail && (
                  <p className="text-[10px] italic text-gray-500 mt-1 border-l-2 border-indigo-200 pl-2 line-clamp-3">
                    {item.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
          <li className="ml-5">
            <span className="absolute -left-[21px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white bg-blue-400">
              <Info className="w-2.5 h-2.5 text-white" />
            </span>
            <div className="bg-blue-50 rounded-xl px-3 py-2">
              <p className="text-[11px] font-bold text-blue-700">
                Current: {getStateLabel(currentState)}
              </p>
            </div>
          </li>
        </ol>
      )}
    </div>
  );
}

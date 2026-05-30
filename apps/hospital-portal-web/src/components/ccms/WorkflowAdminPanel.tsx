'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Settings2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fireTransition, type WorkflowAction } from '@/lib/api/ccms/ccms-workflow.api';
import { ADMIN_ONLY_TRIGGERS, WORKFLOW_ADMIN_HIDDEN_TRIGGERS } from '@/lib/ccms/ccms-next-step';

interface Props {
  actions: WorkflowAction[];
  caseId: string;
  onDone: () => void;
  isWorkflowAdmin: boolean;
  /** Pending pre-auth rows in DB — SEND_PREAUTH via admin skips submit without these */
  pendingPreAuthCount?: number;
}

function isPreAuthOnlyAction(code: string) {
  const c = code.toUpperCase();
  return c === 'SEND_PREAUTH' || c === 'GENERATE_PREAUTH';
}

function isDestructive(code: string) {
  return ['REJECT', 'CANCEL', 'CLOSE', 'WITHDRAW', 'ABORT', 'EXPIRE'].some(k =>
    code.toUpperCase().includes(k),
  );
}

export function WorkflowAdminPanel({ actions, caseId, onDone, isWorkflowAdmin, pendingPreAuthCount = 0 }: Props) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [active, setActive] = useState<WorkflowAction | null>(null);

  if (!isWorkflowAdmin) return null;

  const visibleActions = actions.filter(
    a => !WORKFLOW_ADMIN_HIDDEN_TRIGGERS.has(a.actionCode.toUpperCase()),
  );

  const fire = async (action: WorkflowAction) => {
    if (action.actionCode.toUpperCase() === 'GENERATE_PREAUTH') {
      toast.error('Use Pre-Auth tab → Generate Pre-Auth to create the authorization record.', { duration: 6000 });
      return;
    }
    if (action.actionCode.toUpperCase() === 'SEND_PREAUTH' && pendingPreAuthCount === 0) {
      toast.error(
        'No pending pre-auth in the database. Generate and submit pre-auth on the Pre-Auth tab first — this admin action only advances workflow state.',
        { duration: 7000 },
      );
      return;
    }
    if (action.requiresComment && !comment.trim()) {
      setActive(action);
      return;
    }
    setBusy(action.actionCode);
    try {
      await fireTransition('coverage-case', caseId, {
        actionCode: action.actionCode,
        comment: comment || undefined,
      });
      toast.success(`Admin: ${action.actionLabel} applied`);
      setComment('');
      setActive(null);
      onDone();
    } catch {
      toast.error(`Failed to execute ${action.actionLabel}`);
    } finally {
      setBusy(null);
    }
  };

  const primary = visibleActions.filter((_, i) => i === 0 && !isDestructive(visibleActions[0].actionCode));
  const secondary = visibleActions.filter((a, i) => i > 0 && !isDestructive(a.actionCode));
  const destructive = visibleActions.filter(a => isDestructive(a.actionCode));

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-amber-50 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-widest">
          <Settings2 className="w-3.5 h-3.5" />
          Workflow Admin
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-amber-100">
          <p className="text-[10px] text-amber-700 pt-2 leading-snug">
            Recovery transitions only (expire, cancel, abort). TPA decisions use Pre-Auth → Record Response.
            Generate / Send pre-auth must use the Pre-Auth tab so records and emails are created.
            {destructive.some(a => ADMIN_ONLY_TRIGGERS.has(a.actionCode)) && (
              <> Cancel / Abort / Expire are admin-only.</>
            )}
          </p>

          {!visibleActions.length && (
            <p className="text-xs text-amber-800/80 py-2">
              No manual transitions available for this state — use the tab actions above.
            </p>
          )}

          {active && (
            <div className="bg-white rounded-lg p-2 border border-amber-200 space-y-2">
              <p className="text-xs font-medium text-gray-600">Comment for &ldquo;{active.actionLabel}&rdquo;</p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Enter comment…"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fire(active)}
                  disabled={!comment.trim()}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {[...primary, ...secondary, ...destructive].map(a => (
              <button
                key={a.actionCode}
                type="button"
                onClick={() => fire(a)}
                disabled={busy !== null}
                className={`w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors ${
                  isDestructive(a.actionCode)
                    ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                    : isPreAuthOnlyAction(a.actionCode)
                      ? 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-50'
                    : ADMIN_ONLY_TRIGGERS.has(a.actionCode)
                      ? 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-50'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {busy === a.actionCode ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {a.actionLabel}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

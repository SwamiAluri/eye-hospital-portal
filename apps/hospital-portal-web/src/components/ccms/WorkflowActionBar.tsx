'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fireTransition, type WorkflowAction } from '../../lib/api/ccms/ccms-workflow.api';

interface Props {
  entityType: string;
  entityId: string;
  actions: WorkflowAction[];
  onTransitionComplete?: (newState: string) => void;
}

export function WorkflowActionBar({ entityType, entityId, actions, onTransitionComplete }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!actions.length) return null;

  const execute = async (action: WorkflowAction) => {
    if (action.requiresComment && !comment.trim()) {
      setPendingAction(action);
      return;
    }
    setLoading(action.actionCode);
    setError(null);
    try {
      const result = await fireTransition(entityType, entityId, {
        actionCode: action.actionCode,
        comment: comment.trim() || undefined,
      });
      setComment('');
      setPendingAction(null);
      onTransitionComplete?.(result.currentState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">{error}</p>
      )}

      {pendingAction && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            Comment required for &quot;{pendingAction.actionLabel}&quot;
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="Enter comment…"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map(action => (
          <button
            key={action.actionCode}
            onClick={() => execute(action)}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading === action.actionCode && <Loader2 className="w-3 h-3 animate-spin" />}
            {action.actionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

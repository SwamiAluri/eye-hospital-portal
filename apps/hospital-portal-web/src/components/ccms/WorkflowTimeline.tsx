'use client';

import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { WorkflowHistoryEntry } from '../../lib/api/ccms/ccms-workflow.api';

interface Props {
  history: WorkflowHistoryEntry[];
  currentState: string;
  isLoading?: boolean;
}

export function WorkflowTimeline({ history, currentState, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm animate-pulse">
        Loading timeline…
      </div>
    );
  }

  if (!history.length) {
    return (
      <p className="text-xs text-gray-400 py-4 text-center">No history yet.</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-5">
      {history.map((entry, i) => {
        const isLast = i === history.length - 1;
        return (
          <li key={i} className="ml-4">
            <span className={`absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${isLast ? 'bg-indigo-500' : 'bg-green-400'}`}>
              {isLast
                ? <Clock className="w-2.5 h-2.5 text-white" />
                : <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
            </span>
            <p className="text-[11px] font-semibold text-gray-700">
              {entry.fromState} → {entry.toState}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {entry.actionCode} · {new Date(entry.performedAt).toLocaleString('en-IN')}
              {entry.performedBy && ` · ${entry.performedBy}`}
            </p>
            {entry.comment && (
              <p className="text-[10px] italic text-gray-500 mt-0.5">{entry.comment}</p>
            )}
          </li>
        );
      })}
      {/* Current state indicator */}
      <li className="ml-4">
        <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white bg-blue-300">
          <Circle className="w-2.5 h-2.5 text-white" />
        </span>
        <p className="text-[11px] font-semibold text-blue-600">{currentState} (current)</p>
      </li>
    </ol>
  );
}

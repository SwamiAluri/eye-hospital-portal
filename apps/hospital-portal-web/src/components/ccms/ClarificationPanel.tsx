'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import {
  getClarifications,
  type ClarificationItem,
  type PreAuthorization,
} from '@/lib/api/ccms/ccms-authorizations.api';

interface Props {
  auth: PreAuthorization;
  onGoToComms?: () => void;
}

export function ClarificationPanel({ auth, onGoToComms }: Props) {
  const [items, setItems] = useState<ClarificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getClarifications(auth.id)
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.id]);

  if (loading) {
    return (
      <p className="text-xs text-gray-400 italic flex items-center gap-1">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading clarification thread…
      </p>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          TPA clarification thread
        </p>
        {onGoToComms && (
          <button
            type="button"
            onClick={onGoToComms}
            className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline"
          >
            Reply via Comms →
          </button>
        )}
      </div>
      <ul className="space-y-2 max-h-40 overflow-y-auto">
        {items.map(item => (
          <li key={item.id} className="bg-white rounded-xl border border-amber-100 px-3 py-2 text-xs">
            <p className="font-semibold text-gray-800">{item.clarificationQuery}</p>
            {item.clarificationResponse && (
              <p className="text-gray-600 mt-1 border-t border-gray-100 pt-1">
                <span className="text-[10px] uppercase text-gray-400">Response: </span>
                {item.clarificationResponse}
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              {new Date(item.requestedAt).toLocaleString('en-IN')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

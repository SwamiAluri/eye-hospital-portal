'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ReasonConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  minReasonLength?: number;
  destructive?: boolean;
  patientName?: string;
  patientMeta?: string;
  busy?: boolean;
  error?: string;
  onConfirm: (reason: string) => void | Promise<void>;
}

/**
 * S-17 shared reason-required confirmation. Confirm stays disabled until the
 * reason meets the minimum length. Focus starts on the reason field.
 */
export function ReasonConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  cancelLabel = 'Cancel',
  minReasonLength = 10,
  destructive = false,
  patientName,
  patientMeta,
  busy = false,
  error,
  onConfirm,
}: ReasonConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();
  const trimmed = reason.trim();
  const canConfirm = trimmed.length >= minReasonLength && !busy;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="reason-confirm-dialog" className="ip-target max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {patientName && (
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">{patientName}</p>
              {patientMeta && <p className="text-xs text-gray-500 mt-0.5">{patientMeta}</p>}
            </div>
          )}
          <AlertDialogDescription asChild>
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm text-left ${
                destructive
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              {consequence}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="text-xs font-medium text-gray-700">
            Reason <span className="text-gray-400">(required, minimum {minReasonLength} characters)</span>
          </label>
          <textarea
            ref={inputRef}
            id={reasonId}
            data-testid="reason-confirm-input"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-gray-500">
            Recorded against your user and visible in the journey audit trail.
          </p>
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <button
            type="button"
            data-testid="reason-confirm-submit"
            disabled={!canConfirm}
            onClick={() => void onConfirm(trimmed)}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              destructive
                ? 'border border-red-600 text-red-700 hover:bg-red-50'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

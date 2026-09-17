'use client';

import React, { ReactNode } from 'react';
import { AlertTriangle, Info, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Optional third action (e.g. Leave Without Saving between Cancel and Save & Close). */
  alternateText?: string;
  onAlternate?: () => void | Promise<void>;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  /** Optional E2E hooks */
  dataTestId?: string;
  confirmTestId?: string;
  alternateTestId?: string;
}

const VARIANT_CONFIG = {
  danger: {
    bar: 'bg-rose-500',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    icon: AlertTriangle,
    confirmBg: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500',
  },
  warning: {
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    icon: AlertCircle,
    confirmBg: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  info: {
    bar: 'bg-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    icon: Info,
    confirmBg: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
  },
  success: {
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    icon: CheckCircle,
    confirmBg: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500',
  },
} as const;

/**
 * Confirmation Dialog Component
 * Displays a modal dialog for confirming destructive or important actions
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  alternateText,
  onAlternate,
  variant = 'danger',
  isLoading = false,
  dataTestId,
  confirmTestId,
  alternateTestId,
}: ConfirmationDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Keep dialog open so caller can surface the error; do not navigate away.
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAlternate = async () => {
    if (!onAlternate) return;
    setIsProcessing(true);
    try {
      await onAlternate();
      onClose();
    } catch (error) {
      console.error('Confirmation alternate action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) onClose();
  };

  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;
  const busy = isProcessing || isLoading;
  const hasAlternate = Boolean(alternateText && onAlternate);

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent
        size="sm"
        hideCloseButton
        data-testid={dataTestId}
        aria-describedby={undefined}
        className="p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={`h-1 w-full ${cfg.bar}`} />

        <button
          onClick={handleCancel}
          disabled={busy}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          aria-label="Close"
        >
          <X size={15} />
        </button>

        <div className="px-6 pt-7 pb-6 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center mb-4`}>
            <Icon size={28} className={cfg.iconColor} />
          </div>

          <h3
            id="confirm-dialog-title"
            className="text-base font-bold text-gray-900 mb-1.5"
          >
            {title}
          </h3>

          <div className="text-sm text-gray-500 leading-relaxed">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        <div className={`px-6 pb-6 flex gap-2 ${hasAlternate ? 'flex-col sm:flex-row' : ''}`}>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          {hasAlternate ? (
            <button
              onClick={handleAlternate}
              disabled={busy}
              data-testid={alternateTestId}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {alternateText}
            </button>
          ) : null}
          <button
            onClick={handleConfirm}
            disabled={busy}
            data-testid={confirmTestId}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${cfg.confirmBg}`}
          >
            {busy && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for managing confirmation dialog state
 */
export function useConfirmation() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>>({
    onConfirm: () => {},
    title: '',
    message: '',
  });

  const showConfirmation = (dialogConfig: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
    setConfig(dialogConfig);
    setIsOpen(true);
  };

  const hideConfirmation = () => {
    setIsOpen(false);
  };

  const ConfirmationComponent = () => (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={hideConfirmation}
      {...config}
    />
  );

  return {
    showConfirmation,
    hideConfirmation,
    ConfirmationComponent,
  };
}

/**
 * Quick confirmation dialog for common actions
 */
export function useDeleteConfirmation() {
  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  const confirmDelete = (itemName: string, onConfirm: () => void | Promise<void>) => {
    showConfirmation({
      title: 'Confirm Deletion',
      message: (
        <div>
          <p className="mb-2">Are you sure you want to delete <strong>{itemName}</strong>?</p>
          <p className="text-gray-600">This action cannot be undone.</p>
        </div>
      ),
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm,
    });
  };

  return {
    confirmDelete,
    ConfirmationComponent,
  };
}

/**
 * Quick confirmation dialog for cancel actions
 */
export function useCancelConfirmation() {
  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  const confirmCancel = (message: string, onConfirm: () => void | Promise<void>) => {
    showConfirmation({
      title: 'Confirm Cancellation',
      message,
      confirmText: 'Yes, Cancel',
      cancelText: 'Go Back',
      variant: 'warning',
      onConfirm,
    });
  };

  return {
    confirmCancel,
    ConfirmationComponent,
  };
}

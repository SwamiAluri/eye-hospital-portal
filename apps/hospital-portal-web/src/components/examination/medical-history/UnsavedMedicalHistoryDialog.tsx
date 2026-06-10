'use client';

import { AlertCircle, X } from 'lucide-react';

interface UnsavedMedicalHistoryDialogProps {
  isOpen: boolean;
  isSaving?: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndContinue: () => void | Promise<void>;
}

export function UnsavedMedicalHistoryDialog({
  isOpen,
  isSaving = false,
  onStay,
  onDiscard,
  onSaveAndContinue,
}: UnsavedMedicalHistoryDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mh-unsaved-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onStay} />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-amber-500" />
        <button
          type="button"
          onClick={onStay}
          disabled={isSaving}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Close"
        >
          <X size={15} />
        </button>

        <div className="px-6 pt-7 pb-4 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <AlertCircle size={28} className="text-amber-500" />
          </div>
          <h3 id="mh-unsaved-title" className="text-base font-bold text-gray-900 mb-1.5">
            Unsaved medical history
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            You have unsaved changes in Medical History. Save before leaving, or your changes will be lost.
          </p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onStay}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl disabled:opacity-50"
          >
            Stay on tab
          </button>
          <button
            type="button"
            onClick={() => void onSaveAndContinue()}
            disabled={isSaving}
            className="w-full sm:flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

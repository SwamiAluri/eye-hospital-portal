'use client';

import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  isWillingIntention,
  resolvePatientIntentionOptions,
} from '@/lib/counsellors-desk/patient-intention-defaults';

interface PatientDecisionWidgetProps {
  widgetId: string;
  patientId?: string;
  sessionId?: string;
  data?: Record<string, any>;
  config?: Record<string, any>;
  sessionStage?: string;
  size?: string;
  isMinimized?: boolean;
  isCollapsed?: boolean;
  onChange?: () => void;
  onDataChange?: (data: Record<string, any>) => void;
  onAction?: (action: { type: string; payload?: any; timestamp: Date }) => void;
}

export default function PatientDecisionWidget({
  data,
  onDataChange,
}: PatientDecisionWidgetProps) {
  const { options: intentionMaster } = useMasterValues('counsellor.patient_intention');
  const intentionOptions = useMemo(
    () => resolvePatientIntentionOptions(intentionMaster),
    [intentionMaster],
  );
  const willingOptions = useMemo(
    () => intentionOptions.filter((o) => o.metadata?.category === 'willing'),
    [intentionOptions],
  );
  const notReadyOptions = useMemo(
    () => intentionOptions.filter((o) => o.metadata?.category === 'not_ready'),
    [intentionOptions],
  );

  const selected = (data as any)?.patientIntention as string | undefined;

  const handleSelect = (value: string) => {
    onDataChange?.({ patientIntention: value, confirmed: true });
  };

  const isWilling = isWillingIntention(selected, intentionOptions);
  const selectedLabel = intentionOptions.find((o) => o.value === selected)?.label;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-900">Patient Decision</h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Select the patient&apos;s intent. A selection is required to complete this step.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Selection banner */}
        {selected && (
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold ${
            isWilling
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{isWilling ? 'Willing to Proceed' : 'Not Ready Yet'} — {selectedLabel}</span>
          </div>
        )}

        {/* Willing to Proceed */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Willing to Proceed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {willingOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-150 ${
                  selected === opt.value
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Not Ready Yet */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Not Ready Yet</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {notReadyOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-150 ${
                  selected === opt.value
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

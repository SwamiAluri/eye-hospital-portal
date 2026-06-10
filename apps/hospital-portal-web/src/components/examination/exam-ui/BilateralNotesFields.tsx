'use client';

interface BilateralNotesFieldsProps {
  odValue: string;
  osValue: string;
  onOdChange: (v: string) => void;
  onOsChange: (v: string) => void;
  disabled?: boolean;
  odLabel?: string;
  osLabel?: string;
}

export function BilateralNotesFields({
  odValue,
  osValue,
  onOdChange,
  onOsChange,
  disabled,
  odLabel = 'Notes — Right (OD)',
  osLabel = 'Notes — Left (OS)',
}: BilateralNotesFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
      <div>
        <label className="text-xs font-medium text-blue-700 block mb-1">{odLabel}</label>
        <textarea
          value={odValue}
          onChange={(e) => onOdChange(e.target.value)}
          disabled={disabled}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-emerald-700 block mb-1">{osLabel}</label>
        <textarea
          value={osValue}
          onChange={(e) => onOsChange(e.target.value)}
          disabled={disabled}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
        />
      </div>
    </div>
  );
}

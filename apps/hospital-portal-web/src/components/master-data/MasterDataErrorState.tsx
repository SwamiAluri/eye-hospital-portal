'use client';

import { ShieldAlert, AlertCircle } from 'lucide-react';

type Props = {
  title: string;
  message: string;
  permissionDenied?: boolean;
};

export function MasterDataErrorState({ title, message, permissionDenied = false }: Props) {
  const Icon = permissionDenied ? ShieldAlert : AlertCircle;
  const border = permissionDenied ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50';
  const iconColor = permissionDenied ? 'text-amber-600' : 'text-red-500';

  return (
    <div className={`rounded-xl border px-5 py-8 text-center max-w-lg mx-auto ${border}`}>
      <Icon className={`h-10 w-10 mx-auto mb-3 ${iconColor}`} />
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 mt-2">{message}</p>
    </div>
  );
}

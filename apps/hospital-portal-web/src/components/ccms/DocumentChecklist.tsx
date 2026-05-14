'use client';

import React, { useEffect, useState } from 'react';
import { Check, Upload } from 'lucide-react';

export interface DocumentSlot {
  key: string;
  label: string;
  required: boolean;
  uploadedUrl?: string;
  uploadedAt?: string;
}

interface Props {
  slots: DocumentSlot[];
  caseId: string;
  onUpload?: (key: string, file: File) => Promise<string>;
  readOnly?: boolean;
}

export function DocumentChecklist({ slots, caseId, onUpload, readOnly = false }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [localSlots, setLocalSlots] = useState<DocumentSlot[]>(slots);

  useEffect(() => setLocalSlots(slots), [slots]);

  const handleFile = async (key: string, file: File) => {
    if (!onUpload) return;
    setUploading(key);
    try {
      const url = await onUpload(key, file);
      setLocalSlots(prev =>
        prev.map(s => s.key === key ? { ...s, uploadedUrl: url, uploadedAt: new Date().toISOString() } : s),
      );
    } finally {
      setUploading(null);
    }
  };

  return (
    <ul className="divide-y divide-gray-100">
      {localSlots.map(slot => (
        <li key={slot.key} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            {slot.uploadedUrl
              ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              : <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${slot.required ? 'border-red-400' : 'border-gray-300'}`} />}
            <span className={`text-xs ${slot.uploadedUrl ? 'text-gray-500' : slot.required ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
              {slot.label}
              {slot.required && !slot.uploadedUrl && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          </div>

          {!readOnly && (
            <label className="cursor-pointer flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800">
              {uploading === slot.key
                ? <span className="animate-pulse">Uploading…</span>
                : slot.uploadedUrl
                  ? <span className="text-green-600">Replace</span>
                  : <><Upload className="w-3 h-3" /> Upload</>}
              <input
                type="file"
                className="hidden"
                disabled={uploading !== null}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(slot.key, f);
                }}
              />
            </label>
          )}

          {readOnly && slot.uploadedUrl && (
            <a
              href={slot.uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-indigo-600 hover:underline"
            >
              View
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

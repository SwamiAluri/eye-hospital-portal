'use client';

import React, { useEffect, useState } from 'react';
import { FileCheck2, FileX2, FileText, Upload, Camera, ExternalLink, Trash2, Eye, Loader2 } from 'lucide-react';

export interface DocumentSlot {
  key: string;
  label: string;
  required: boolean;
  accept?: string;
  uploadedUrl?: string;
  uploadedAt?: string;
  docId?: string;
}

interface Props {
  slots: DocumentSlot[];
  caseId: string;
  onUpload?: (key: string, file: File) => Promise<string>;
  onDelete?: (key: string, docId: string) => Promise<void>;
  onPreview?: (slot: DocumentSlot) => void;
  readOnly?: boolean;
  showScanButton?: boolean;
}

export function DocumentChecklist({
  slots,
  caseId: _caseId,
  onUpload,
  onDelete,
  onPreview,
  readOnly = false,
  showScanButton = true,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [localSlots, setLocalSlots] = useState<DocumentSlot[]>(slots);

  useEffect(() => setLocalSlots(slots), [slots]);

  const handleFile = async (key: string, file: File) => {
    if (!onUpload) return;
    setUploading(key);
    try {
      const url = await onUpload(key, file);
      setLocalSlots(prev => prev.map(s => s.key === key ? { ...s, uploadedUrl: url, uploadedAt: new Date().toISOString() } : s));
    } finally { setUploading(null); }
  };

  const handleDelete = async (key: string, docId: string) => {
    if (!onDelete) return;
    setDeleting(key);
    try {
      await onDelete(key, docId);
      setLocalSlots(prev => prev.map(s => s.key === key ? { ...s, uploadedUrl: undefined, uploadedAt: undefined, docId: undefined } : s));
    } finally { setDeleting(null); }
  };

  return (
    <ul className="space-y-1.5">
      {localSlots.map(slot => {
        const isUploaded = !!slot.uploadedUrl;
        const isRequired = slot.required;

        // Left border color
        const borderCls = isUploaded
          ? 'border-l-2 border-emerald-400'
          : isRequired
          ? 'border-l-2 border-red-300'
          : 'border-l-2 border-gray-200';

        // Row background
        const rowBg = isUploaded ? 'bg-emerald-50/40' : isRequired ? 'bg-red-50/30' : 'bg-white';

        // Status icon
        const StatusIcon = isUploaded
          ? () => (
              <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            )
          : isRequired
          ? () => (
              <span className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <FileX2 className="w-3.5 h-3.5 text-red-500" />
              </span>
            )
          : () => (
              <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
              </span>
            );

        return (
          <li
            key={slot.key}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${rowBg} ${borderCls} hover:brightness-95`}
          >
            {/* Left: icon + label */}
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusIcon />
              <div className="min-w-0">
                <p className={`text-xs leading-snug truncate ${
                  isUploaded ? 'text-gray-500 line-through' : isRequired ? 'font-semibold text-gray-800' : 'text-gray-500'
                }`}>
                  {slot.label}
                  {isRequired && !isUploaded && <span className="text-red-500 ml-0.5 no-underline">*</span>}
                </p>
                {slot.uploadedAt && (
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Uploaded {new Date(slot.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>

            {/* Right: actions */}
            {!readOnly && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {isUploaded && onPreview && (
                  <button type="button" onClick={() => onPreview(slot)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                {isUploaded && (
                  <a href={slot.uploadedUrl} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Open">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {isUploaded && slot.docId && onDelete && (
                  <button type="button" disabled={deleting === slot.key}
                    onClick={() => handleDelete(slot.key, slot.docId!)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40" title="Remove">
                    {deleting === slot.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
                {showScanButton && onUpload && (
                  <label className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Scan">
                    {uploading === slot.key
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      : <Camera className="w-3.5 h-3.5" />}
                    <input type="file" className="hidden" accept={slot.accept ?? 'image/*,application/pdf'}
                      capture="environment" disabled={uploading !== null}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(slot.key, f); }} />
                  </label>
                )}
                {onUpload && (
                  <label className={`cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    isUploaded
                      ? 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                      : isRequired
                      ? 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                      : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                  }`}>
                    {uploading === slot.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploaded ? 'Replace' : 'Upload'}
                    <input type="file" className="hidden" accept={slot.accept ?? 'image/*,application/pdf'}
                      disabled={uploading !== null}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(slot.key, f); }} />
                  </label>
                )}
              </div>
            )}

            {readOnly && isUploaded && (
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {onPreview && (
                  <button type="button" onClick={() => onPreview(slot)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <a href={slot.uploadedUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </a>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

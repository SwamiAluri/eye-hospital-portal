'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhotoCapture from '@/components/shared/PhotoCapture';
import { Activity as Upload, X, FileText, Activity as Camera, CheckCircle, AlertCircle, Activity as ImageIcon } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getApi } from '@/lib/api';
import { COUNSELLING_GENERIC_DOCUMENT_TYPES } from '@/lib/api/counseling-sessions.api';

interface UploadedDocumentResult {
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

interface CustomDocumentModalProps {
  sessionId: string;
  requiredDocuments?: string[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (docs: UploadedDocumentResult[]) => void;
}

interface UploadedDocument {
  name: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  documentType: string;
}

const DEFAULT_TYPE = COUNSELLING_GENERIC_DOCUMENT_TYPES[0].id;
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * CustomDocumentModal - Counselling session document upload (optional payment-flow step).
 * Uses certified counselling document types and persists via /counseling/documents/upload.
 */
export function CustomDocumentModal({
  sessionId,
  requiredDocuments = [],
  isOpen,
  onClose,
  onComplete,
}: CustomDocumentModalProps) {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(DEFAULT_TYPE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      uploadedDocuments.forEach((doc) => {
        if (doc.preview && doc.preview.startsWith('blob:') && doc.status !== 'success') {
          URL.revokeObjectURL(doc.preview);
        }
      });
      setUploadedDocuments([]);
      setShowCamera(false);
      setSelectedType(DEFAULT_TYPE);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!COUNSELLING_GENERIC_DOCUMENT_TYPES.some((t) => t.id === selectedType)) {
      toast.error('Select a certified Counselling document type');
      return;
    }

    const validFiles = files.filter((file) => {
      const isValid =
        file.type === 'application/pdf' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/jpg';

      if (!isValid) {
        toast.error(`${file.name}: Only PDF, JPEG, and PNG are allowed`);
        return false;
      }

      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: File too large (max 20MB)`);
        return false;
      }

      return true;
    });

    const newDocuments: UploadedDocument[] = validFiles.map((file) => ({
      name: file.name,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'pending',
      documentType: selectedType,
    }));

    setUploadedDocuments((prev) => [...prev, ...newDocuments]);
  };

  const handleCameraCapture = () => {
    if (!COUNSELLING_GENERIC_DOCUMENT_TYPES.some((t) => t.id === selectedType)) {
      toast.error('Select a certified Counselling document type');
      return;
    }
    setShowCamera(true);
  };

  const handlePhotoCapture = (file: File, preview: string) => {
    const newDocument: UploadedDocument = {
      name: 'Captured Photo',
      file,
      preview,
      status: 'pending',
      documentType: selectedType,
    };

    setUploadedDocuments((prev) => [...prev, newDocument]);
    setShowCamera(false);
    toast.success('Photo captured successfully');
  };

  const handleRemoveDocument = (index: number) => {
    setUploadedDocuments((prev) => {
      const doc = prev[index];
      if (doc.preview && doc.preview.startsWith('blob:')) {
        URL.revokeObjectURL(doc.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDocumentTypeChange = (index: number, documentType: string) => {
    setUploadedDocuments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], documentType };
      return updated;
    });
  };

  const handleUploadAll = async () => {
    if (uploadedDocuments.length === 0) {
      toast.error('No documents to upload');
      return;
    }

    const missingType = uploadedDocuments.some(
      (doc) => !COUNSELLING_GENERIC_DOCUMENT_TYPES.some((t) => t.id === doc.documentType),
    );
    if (missingType) {
      toast.error('Each file needs a certified Counselling document type');
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const successfulDocs: Array<{ name: string; size: number; type: string; previewUrl?: string }> = [];

      const uploadPromises = uploadedDocuments.map(async (doc, index) => {
        if (doc.status === 'success') {
          successfulDocs.push({
            name: doc.file.name,
            size: doc.file.size,
            type: doc.file.type,
            previewUrl: doc.preview,
          });
          return;
        }

        setUploadedDocuments((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: 'uploading' };
          return updated;
        });

        try {
          const api = getApi();
          const formData = new FormData();
          formData.append('file', doc.file);
          formData.append('sessionId', sessionId);
          formData.append('documentType', doc.documentType);
          formData.append('documentName', doc.file.name);

          await api.post('/counseling/documents/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          setUploadedDocuments((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: 'success' };
            return updated;
          });
          successfulDocs.push({
            name: doc.file.name,
            size: doc.file.size,
            type: doc.file.type,
            previewUrl: doc.preview,
          });
          successCount++;
        } catch {
          setUploadedDocuments((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: 'error' };
            return updated;
          });
          errorCount++;
        }
      });

      await Promise.all(uploadPromises);

      if (errorCount === 0) {
        toast.success(`${successCount} document(s) uploaded successfully`, {
          description: 'Documents are ready for review',
        });

        setTimeout(() => {
          onClose();
          onComplete?.(successfulDocs);
        }, 1500);
      } else if (successCount > 0) {
        toast.warning(`${successCount} uploaded, ${errorCount} failed`);
      } else {
        toast.error('All uploads failed', {
          description: 'Please check your connection and try again',
        });
      }
    } catch (error: unknown) {
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    if (uploadedDocuments.length > 0) {
      const hasUnsaved = uploadedDocuments.some((doc) => doc.status === 'pending');
      if (hasUnsaved) {
        toast.info('Documents not uploaded will be lost');
      }
    }
    onClose();
  };

  if (!mounted || !isOpen) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createPortal as any)(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        <div className="border-b p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Upload Documents (Optional)</h2>
              <p className="text-sm text-gray-500 mt-1">
                {requiredDocuments.length > 0 ? (
                  <>Upload the following documents for this patient type. You can skip this step and upload later.</>
                ) : (
                  <>Upload any relevant documents for this session. This step is optional.</>
                )}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" type="button">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {requiredDocuments.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Required Documents:</h4>
                <ul className="space-y-1">
                  {requiredDocuments.map((doc, i) => (
                    <li key={i} className="text-sm text-blue-700 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="counselling-document-type" className="text-sm font-medium text-gray-700">
                Document type
              </label>
              <select
                id="counselling-document-type"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                data-testid="counselling-document-type"
              >
                {COUNSELLING_GENERIC_DOCUMENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {showCamera ? (
              <div className="space-y-4">
                <PhotoCapture
                  autoStart
                  label="Document photo"
                  optional={false}
                  onPhotoCapture={handlePhotoCapture}
                  onCancel={() => {
                    setShowCamera(false);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                  >
                    <Camera className="h-8 w-8 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Use Camera</span>
                  </button>

                  <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Upload Files</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadedDocuments.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900">Selected files</h4>
                    {uploadedDocuments.map((doc, index) => (
                      <div
                        key={`${doc.name}-${index}`}
                        className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {doc.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={doc.preview} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              {doc.status === 'success' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <CheckCircle className="h-3 w-3" /> Uploaded
                                </span>
                              ) : doc.status === 'error' ? (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <AlertCircle className="h-3 w-3" /> Failed
                                </span>
                              ) : doc.status === 'uploading' ? (
                                'Uploading…'
                              ) : (
                                'Pending'
                              )}
                            </p>
                          </div>
                        </div>
                        <select
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                          value={doc.documentType}
                          disabled={doc.status === 'success' || doc.status === 'uploading'}
                          onChange={(e) => handleDocumentTypeChange(index, e.target.value)}
                          aria-label={`Document type for ${doc.name}`}
                        >
                          {COUNSELLING_GENERIC_DOCUMENT_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        {doc.status !== 'success' && doc.status !== 'uploading' ? (
                          <button
                            type="button"
                            className="text-sm text-red-600 hover:underline"
                            onClick={() => handleRemoveDocument(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t p-4 flex justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            disabled={uploading}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void handleUploadAll()}
            disabled={uploading || uploadedDocuments.length === 0}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="counselling-document-upload-submit"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

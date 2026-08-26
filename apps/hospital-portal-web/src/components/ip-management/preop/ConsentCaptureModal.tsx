'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import {
  ipManagementApi,
  type PreOpClearanceDetailDto,
  type PreOpCompletionDto,
  type PreOpConsentDetailDto,
  type PreOpDocumentDto,
} from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { normalizeOperativeEye } from '@/lib/ip-management/preop-laterality';

export interface ConsentCaptureItemMeta {
  key: string;
  label: string;
  docType?: string;
  docLabel?: string;
  /** Signed document is mandatory before the consent can be completed. */
  requireUpload?: boolean;
  /** Affirmation checkbox label, e.g. "Signed by patient / legal guardian". Omit to hide. */
  signLabel?: string;
  /** Show witness name + constrained relation (medico-legal co-signatory). */
  showWitness?: boolean;
  /** Show signing method + signed-at (only where it is legally meaningful). */
  showMethod?: boolean;
  /** Show consent form version field. */
  showVersion?: boolean;
  /** Surgery-site row: operative eye (read-only) + "marked by". */
  site?: boolean;
}

export interface ConsentCaptureModalProps {
  open: boolean;
  journeyId: string;
  meta: ConsentCaptureItemMeta;
  completion: PreOpCompletionDto;
  detail?: PreOpConsentDetailDto | null;
  existingDoc?: PreOpDocumentDto | null;
  eyeOperated?: string;
  /** Re-consent: supersede a prior signature (requires a fresh signature / document). */
  reconsent?: boolean;
  onClose: () => void;
  onSaved: (detail: PreOpClearanceDetailDto) => void;
}

const METHOD_OPTIONS = ['Upload', 'ESign', 'Verbal', 'Video'] as const;
const WITNESS_RELATIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Guardian', 'Relative', 'Friend', 'Other'] as const;

function toDateTimeLocal(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ConsentCaptureModal({
  open,
  journeyId,
  meta,
  completion,
  detail,
  existingDoc,
  eyeOperated,
  reconsent = false,
  onClose,
  onSaved,
}: ConsentCaptureModalProps) {
  const [patientSigned, setPatientSigned] = useState(true);
  const [witnessName, setWitnessName] = useState('');
  const [witnessRelation, setWitnessRelation] = useState('');
  const [markedBy, setMarkedBy] = useState('');
  const [lateralityAttested, setLateralityAttested] = useState(false);
  const [consentVersion, setConsentVersion] = useState('');
  const [method, setMethod] = useState<string>('Upload');
  const [signedAt, setSignedAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Seed form whenever the modal is (re)opened for an item.
  useEffect(() => {
    if (!open) return;
    // Re-consent starts from a clean signature; edit pre-fills the prior values.
    setPatientSigned(reconsent ? false : detail?.patientSigned ?? true);
    setWitnessName(reconsent ? '' : detail?.witnessName ?? '');
    setWitnessRelation(reconsent ? '' : detail?.witnessRelation ?? '');
    setMarkedBy(reconsent ? '' : completion.notes ?? '');
    setLateralityAttested(reconsent ? false : !!completion.resultValue?.trim());
    setConsentVersion(reconsent ? '' : detail?.consentVersion ?? '');
    setMethod(detail?.method ?? 'Upload');
    setSignedAt(toDateTimeLocal(reconsent ? null : detail?.signedAt));
    setFile(null);
    setErr(null);
  }, [open, reconsent, detail, completion.notes, completion.resultValue]);

  // A fresh document is required for surgical re-consent (prior PDF no longer counts).
  const docSatisfied = !!file || (!!existingDoc && !reconsent);
  const needsDoc = !!meta.requireUpload && !docSatisfied;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (needsDoc) return false;
    if (meta.signLabel && !patientSigned) return false;
    if (meta.site) {
      if (!markedBy.trim()) return false;
      if (!lateralityAttested) return false;
    }
    return true;
  }, [submitting, needsDoc, meta.signLabel, meta.site, patientSigned, markedBy, lateralityAttested]);

  if (!open) return null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      let documentId = reconsent ? null : completion.documentId ?? null;
      if (file && meta.docType) {
        const base64 = await fileToBase64(file);
        const doc = await ipManagementApi.uploadPreOpDocument(journeyId, {
          documentType: meta.docType,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          fileData: base64,
        });
        if (!doc?.id) throw new Error('Document upload failed. Please retry.');
        documentId = doc.id;
      }

      const updated = await ipManagementApi.captureConsent(journeyId, completion.itemId, {
        patientSigned: meta.signLabel ? patientSigned : true,
        witnessName: meta.showWitness ? witnessName.trim() || null : null,
        witnessRelation: meta.showWitness ? witnessRelation.trim() || null : null,
        // Preserve the surgeon attribution captured elsewhere (no picker here).
        surgeonUserId: detail?.surgeonUserId ?? null,
        consentVersion: meta.showVersion ? consentVersion.trim() || null : detail?.consentVersion ?? null,
        method: meta.showMethod ? method : detail?.method ?? 'Upload',
        signedAt: signedAt ? new Date(signedAt).toISOString() : null,
        documentId,
        notes: meta.site ? markedBy.trim() || null : completion.notes ?? null,
      });

      if (meta.site && eyeOperated) {
        const attestedEye = normalizeOperativeEye(eyeOperated);
        if (attestedEye) {
          await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
            itemId: completion.itemId,
            isCompleted: true,
            isBypassed: false,
            notes: markedBy.trim() || null,
            resultValue: attestedEye,
          });
          const refreshed = await ipManagementApi.getPreOpClearance(journeyId);
          if (refreshed) {
            onSaved(refreshed);
            onClose();
            return;
          }
        }
      }

      onSaved(updated);
      onClose();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e as Error)?.message ??
        'Could not save consent. Please try again.';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const title = reconsent ? `Re-consent — ${meta.label}` : meta.label;

  return (
    <IpOverlayDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      testId={WARD_PREOP_TEST_IDS.consentCaptureModal}
      dismissOnOverlay
      className="max-h-[90vh]"
    >
      <div className="flex max-h-[90vh] flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {reconsent && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>This replaces the previous consent. A fresh signature{meta.requireUpload ? ' and signed document are' : ' is'} required.</span>
            </div>
          )}

          {/* Affirmation */}
          {meta.signLabel && (
            <label className="flex items-center gap-2.5 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={patientSigned}
                onChange={e => setPatientSigned(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {meta.signLabel}
            </label>
          )}

          {/* Surgery-site marking */}
          {meta.site && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Operative eye</span>
                  <div className="rounded-md bg-gray-100 px-2.5 py-1.5 text-sm font-medium text-gray-700">
                    {eyeOperated || '—'}
                  </div>
                </div>
                <Field label="Marked by (initials) *">
                  <input
                    type="text"
                    data-testid={WARD_PREOP_TEST_IDS.consentSiteMarkedBy}
                    value={markedBy}
                    onChange={e => setMarkedBy(e.target.value)}
                    placeholder="e.g. RS"
                    className={inputCls}
                  />
                </Field>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-gray-800">
                <input
                  type="checkbox"
                  data-testid={WARD_PREOP_TEST_IDS.consentLateralityAttest}
                  checked={lateralityAttested}
                  onChange={e => setLateralityAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  I attest the surgery site is correctly marked for{' '}
                  <strong>{normalizeOperativeEye(eyeOperated) ?? eyeOperated ?? 'the scheduled eye'}</strong>{' '}
                  and matches the scheduled procedure.
                </span>
              </label>
            </div>
          )}

          {/* Witness co-signatory */}
          {meta.showWitness && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Witness name">
                <input
                  type="text"
                  value={witnessName}
                  onChange={e => setWitnessName(e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </Field>
              <Field label="Relation to patient">
                <select
                  value={witnessRelation}
                  onChange={e => setWitnessRelation(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select…</option>
                  {WITNESS_RELATIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Method + signed at */}
          {meta.showMethod && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method">
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className={inputCls}
                >
                  {METHOD_OPTIONS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Signed at">
                <input
                  type="datetime-local"
                  value={signedAt}
                  onChange={e => setSignedAt(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {/* Consent version */}
          {meta.showVersion && (
            <Field label="Consent form version">
              <input
                type="text"
                value={consentVersion}
                onChange={e => setConsentVersion(e.target.value)}
                placeholder="e.g. v2.1"
                className={inputCls}
              />
            </Field>
          )}

          {/* Document upload */}
          {meta.docType && (
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {meta.docLabel ?? 'Signed document'}
                {meta.requireUpload && <span className="ml-1 text-red-500">*</span>}
              </span>
              {file ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-700">
                    <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  {existingDoc && !reconsent && (
                    <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <FileText className="h-3.5 w-3.5" /> Current: {existingDoc.fileName}
                    </p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {existingDoc && !reconsent ? `Replace ${meta.docLabel ?? 'document'}` : `Upload ${meta.docLabel ?? 'document'}`}
                  </button>
                </>
              )}
            </div>
          )}

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {err}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            data-testid={WARD_PREOP_TEST_IDS.consentCaptureSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {reconsent ? 'Save re-consent' : 'Save consent'}
          </button>
        </footer>
      </div>
    </IpOverlayDialog>
  );
}

const inputCls =
  'w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

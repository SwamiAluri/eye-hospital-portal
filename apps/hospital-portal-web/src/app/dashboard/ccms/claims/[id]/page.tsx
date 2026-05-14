'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getClaimById,
  generateClaimPacket,
  submitClaim,
  type ClaimPacket,
} from '@/lib/api/ccms/ccms-claims.api';
import { ClaimPacketPreview, PreAuthStatusBadge } from '@/components/ccms';
import type { CcmsState } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { RefreshCw, AlertCircle, ArrowLeft, FileText, Send } from 'lucide-react';

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const claimId = params.id;

  const [claim, setClaim] = useState<ClaimPacket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!claimId) return;
    setLoading(true);
    setError(null);
    getClaimById(claimId)
      .then(setClaim)
      .catch(e => setError(e?.message ?? 'Failed to load claim'))
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(load, [load]);

  const handleGeneratePacket = async () => {
    if (!claim) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await generateClaimPacket(claim.caseId);
      setActionMsg('Claim packet generated successfully.');
      load();
    } catch (e: unknown) {
      setActionMsg(`Error: ${(e as Error)?.message ?? 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!claim) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await submitClaim(claimId, { submittedByUserId: '' });
      setActionMsg('Claim submitted successfully.');
      load();
    } catch (e: unknown) {
      setActionMsg(`Error: ${(e as Error)?.message ?? 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/ccms/claims" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Claim Detail</h1>
              {claim && <p className="text-xs text-gray-500 font-mono">{claim.claimNumber}</p>}
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {actionMsg && (
          <div className={`rounded-xl px-4 py-3 text-sm ${actionMsg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {actionMsg}
          </div>
        )}

        {loading
          ? <div className="animate-pulse bg-gray-200 rounded-xl h-48" />
          : claim
            ? (
                <>
                  <ClaimPacketPreview claim={claim} />

                  {/* Actions */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">Actions</h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleGeneratePacket}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Re-generate Packet
                      </button>
                      {claim.status !== 'SUBMITTED' && claim.status !== 'SETTLED' && (
                        <button
                          onClick={handleSubmit}
                          disabled={actionLoading}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit to Payer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Case link */}
                  <div className="text-center">
                    <Link
                      href={`/dashboard/ccms/cases/${claim.caseId}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      View Full Case →
                    </Link>
                  </div>
                </>
              )
            : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                  Claim not found.
                </div>
              )
        }
      </div>
    </div>
  );
}

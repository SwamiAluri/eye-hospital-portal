'use client';

import React from 'react';
import type { ClaimPacket } from '../../lib/api/ccms/ccms-claims.api';
import { FileText, ExternalLink } from 'lucide-react';

interface Props {
  claim: ClaimPacket;
}

export function ClaimPacketPreview({ claim }: Props) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-bold text-gray-800">{claim.claimNumber}</p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          claim.status === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>{claim.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-gray-400">Claimed Amount</p>
          <p className="font-bold text-gray-800">₹{claim.claimedAmount.toLocaleString('en-IN')}</p>
        </div>
        {claim.submittedAt && (
          <div>
            <p className="text-gray-400">Submitted</p>
            <p className="font-medium text-gray-700">{new Date(claim.submittedAt).toLocaleDateString('en-IN')}</p>
          </div>
        )}
      </div>

      {claim.packetUrl && (
        <a
          href={claim.packetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          <ExternalLink className="w-3 h-3" />
          View Claim Packet
        </a>
      )}
    </div>
  );
}

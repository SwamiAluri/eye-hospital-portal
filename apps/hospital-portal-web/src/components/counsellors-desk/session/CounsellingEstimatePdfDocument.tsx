'use client';

import { useState } from 'react';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import {
  COUNSELLING_ESTIMATE_TERMS,
  COUNSELLING_LETTERHEAD_FALLBACK,
  COUNSELLING_LETTERHEAD_PATH,
  COUNSELLING_LETTERHEAD_PNG_PATH,
  formatEstimateDate,
  formatValidityEn,
  formatValidityTe,
  type CounsellingEstimatePdfData,
} from '@/lib/counsellors-desk/counselling-estimate-pdf-content';

export const COUNSELLING_ESTIMATE_PRINT_ROOT_ID = 'counselling-estimate-print-root';

interface CounsellingEstimatePdfDocumentProps {
  data: CounsellingEstimatePdfData;
}

export function CounsellingEstimatePdfDocument({ data }: CounsellingEstimatePdfDocumentProps) {
  const [letterheadSrc, setLetterheadSrc] = useState(COUNSELLING_LETTERHEAD_PATH);

  return (
    <div
      id={COUNSELLING_ESTIMATE_PRINT_ROOT_ID}
      className="mx-auto max-w-[210mm] bg-counselling-card p-6 text-[11px] leading-relaxed text-gray-900"
    >
      <div className="mb-4 border-b border-counselling-border pb-4">
        <img
          src={letterheadSrc}
          alt={data.hospitalName}
          className="mb-3 h-16 max-w-full object-contain object-left"
          onError={() => {
            if (letterheadSrc === COUNSELLING_LETTERHEAD_PATH) {
              setLetterheadSrc(COUNSELLING_LETTERHEAD_PNG_PATH);
            } else if (letterheadSrc === COUNSELLING_LETTERHEAD_PNG_PATH) {
              setLetterheadSrc(COUNSELLING_LETTERHEAD_FALLBACK);
            }
          }}
        />
        <h1 className="text-base font-bold text-counselling-accent-foreground">Counselling cost estimate</h1>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-gray-600">
          <span>Estimate # {data.estimateNumber}</span>
          <span>Issue date: {formatEstimateDate(data.issueDate)}</span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Patient</p>
          <p className="font-semibold">{data.patientName}</p>
          <p className="text-gray-600">
            UHID {data.uhid}
            {data.age != null && ` · ${data.age}y`}
            {data.gender && ` · ${data.gender}`}
          </p>
          {data.visitDate && (
            <p className="text-gray-600">
              Visit:{' '}
              {new Date(data.visitDate + 'T00:00:00').toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Prepared by</p>
          <p>{data.counsellorName || 'Counselling desk'}</p>
          {data.paymentType && <p className="text-gray-600">Payment: {data.paymentType}</p>}
          {data.doctorRecommendationName && (
            <p className="text-gray-600">Dr. recommends: {data.doctorRecommendationName}</p>
          )}
        </div>
      </div>

      {data.hasDoctorConflict && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">
          Note: Selected procedure/package differs from the doctor&apos;s recommendation.
        </p>
      )}

      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Itemized estimate</p>
      <table className="mb-4 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-counselling-accent text-left">
            <th className="border border-counselling-border px-2 py-1.5">Item</th>
            <th className="border border-counselling-border px-2 py-1.5">Eye</th>
            <th className="border border-counselling-border px-2 py-1.5">Unit</th>
            <th className="border border-counselling-border px-2 py-1.5 text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, idx) => (
              <tr key={`${line.item}-${idx}`} className={idx % 2 === 0 ? 'bg-counselling-card' : 'bg-gray-50/80'}>
                <td className="border border-counselling-border px-2 py-1.5">{line.item}</td>
                <td className="border border-counselling-border px-2 py-1.5">{line.eye}</td>
                <td className="border border-counselling-border px-2 py-1.5">{line.unit}</td>
                <td className="border border-counselling-border px-2 py-1.5 text-right tabular-nums">
                  {line.amount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <div className="mb-4 space-y-1 rounded-lg border border-counselling-border bg-gray-50/80 p-3 text-[10px]">
        <div className="flex justify-between">
          <span>Itemized subtotal</span>
          <span className="font-semibold tabular-nums">{formatInr(data.itemizedSubtotal)}</span>
        </div>
        {data.isPackageMode && data.packageName && (
          <>
            <div className="flex justify-between">
              <span>Package ({data.packageName})</span>
              <span className="font-semibold tabular-nums">{formatInr(data.packageAmount ?? 0)}</span>
            </div>
            {data.bundleSavings > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Bundle savings</span>
                <span className="font-semibold tabular-nums">−{formatInr(data.bundleSavings)}</span>
              </div>
            )}
          </>
        )}
        {data.discountAmount > 0 && (
          <div className="flex justify-between text-red-700">
            <span>Discount{data.discountLabel ? ` (${data.discountLabel})` : ''}</span>
            <span className="font-semibold tabular-nums">−{formatInr(data.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-counselling-border pt-2 text-sm font-bold text-counselling-accent-foreground">
          <span>Final payable</span>
          <span className="tabular-nums">{formatInr(data.finalPayable)}</span>
        </div>
      </div>

      <div className="mb-4 rounded border border-counselling-primary/20 bg-counselling-accent/50 px-3 py-2 text-[10px] text-counselling-accent-foreground">
        <p>{formatValidityEn(data.validityDate)}</p>
        <p className="telugu mt-1">{formatValidityTe(data.validityDate)}</p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Terms &amp; conditions
        </p>
        {COUNSELLING_ESTIMATE_TERMS.map((term, idx) => (
          <div key={idx} className="rounded border border-gray-100 bg-counselling-card p-2">
            <p className="text-[10px] text-gray-800">{term.en}</p>
            <p className="telugu mt-1 text-[10px] text-gray-700">{term.te}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 border-t border-counselling-border pt-3 text-center text-[9px] text-gray-500">
        Computer-generated estimate — {data.hospitalName} · {formatEstimateDate(data.issueDate)}
      </p>
    </div>
  );
}

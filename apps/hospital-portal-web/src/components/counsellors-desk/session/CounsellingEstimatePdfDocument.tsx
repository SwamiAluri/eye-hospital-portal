'use client';

import { useState, type ReactNode } from 'react';
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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="counselling-print-section-title mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
      {children}
    </p>
  );
}

export function CounsellingEstimatePdfDocument({ data }: CounsellingEstimatePdfDocumentProps) {
  const [letterheadSrc, setLetterheadSrc] = useState(COUNSELLING_LETTERHEAD_PATH);
  const isSummary = data.documentKind === 'counselling-summary';
  const title = isSummary
    ? 'Counselling Summary & Cost Estimate'
    : 'Counselling cost estimate';

  return (
    <div
      id={COUNSELLING_ESTIMATE_PRINT_ROOT_ID}
      className="counselling-print-document mx-auto max-w-[210mm] bg-white p-6 text-[11px] leading-relaxed text-gray-900"
    >
      <div className="counselling-print-avoid-break mb-4 border-b border-gray-200 pb-4">
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
        <h1 className="text-base font-bold text-teal-900">{title}</h1>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-gray-600">
          <span>
            {isSummary ? 'Document' : 'Estimate'} # {data.estimateNumber}
          </span>
          <span>Issue date: {formatEstimateDate(data.issueDate)}</span>
          <span>Valid until: {formatEstimateDate(data.validityDate)}</span>
        </div>
      </div>

      <div className="counselling-print-avoid-break mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <SectionHeading>Patient details</SectionHeading>
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
          {data.eyeLabel ? <p className="text-gray-600">Eye: {data.eyeLabel}</p> : null}
        </div>
        <div>
          <SectionHeading>Prepared by</SectionHeading>
          <p>{data.counsellorName || 'Counselling desk'}</p>
          {data.paymentType && !isSummary ? (
            <p className="text-gray-600">Payment: {data.paymentType}</p>
          ) : null}
          {data.doctorRecommendationName && !isSummary ? (
            <p className="text-gray-600">Dr. recommends: {data.doctorRecommendationName}</p>
          ) : null}
        </div>
      </div>

      {isSummary ? (
        <div className="counselling-print-avoid-break mb-4">
          <SectionHeading>Planned treatment</SectionHeading>
          <div className="space-y-1 text-[11px]">
            {data.procedureName || data.packageName ? (
              <p>
                <span className="text-gray-500">Procedure: </span>
                <span className="font-medium">
                  {data.packageName
                    ? `${data.procedureName ? `${data.procedureName} · ` : ''}Package: ${data.packageName}`
                    : data.procedureName}
                </span>
              </p>
            ) : null}
            {data.eyeLabel ? (
              <p>
                <span className="text-gray-500">Eye: </span>
                {data.eyeLabel}
              </p>
            ) : null}
            {data.surgeonName ? (
              <p>
                <span className="text-gray-500">Surgeon: </span>
                {data.surgeonName}
              </p>
            ) : null}
            {data.scheduleSummary ? (
              <p>
                <span className="text-gray-500">Scheduled: </span>
                {data.scheduleSummary}
              </p>
            ) : null}
            {data.operationTheatre &&
            !(data.scheduleSummary && data.scheduleSummary.includes(data.operationTheatre)) ? (
              <p>
                <span className="text-gray-500">OT: </span>
                {data.operationTheatre}
              </p>
            ) : null}
            {data.decisionLabel ? (
              <p>
                <span className="text-gray-500">Decision: </span>
                {data.decisionLabel}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {data.hasDoctorConflict && !isSummary ? (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">
          Note: Selected procedure/package differs from the doctor&apos;s recommendation.
        </p>
      ) : null}

      <SectionHeading>{isSummary ? 'Financial estimate' : 'Itemized estimate'}</SectionHeading>
      <table className="counselling-print-table mb-4 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-teal-50 text-left">
            <th className="border border-gray-300 px-2 py-1.5">Item</th>
            <th className="border border-gray-300 px-2 py-1.5">Eye</th>
            <th className="border border-gray-300 px-2 py-1.5">Unit</th>
            <th className="border border-gray-300 px-2 py-1.5 text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, idx) => (
            <tr key={`${line.item}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}>
              <td className="border border-gray-300 px-2 py-1.5">{line.item}</td>
              <td className="border border-gray-300 px-2 py-1.5">{line.eye}</td>
              <td className="border border-gray-300 px-2 py-1.5">{line.unit}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">
                {line.amount === 0 ? 'Included' : line.amount.toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="counselling-print-totals counselling-print-avoid-break mb-4 space-y-1 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-[10px]">
        <div className="flex justify-between">
          <span>Itemized subtotal</span>
          <span className="font-semibold tabular-nums">{formatInr(data.itemizedSubtotal)}</span>
        </div>
        {data.isPackageMode && data.packageName ? (
          <>
            <div className="flex justify-between">
              <span>Package ({data.packageName})</span>
              <span className="font-semibold tabular-nums">{formatInr(data.packageAmount ?? 0)}</span>
            </div>
            {data.bundleSavings > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Bundle savings</span>
                <span className="font-semibold tabular-nums">−{formatInr(data.bundleSavings)}</span>
              </div>
            ) : null}
          </>
        ) : null}
        {data.discountAmount > 0 ? (
          <div className="flex justify-between text-red-700">
            <span>Discount{data.discountLabel ? ` (${data.discountLabel})` : ''}</span>
            <span className="font-semibold tabular-nums">−{formatInr(data.discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-teal-900">
          <span>Final payable</span>
          <span className="tabular-nums">{formatInr(data.finalPayable)}</span>
        </div>
      </div>

      {isSummary ? (
        <div className="counselling-print-avoid-break mb-4 space-y-3">
          {(data.fundingSource || data.coverageStatusLabel || data.insurerName) && (
            <div>
              <SectionHeading>Insurance / coverage</SectionHeading>
              {data.fundingSource ? (
                <p>
                  <span className="text-gray-500">Funding: </span>
                  {data.fundingSource}
                  {data.insurerName && !data.fundingSource.includes(data.insurerName)
                    ? ` · ${data.insurerName}`
                    : null}
                </p>
              ) : null}
              {data.coverageStatusLabel ? (
                <p className="mt-1">
                  <span className="text-gray-500">Pre-authorization: </span>
                  {data.coverageStatusLabel}
                </p>
              ) : null}
              {data.documentsSummary ? (
                <p className="mt-1">
                  <span className="text-gray-500">Required documents: </span>
                  {data.documentsSummary}
                </p>
              ) : null}
            </div>
          )}

          <div>
            <SectionHeading>Counselling outcome</SectionHeading>
            <p>
              <span className="text-gray-500">Status: </span>
              {data.outcomeLabel || 'Completed'}
            </p>
            {data.decisionLabel ? (
              <p className="mt-1">
                <span className="text-gray-500">Agreed decision: </span>
                {data.decisionLabel}
              </p>
            ) : null}
            {data.notesRecorded != null ? (
              <p className="mt-1 text-gray-600">
                Session notes: {data.notesRecorded ? 'Recorded' : 'Not recorded'}
              </p>
            ) : null}
          </div>

          {data.nextSteps && data.nextSteps.length > 0 ? (
            <div>
              <SectionHeading>Next steps</SectionHeading>
              <ul className="list-disc space-y-1 pl-4">
                {data.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="counselling-print-avoid-break mb-4 rounded border border-teal-200 bg-teal-50/50 px-3 py-2 text-[10px] text-teal-900">
        <p>{formatValidityEn(data.validityDate)}</p>
        <p className="telugu mt-1">{formatValidityTe(data.validityDate)}</p>
      </div>

      <div className="counselling-print-terms space-y-3">
        <SectionHeading>Terms &amp; conditions</SectionHeading>
        {COUNSELLING_ESTIMATE_TERMS.map((term, idx) => (
          <div
            key={idx}
            className="counselling-print-avoid-break rounded border border-gray-100 bg-white p-2"
          >
            <p className="text-[10px] text-gray-800">{term.en}</p>
            <p className="telugu mt-1 text-[10px] text-gray-700">{term.te}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 border-t border-gray-200 pt-3 text-center text-[9px] text-gray-500">
        Computer-generated document — {data.hospitalName} · {formatEstimateDate(data.issueDate)}
        {isSummary ? ' · Counselling Summary & Cost Estimate' : ' · Cost estimate'}
      </p>
    </div>
  );
}

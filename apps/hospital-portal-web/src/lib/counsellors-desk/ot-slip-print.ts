import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import { formatCounsellingTimeDisplay } from '@/lib/counsellors-desk/counselling-time';

export function escapeOtSlipHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayOrDash(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? escapeOtSlipHtml(v) : '—';
}

function formatSurgeryDate(scheduleDate: string | undefined): string {
  if (!scheduleDate) return '—';
  const d = new Date(scheduleDate);
  if (Number.isNaN(d.getTime())) return '—';
  return escapeOtSlipHtml(d.toLocaleDateString('en-IN'));
}

function formatPackageAmount(packageRate: number | undefined): string {
  if (packageRate == null || !Number.isFinite(Number(packageRate))) return '—';
  return escapeOtSlipHtml(`₹${Number(packageRate).toLocaleString('en-IN')}`);
}

function reportingTimeDisplay(rec: FinalizeSurgeryRecord): string {
  const formatted = formatCounsellingTimeDisplay(rec.reportingTime);
  return displayOrDash(formatted || rec.reportingTime);
}

/**
 * Single OT Slip body — same fields as Finalization printOtSlip.
 * One section = one printed page when used in the bulk document.
 */
export function buildOtSlipSectionHtml(
  rec: FinalizeSurgeryRecord,
  options?: { generatedAt?: Date },
): string {
  const generated = (options?.generatedAt ?? new Date()).toLocaleString('en-IN');
  return `<section class="ot-slip" data-schedule-id="${escapeOtSlipHtml(rec.id)}">
<h1>OT Slip</h1>
<table>
<tr><td>Patient Name</td><td>${displayOrDash(rec.patientName)}</td></tr>
<tr><td>UHID</td><td>${displayOrDash(rec.uhid)}</td></tr>
<tr><td>Surgery</td><td>${displayOrDash(rec.surgeryName)}</td></tr>
<tr><td>Eye</td><td>${displayOrDash(rec.eyes)}</td></tr>
<tr><td>Surgeon</td><td>${displayOrDash(rec.surgeon)}</td></tr>
<tr><td>Theatre</td><td>${displayOrDash(rec.theaterName)}</td></tr>
<tr><td>Surgery Date</td><td>${formatSurgeryDate(rec.scheduleDate)}</td></tr>
<tr><td>Start Time</td><td>${displayOrDash(rec.startTime)}</td></tr>
<tr><td>Reporting Time</td><td>${reportingTimeDisplay(rec)}</td></tr>
<tr><td>Anesthesia</td><td>${displayOrDash(rec.anesthesiaType)}</td></tr>
<tr><td>Package</td><td>${displayOrDash(rec.packageName)}</td></tr>
<tr><td>Package Amount</td><td>${formatPackageAmount(rec.packageRate)}</td></tr>
<tr><td>Patient Type</td><td>${displayOrDash(rec.patientType)}</td></tr>
<tr><td>Payment Mode</td><td>${displayOrDash(rec.paymentMode)}</td></tr>
<tr><td>Status</td><td>${displayOrDash(rec.status)}</td></tr>
</table>
<p class="footer">Generated: ${escapeOtSlipHtml(generated)}</p>
</section>`;
}

const OT_SLIP_DOCUMENT_STYLES = `
@page{size:A4;margin:12mm;}
body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:13px;color:#0f172a;}
.ot-slip{padding:20px;page-break-after:always;break-after:page;}
.ot-slip:last-child{page-break-after:auto;break-after:auto;}
h1{font-size:15px;text-align:center;color:#1e40af;margin:0 0 14px;}
table{width:100%;border-collapse:collapse;}
td{padding:7px 10px;border:1px solid #e2e8f0;}
td:first-child{font-weight:600;background:#f8fafc;width:42%;}
.footer{font-size:10px;color:#94a3b8;text-align:center;margin-top:14px;}
.empty{text-align:center;padding:40px 16px;color:#475569;font-size:13px;}
`.trim();

/**
 * Dedicated multi-slip print document — one OT Slip per selected patient, page-break safe.
 * Does not use Package B Prepared List format.
 */
export function buildOtSlipsPrintDocumentHtml(
  records: FinalizeSurgeryRecord[],
  options?: { generatedAt?: Date },
): string {
  const title =
    records.length <= 1
      ? `OT Slip${records[0] ? ` – ${records[0].patientName}` : ''}`
      : `OT Slips (${records.length})`;

  const body =
    records.length === 0
      ? `<p class="empty" data-testid="ot-slips-print-empty">No OT Prepared surgeries selected for print.</p>`
      : records.map((r) => buildOtSlipSectionHtml(r, options)).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeOtSlipHtml(title)}</title><style>
${OT_SLIP_DOCUMENT_STYLES}
</style></head><body>
${body}
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`;
}

/** Selected OT Prepared rows in worklist order (excludes unselected). */
export function selectedOtPreparedRecordsInOrder(
  worklistOrdered: FinalizeSurgeryRecord[],
  selectedIds: ReadonlySet<string>,
): FinalizeSurgeryRecord[] {
  return worklistOrdered.filter((r) => selectedIds.has(r.id));
}

/** Current-page Select All Visible for OT Prepared print selection. */
export function selectAllVisibleOtPreparedIds(
  visiblePageRows: FinalizeSurgeryRecord[],
): Set<string> {
  return new Set(visiblePageRows.map((r) => r.id));
}

export type OpenOtSlipsPrintDeps = {
  openWindow?: (url: string, target: string, features: string) => Window | null;
};

export function openOtSlipsPrint(
  records: FinalizeSurgeryRecord[],
  deps: OpenOtSlipsPrintDeps = {},
): { opened: boolean; slipCount: number } {
  const openWindow =
    deps.openWindow ??
    ((url, target, features) => window.open(url, target, features));
  const html = buildOtSlipsPrintDocumentHtml(records);
  const w = openWindow('', '_blank', 'width=620,height=540');
  if (!w) return { opened: false, slipCount: records.length };
  w.document.write(html);
  w.document.close();
  return { opened: true, slipCount: records.length };
}

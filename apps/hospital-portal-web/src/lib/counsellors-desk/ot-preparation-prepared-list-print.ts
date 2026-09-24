import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

/** Escape text for dedicated print HTML (printOtSlip-style windows). */
export function escapeOtPrepPrintHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Display surgery date for OT Preparation prepared-list print header. */
export function formatOtPrepPrintSurgeryDate(surgeryDate: string): string {
  const day = (surgeryDate ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—';
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Stable operational sort: SequenceNo ascending, then patient name. */
export function sortOtPreparedForPrint(
  records: FinalizeSurgeryRecord[],
): FinalizeSurgeryRecord[] {
  return [...records].sort((a, b) => {
    const sa = a.sequenceNo;
    const sb = b.sequenceNo;
    if (sa != null && sb != null && sa !== sb) return sa - sb;
    if (sa != null && sb == null) return -1;
    if (sa == null && sb != null) return 1;
    return (a.patientName || '').localeCompare(b.patientName || '', undefined, {
      sensitivity: 'base',
    });
  });
}

export type OtPreparationPreparedListPrintInput = {
  surgeryDate: string;
  records: FinalizeSurgeryRecord[];
  generatedAt?: Date;
};

/**
 * Dedicated OT Preparation print HTML for the prepared OT list (selected surgery date).
 * Excludes SPA chrome / selection / Prepare controls — printOtSlip-style document only.
 */
export function buildOtPreparationPreparedListPrintHtml(
  input: OtPreparationPreparedListPrintInput,
): string {
  const surgeryDateLabel = formatOtPrepPrintSurgeryDate(input.surgeryDate);
  const generated = (input.generatedAt ?? new Date()).toLocaleString('en-IN');
  const sorted = sortOtPreparedForPrint(input.records);

  const rowsHtml =
    sorted.length === 0
      ? ''
      : sorted
          .map((r) => {
            const seq =
              r.sequenceNo != null && Number.isFinite(r.sequenceNo)
                ? String(r.sequenceNo)
                : '—';
            return `<tr>
<td>${escapeOtPrepPrintHtml(seq)}</td>
<td>${escapeOtPrepPrintHtml(r.patientName || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.uhid || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.surgeryName || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.eyes || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.startTime || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.surgeon || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.theaterName || '—')}</td>
<td>${escapeOtPrepPrintHtml(r.status || '—')}</td>
</tr>`;
          })
          .join('');

  const bodyContent =
    sorted.length === 0
      ? `<p class="empty" data-testid="ot-prep-print-empty">No prepared OT surgeries for this surgery date.</p>`
      : `<table data-testid="ot-prep-print-table">
<thead>
<tr>
<th>Seq</th>
<th>Patient Name</th>
<th>UHID</th>
<th>Procedure</th>
<th>Eye</th>
<th>Start Time</th>
<th>Surgeon</th>
<th>Theatre</th>
<th>Status</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>OT Preparation — Prepared List</title><style>
@page{size:A4 landscape;margin:12mm;}
body{font-family:Arial,sans-serif;padding:16px;font-size:12px;color:#0f172a;margin:0;}
h1{font-size:16px;text-align:center;color:#1e40af;margin:0 0 4px;}
.meta{text-align:center;font-size:12px;margin:0 0 12px;color:#334155;}
.meta strong{color:#0f172a;}
table{width:100%;border-collapse:collapse;}
th,td{padding:6px 8px;border:1px solid #e2e8f0;text-align:left;vertical-align:top;}
th{background:#f8fafc;font-weight:600;font-size:11px;}
.empty{text-align:center;padding:28px 12px;color:#475569;font-size:13px;}
.footer{font-size:10px;color:#94a3b8;text-align:center;margin-top:14px;}
</style></head><body>
<h1>OT Preparation — Prepared List</h1>
<p class="meta" data-testid="ot-prep-print-surgery-date">Surgery Date: <strong>${escapeOtPrepPrintHtml(surgeryDateLabel)}</strong></p>
${bodyContent}
<p class="footer">Generated: ${escapeOtPrepPrintHtml(generated)}</p>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`;
}

export type OpenOtPreparationPreparedListPrintDeps = {
  fetchPreparedList?: (date: string) => Promise<FinalizeSurgeryRecord[]>;
  openWindow?: (url: string, target: string, features: string) => Window | null;
};

/**
 * Loads authoritative OTPrepared rows for the selected surgery date via existing getOtList,
 * then opens a dedicated print document (not SPA window.print).
 */
export async function openOtPreparationPreparedListPrint(
  surgeryDate: string,
  deps: OpenOtPreparationPreparedListPrintDeps = {},
): Promise<{ opened: boolean; recordCount: number }> {
  const day = (surgeryDate ?? '').slice(0, 10);
  const fetchPreparedList =
    deps.fetchPreparedList ?? ((d: string) => counsellorsDeskApi.getOtList(d));
  const openWindow =
    deps.openWindow ??
    ((url, target, features) => window.open(url, target, features));

  const records = await fetchPreparedList(day);
  const html = buildOtPreparationPreparedListPrintHtml({
    surgeryDate: day,
    records,
  });

  const w = openWindow('', '_blank', 'width=960,height=720');
  if (!w) return { opened: false, recordCount: records.length };

  w.document.write(html);
  w.document.close();
  return { opened: true, recordCount: records.length };
}

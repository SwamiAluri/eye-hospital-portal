/**
 * Isolated LMS specimen label print — dedicated document, browser print only.
 * No thermal printers, device queues, or SPA chrome window.print().
 *
 * Popup must be opened synchronously from the user click (before await),
 * then filled after the print/reprint API returns. Window features must keep
 * a usable Window reference so document.write can populate the isolated label
 * (Chrome otherwise leaves a blank about:blank and the app reports blocked).
 */

import type { LmsSpecimenLabelPayloadDto } from '@/lib/lms/lms-specimens.api';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function display(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? escapeHtml(v) : '—';
}

export const SPECIMEN_LABEL_PRINT_STYLES = `
@page{size:4in 2in;margin:0.1in;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;}
.label{width:3.8in;min-height:1.7in;padding:0.08in;border:1pt solid #d1d5db;}
.row{display:flex;gap:0.12in;align-items:flex-start;}
.meta{flex:1;font-size:9pt;line-height:1.35;min-width:0;}
.meta div{margin:0 0 0.04in;}
.meta .k{color:#4b5563;display:inline-block;min-width:0.85in;}
.barcode-wrap{text-align:center;flex:0 0 1.55in;}
.barcode-wrap svg{max-width:1.55in;height:auto;}
.human{font-family:ui-monospace,Consolas,monospace;font-size:9pt;margin-top:0.04in;letter-spacing:0.02em;}
`;

export const SPECIMEN_LABEL_PRINT_WINDOW_FEATURES = 'width=640,height=480';

export const SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE =
  'Pop-up blocked. Allow pop-ups to print the label.';

export type OpenSpecimenLabelPrintWindowDeps = {
  openWindow?: (url: string, target: string, features: string) => Window | null;
};

export function buildSpecimenLabelHtml(
  label: LmsSpecimenLabelPayloadDto,
  barcodeSvgHtml: string,
): string {
  const accessionRow = label.accession
    ? `<div><span class="k">Accession</span> ${display(label.accession)}</div>`
    : '';
  const typeRow = label.specimenType
    ? `<div><span class="k">Type</span> ${display(label.specimenType)}</div>`
    : '';
  const branchRow = label.branchName
    ? `<div><span class="k">Branch</span> ${display(label.branchName)}</div>`
    : '';
  const collected = (() => {
    const d = new Date(label.collectedAtUtc);
    return Number.isNaN(d.getTime())
      ? display(label.collectedAtUtc)
      : escapeHtml(d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'));
  })();

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Specimen Label</title>
<style>${SPECIMEN_LABEL_PRINT_STYLES}</style></head><body>
<div class="label">
  <div class="row">
    <div class="meta">
      <div><span class="k">MRN</span> ${display(label.patientMrn)}</div>
      <div><span class="k">Patient</span> ${display(label.patientName)}</div>
      <div><span class="k">Order</span> ${display(label.orderNumber)}</div>
      <div><span class="k">Collected</span> ${collected}</div>
      ${accessionRow}${typeRow}${branchRow}
    </div>
    <div class="barcode-wrap">
      ${barcodeSvgHtml}
      <div class="human">${display(label.barcodeValue)}</div>
    </div>
  </div>
</div>
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`;
}

/** Synchronously open an isolated blank print window from a user gesture. */
export function openSpecimenLabelPrintWindow(
  deps: OpenSpecimenLabelPrintWindowDeps = {},
): Window | null {
  const openWindow =
    deps.openWindow ??
    ((url, target, features) => window.open(url, target, features));
  return openWindow('', '_blank', SPECIMEN_LABEL_PRINT_WINDOW_FEATURES);
}

/** Write the approved label HTML into a window opened earlier in the click path. */
export function writeSpecimenLabelPrint(
  win: Window,
  label: LmsSpecimenLabelPayloadDto,
  barcodeSvgHtml: string,
): void {
  const html = buildSpecimenLabelHtml(label, barcodeSvgHtml);
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Close a pre-opened print window when the API or render step fails. */
export function abandonSpecimenLabelPrintWindow(win: Window | null): void {
  if (!win) return;
  try {
    win.close();
  } catch {
    // Ignore close failures (already closed / cross-context).
  }
}

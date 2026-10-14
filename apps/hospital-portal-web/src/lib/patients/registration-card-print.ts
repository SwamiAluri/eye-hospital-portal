/**
 * Isolated Registration Card print — dedicated self-contained document.
 * Never call SPA window.print() against Patient Directory / dialog chrome.
 * Never depend on parent Tailwind/runtime CSS in about:blank.
 */

import { resolvePatientPhotoUrl } from '@/lib/patients/patient-display-utils';

export type RegistrationCardPrintPatient = {
  id?: string;
  medicalRecordNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  contactNumber?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  photoUrl?: string | null;
};

export type RegistrationCardPrintMedia = {
  /** Inline SVG markup for the QR code (already rendered on screen). */
  qrSvgHtml?: string | null;
  /** Inline SVG markup for the barcode (already rendered on screen). */
  barcodeSvgHtml?: string | null;
};

export function escapeRegistrationCardHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayOrNa(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? escapeRegistrationCardHtml(v) : 'N/A';
}

export function formatRegistrationCardPrintDob(iso: string | null | undefined): string {
  if (!iso?.trim()) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeRegistrationCardHtml(iso);
  return escapeRegistrationCardHtml(
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  );
}

/** Explicit print CSS — mirrors on-screen 3.5in × 2in card; no SPA Tailwind. */
export const REGISTRATION_CARD_PRINT_DOCUMENT_STYLES = `
@page{size:3.5in 2in;margin:0;}
*{box-sizing:border-box;}
html,body{
  margin:0;padding:0;width:3.5in;height:2in;overflow:hidden;background:#fff;color:#111827;
  font-family:Arial,Helvetica,sans-serif;
}
body{display:block;}
.rc-card{
  width:3.5in;height:2in;max-width:3.5in;max-height:2in;
  padding:0.12in;border:1.5pt solid #d1d5db;background:#fff;
  overflow:hidden;page-break-inside:avoid;break-inside:avoid;
  page-break-before:avoid;page-break-after:avoid;
}
.rc-body{
  display:grid;grid-template-columns:0.95in 1fr;gap:0.1in;height:calc(2in - 0.24in - 0.22in);
  min-height:0;
}
.rc-left{
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  min-width:0;min-height:0;
}
.rc-avatar,.rc-avatar-fallback{
  width:0.7in;height:0.7in;border:1.5pt solid #d1d5db;border-radius:0.08in;
  object-fit:cover;display:block;flex-shrink:0;
}
.rc-avatar-fallback{
  background:#e5e7eb;color:#9ca3af;font-size:0.32in;line-height:0.7in;text-align:center;
}
.rc-qr{width:0.55in;height:0.55in;padding:0.02in;background:#fff;flex-shrink:0;}
.rc-qr svg{width:0.51in!important;height:0.51in!important;display:block;}
.rc-right{display:flex;flex-direction:column;justify-content:space-between;min-width:0;min-height:0;}
.rc-header{border-bottom:1pt solid #d1d5db;padding-bottom:0.03in;margin-bottom:0.03in;}
.rc-brand{margin:0;font-size:9pt;font-weight:700;color:#1e3a8a;line-height:1.1;}
.rc-subtitle{margin:0;font-size:6pt;color:#4b5563;line-height:1.1;}
.rc-name{margin:0 0 0.04in;font-size:9pt;font-weight:700;color:#111827;line-height:1.15;}
.rc-fields{
  display:grid;grid-template-columns:1fr 1fr;column-gap:0.08in;row-gap:0.02in;
  font-size:6.5pt;line-height:1.2;
}
.rc-label{color:#4b5563;}
.rc-value{font-weight:600;margin-left:0.03in;}
.rc-value-blood{color:#dc2626;}
.rc-contact{font-size:6.5pt;margin-top:0.02in;line-height:1.2;}
.rc-emergency{
  margin-top:0.03in;padding:0.02in 0.03in;background:#fef2f2;border-radius:0.03in;
  font-size:6pt;line-height:1.15;
}
.rc-emergency-label{font-weight:700;color:#b91c1c;}
.rc-barcode{display:flex;justify-content:center;margin-top:0.03in;max-height:0.42in;overflow:hidden;}
.rc-barcode svg{max-width:100%;max-height:0.4in;height:auto;display:block;}
.rc-footer{
  margin-top:0.04in;padding-top:0.03in;border-top:1pt solid #e5e7eb;
  text-align:center;font-size:5.5pt;color:#6b7280;line-height:1.1;
}
`.trim();

/**
 * Extract already-rendered QR/barcode SVG from the on-screen card element.
 * QR is the first non-barcode SVG; barcode uses class barcode-svg.
 */
export function extractRegistrationCardPrintMedia(
  cardElement: HTMLElement | null | undefined,
): RegistrationCardPrintMedia & { photoUrl?: string | null } {
  if (!cardElement) return {};
  const barcode = cardElement.querySelector('svg.barcode-svg');
  const svgs = Array.from(cardElement.querySelectorAll('svg'));
  const qr = svgs.find((node) => !node.classList.contains('barcode-svg')) ?? null;
  const img = cardElement.querySelector('img');
  return {
    qrSvgHtml: qr?.outerHTML ?? null,
    barcodeSvgHtml: barcode?.outerHTML ?? null,
    photoUrl: img?.getAttribute('src') ?? null,
  };
}

export function buildRegistrationCardPrintBodyHtml(
  patient: RegistrationCardPrintPatient,
  media: RegistrationCardPrintMedia = {},
): string {
  const name = [patient.firstName, patient.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const photoUrl = (patient.photoUrl ?? '').trim();
  const avatar = photoUrl
    ? `<img class="rc-avatar" src="${escapeRegistrationCardHtml(photoUrl)}" alt="" />`
    : `<div class="rc-avatar-fallback" aria-hidden="true">&#128100;</div>`;
  const qr = (media.qrSvgHtml ?? '').trim()
    ? `<div class="rc-qr">${media.qrSvgHtml}</div>`
    : `<div class="rc-qr"></div>`;
  const barcode = (media.barcodeSvgHtml ?? '').trim()
    ? `<div class="rc-barcode">${media.barcodeSvgHtml}</div>`
    : `<div class="rc-barcode"></div>`;
  const emergency = (patient.emergencyContactName ?? '').trim()
    ? `<div class="rc-emergency"><span class="rc-emergency-label">Emergency:</span> ${escapeRegistrationCardHtml(
        patient.emergencyContactName!.trim(),
      )}${
        (patient.emergencyContactPhone ?? '').trim()
          ? ` (${escapeRegistrationCardHtml(patient.emergencyContactPhone!.trim())})`
          : ''
      }</div>`
    : '';

  return `<div class="rc-card" data-testid="registration-card-print-root">
  <div class="rc-body">
    <div class="rc-left">${avatar}${qr}</div>
    <div class="rc-right">
      <div>
        <div class="rc-header">
          <p class="rc-brand">HOSPITAL PORTAL</p>
          <p class="rc-subtitle">Patient Registration Card</p>
        </div>
        <p class="rc-name">${displayOrNa(name || null)}</p>
        <div class="rc-fields">
          <div><span class="rc-label">MRN:</span><span class="rc-value">${displayOrNa(
            patient.medicalRecordNumber,
          )}</span></div>
          <div><span class="rc-label">Blood:</span><span class="rc-value rc-value-blood">${displayOrNa(
            patient.bloodGroup,
          )}</span></div>
          <div><span class="rc-label">DOB:</span><span class="rc-value">${formatRegistrationCardPrintDob(
            patient.dateOfBirth,
          )}</span></div>
          <div><span class="rc-label">Gender:</span><span class="rc-value">${displayOrNa(
            patient.gender,
          )}</span></div>
        </div>
        <div class="rc-contact"><span class="rc-label">Contact:</span><span class="rc-value">${displayOrNa(
          patient.contactNumber,
        )}</span></div>
        ${emergency}
      </div>
      ${barcode}
    </div>
  </div>
  <div class="rc-footer">Keep this card safe. Present at every visit.</div>
</div>`;
}

/**
 * Full standalone print document with embedded CSS (no parent SPA stylesheets).
 */
export function buildRegistrationCardPrintDocumentHtml(
  patient: RegistrationCardPrintPatient,
  media: RegistrationCardPrintMedia = {},
): string {
  const body = buildRegistrationCardPrintBodyHtml(patient, media);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Registration Card</title><style>
${REGISTRATION_CARD_PRINT_DOCUMENT_STYLES}
</style></head><body>
${body}
<script>
(function(){
  function ready(){
    var imgs=document.images;
    if(!imgs||!imgs.length){return Promise.resolve();}
    return Promise.all(Array.prototype.map.call(imgs,function(img){
      if(img.complete)return Promise.resolve();
      return new Promise(function(res){img.onload=img.onerror=function(){res();};});
    }));
  }
  function go(){
    ready().then(function(){
      window.focus();
      window.print();
    });
  }
  window.onafterprint=function(){window.close();};
  if(document.readyState==='complete')go();
  else window.onload=go;
})();
<\/script>
</body></html>`;
}

export type OpenRegistrationCardPrintDeps = {
  openWindow?: (url: string, target: string, features: string) => Window | null;
};

/**
 * Print ONLY the registration card via a self-contained document.
 */
export function openRegistrationCardPrint(
  input: {
    patient: RegistrationCardPrintPatient;
    cardElement?: HTMLElement | null;
  } | null,
  deps: OpenRegistrationCardPrintDeps = {},
): { opened: boolean } {
  if (!input?.patient) return { opened: false };
  const openWindow =
    deps.openWindow ??
    ((url, target, features) => window.open(url, target, features));
  const extracted = extractRegistrationCardPrintMedia(input.cardElement);
  // Prefer caller-resolved photo; fall back to on-screen <img> src; resolve relative API paths.
  const rawPhoto =
    input.patient.photoUrl ?? extracted.photoUrl ?? null;
  const patient: RegistrationCardPrintPatient = {
    ...input.patient,
    photoUrl: resolvePatientPhotoUrl(rawPhoto),
  };
  const html = buildRegistrationCardPrintDocumentHtml(patient, {
    qrSvgHtml: extracted.qrSvgHtml,
    barcodeSvgHtml: extracted.barcodeSvgHtml,
  });
  const w = openWindow('', '_blank', 'width=520,height=380');
  if (!w) return { opened: false };
  w.document.write(html);
  w.document.close();
  return { opened: true };
}

export function formatRegistrationCardPatientName(
  patient: RegistrationCardPrintPatient,
): string {
  return [patient.firstName, patient.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function formatRegistrationCardMrnDisplay(
  medicalRecordNumber?: string | null,
): string {
  const mrn = (medicalRecordNumber ?? '').trim();
  return mrn || 'Unavailable';
}

export function registrationCardPrintDocumentExcludesAppShell(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    !lower.includes('patient directory') &&
    !lower.includes('data-testid="patient-lookup') &&
    !lower.includes('register new patient') &&
    !lower.includes('sidebar') &&
    !lower.includes('confirm & create') &&
    !lower.includes('print registration card') &&
    !lower.includes('>close<')
  );
}

export function registrationCardPrintDocumentHasFidelityMarkers(html: string): boolean {
  return (
    html.includes('HOSPITAL PORTAL') &&
    html.includes('Patient Registration Card') &&
    html.includes('Keep this card safe') &&
    html.includes('@page{size:3.5in 2in;margin:0;}') &&
    html.includes('grid-template-columns:0.95in 1fr') &&
    html.includes('page-break-inside:avoid') &&
    html.includes('rc-card') &&
    !html.includes('grid-cols-3') &&
    !html.includes('body *')
  );
}

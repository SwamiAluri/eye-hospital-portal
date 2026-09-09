import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { downloadPDF } from '@/lib/pdf-generator';

/**
 * Renders the printable HTML estimate document to a PDF blob.
 * Uses html2canvas so Telugu script in T&C renders correctly.
 */
export async function generateCounsellingEstimatePdfFromElement(
  elementId: string,
): Promise<Blob> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Print element #${elementId} not found`);
  }

  await document.fonts?.ready;

  const canvas = await html2canvas(element, {
    scale: 2,
    logging: false,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const printableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  return pdf.output('blob');
}

export async function downloadCounsellingEstimatePdf(
  elementId: string,
  filename: string,
): Promise<void> {
  const blob = await generateCounsellingEstimatePdfFromElement(elementId);
  downloadPDF(blob, filename);
}

export function canShareCounsellingEstimatePdf(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Share PDF via Web Share API (tablet / mobile). Returns false if unsupported. */
export async function shareCounsellingEstimatePdf(
  elementId: string,
  filename: string,
  title = 'Counselling estimate',
): Promise<boolean> {
  if (!canShareCounsellingEstimatePdf()) return false;

  const blob = await generateCounsellingEstimatePdfFromElement(elementId);
  const file = new File([blob], filename, { type: 'application/pdf' });
  const payload = { files: [file], title, text: title };

  if (navigator.canShare && !navigator.canShare(payload)) {
    return false;
  }

  await navigator.share(payload);
  return true;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 12mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111827;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .telugu { font-family: 'Noto Sans Telugu', sans-serif; line-height: 1.6; }
  table.counselling-print-table,
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #f0fdfa; }
  thead { display: table-header-group; }
  tr, img { break-inside: avoid; page-break-inside: avoid; }
  .counselling-print-avoid-break,
  .counselling-print-totals {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .counselling-print-section-title {
    break-after: avoid;
    page-break-after: avoid;
  }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  img { max-width: 100%; height: auto; }
  @media print {
    body { padding: 0; }
  }
`;

export function printCounsellingEstimateDocument(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Counselling Summary &amp; Cost Estimate</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>${element.innerHTML}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 600);
}

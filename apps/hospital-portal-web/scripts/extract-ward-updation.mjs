import fs from 'fs';

const pagePath = new URL('../src/app/dashboard/ip-management/ward/page.tsx', import.meta.url);
const outPath = new URL('../src/components/ip-management/WardUpdationModal.tsx', import.meta.url);

const lines = fs.readFileSync(pagePath, 'utf8').split(/\r?\n/);
const body = lines.slice(380, 1458).join('\n').replace(
  'function WardUpdationModal(',
  'function WardUpdationModalInner(',
);

const header = fs.readFileSync(new URL('./ward-updation-modal-header.tsx', import.meta.url), 'utf8');

fs.writeFileSync(outPath, header + '\n' + body);
console.log('Wrote', outPath.pathname);

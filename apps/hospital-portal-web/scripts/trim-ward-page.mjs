import fs from 'fs';

const pagePath = new URL('../src/app/dashboard/ip-management/ward/page.tsx', import.meta.url);
const lines = fs.readFileSync(pagePath, 'utf8').split(/\r?\n/);

// Remove RoomStatusQueryPopup (line 381) through end of WardUpdationModal (line 1458) — 0-indexed 380-1457
const kept = [...lines.slice(0, 380), ...lines.slice(1458)];
fs.writeFileSync(pagePath, kept.join('\n'));
console.log('Removed', 1458 - 380, 'lines from page.tsx');

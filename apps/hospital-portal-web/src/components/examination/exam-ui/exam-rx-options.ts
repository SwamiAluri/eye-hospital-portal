/** Shared diopter / axis option lists for optometry exam UI */

export const sphereValues: string[] = [];
for (let i = -20; i <= 20; i += 0.25) {
  sphereValues.push(i >= 0 ? `+${i.toFixed(2)}` : i.toFixed(2));
}

export const cylinderValues: string[] = [''];
for (let i = 0; i >= -6; i -= 0.25) {
  cylinderValues.push(i.toFixed(2));
}

export const axisValues: string[] = [];
for (let i = 0; i <= 180; i++) {
  axisValues.push(i.toString());
}

export const snellenValues = [
  '6/6',
  '6/9',
  '6/12',
  '6/18',
  '6/24',
  '6/36',
  '6/60',
  'CF (Counting Fingers)',
  'HM (Hand Movement)',
  'PL (Perception of Light)',
  'NPL (No Perception of Light)',
];

export const nearVAValues = ['N6', 'N8', 'N10', 'N12', 'N18', 'N24', 'N36'];

export const keratometryKValues: string[] = [];
for (let i = 0; i < 25; i++) {
  keratometryKValues.push((40 + i * 0.25).toFixed(2));
}

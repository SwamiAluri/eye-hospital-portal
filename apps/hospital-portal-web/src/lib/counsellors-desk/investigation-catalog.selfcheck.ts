import type { FullCatalogResponse } from '@/lib/api/service-catalog.api';
import { buildInvestigationCatalogFromServiceCatalog } from './investigation-catalog';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const mockCatalog: FullCatalogResponse = {
  categories: [
    {
      id: 'c-diag',
      code: 'DIAGNOSTICS',
      name: 'Diagnostic Procedures',
      displayOrder: 10,
      isActive: true,
      services: [
        {
          id: 's-diag',
          code: 'SVC-DIAG',
          name: 'Ophthalmic Diagnostics',
          isActive: true,
          variants: [
            {
              id: 'v-oct',
              code: 'DIAG-OCTM',
              name: 'OCT Macula',
              price: 1500,
              priceType: 'PER_EYE',
              hasIolOptions: false,
              displayOrder: 1,
              isActive: true,
            },
          ],
        },
      ],
    },
    {
      id: 'c-inv',
      code: 'INVESTIGATIONS',
      name: 'Pre-Op Investigations',
      displayOrder: 11,
      isActive: true,
      services: [
        {
          id: 's-inv',
          code: 'SVC-LABS',
          name: 'Pre-Op Laboratory Tests',
          isActive: true,
          variants: [
            {
              id: 'v-cbc',
              code: 'LAB-CBC',
              name: 'CBC',
              price: 500,
              priceType: 'FIXED',
              hasIolOptions: false,
              displayOrder: 1,
              isActive: true,
            },
            {
              id: 'v-viral',
              code: 'LAB-VIRAL',
              name: 'HIV Panel',
              price: 800,
              priceType: 'FIXED',
              hasIolOptions: false,
              displayOrder: 2,
              isActive: true,
            },
          ],
        },
      ],
    },
  ],
};

const built = buildInvestigationCatalogFromServiceCatalog(mockCatalog);
assert(built.imaging.length === 1, 'DIAGNOSTICS → imaging');
assert(built.imaging[0]?.testType === 'Imaging', 'imaging testType');
assert(built.imaging[0]?.category === 'Diagnostic Scans', 'imaging UI category');
assert(built.lab.length === 2, 'INVESTIGATIONS → lab');
assert(built.lab.some((i) => i.category === 'Viral Markers'), 'viral lab grouping');
assert(built.scan.length === 0, 'scan bucket unused after B2');

console.log('investigation-catalog self-check passed');

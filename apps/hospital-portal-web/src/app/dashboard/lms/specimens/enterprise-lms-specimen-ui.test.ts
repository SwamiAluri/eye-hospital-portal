import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import {
  LMS_COLLECTION_PERMISSIONS,
  LMS_SPECIMENS_PERMISSIONS,
  LEGACY_LABORATORY_VIEW,
} from '@/lib/lms/lms-permissions';

const srcRoot = join(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('Enterprise LMS L-COL-01C/01D — Specimen UI', () => {
  it('registers specimens routes and marks capability implemented', () => {
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/specimens/page.tsx'))).toBe(true);
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/specimens/[id]/page.tsx'))).toBe(true);
    const specimens = LMS_CAPABILITIES.find((c) => c.href === '/dashboard/lms/specimens');
    expect(specimens?.status).toBe('implemented');
  });

  it('permission codes match PD-COL-SPC-16 / PD-COL-REC-18 / L-COL-01E', () => {
    expect(LMS_SPECIMENS_PERMISSIONS).toEqual({
      view: 'lms.specimens.view',
      manage: 'lms.specimens.manage',
      receive: 'lms.specimens.receive',
      barcodeView: 'lms.specimens.barcode.view',
      labelPrint: 'lms.specimens.label.print',
      labelReprint: 'lms.specimens.label.reprint',
    });
  });

  it('Complete Collection UI requires manage AND collect (PO Q1/Q3)', () => {
    const wb = read('components/lms/collection/CollectionWorkbench.tsx');
    expect(wb).toContain('LMS_SPECIMENS_PERMISSIONS.manage');
    expect(wb).toContain('LMS_COLLECTION_PERMISSIONS.collect');
    expect(wb).toContain('canCompleteCollection');
    expect(wb).toContain('canSpecimensManage && canCollect');

    const sheet = read('components/lms/collection/CollectionTaskDetailSheet.tsx');
    expect(sheet).toContain('canCompleteCollection');
    expect(sheet).toContain('complete-collection-open');
    expect(sheet).toContain('complete-collection-confirm');
    expect(sheet).toContain('confirm-mrn');
    expect(sheet).toContain('confirm-name');
    expect(sheet).toContain('confirm-dob');
    expect(sheet).toContain('confirm-identity-checkbox');
    expect(sheet).toContain('completeLmsCollection');
  });

  it('specimen worklist is authoritative receiving queue', () => {
    const page = read('app/dashboard/lms/specimens/page.tsx');
    const wb = read('components/lms/specimens/SpecimenWorkbench.tsx');
    expect(page).toContain('SpecimenWorkbench');
    expect(wb).toContain('specimen-workbench');
    expect(wb).toContain('listLmsSpecimens');
    expect(wb).toContain('specimen-receive-');
    expect(wb).toContain('specimen-reject-');
    expect(wb).toContain('LMS_SPECIMENS_PERMISSIONS.receive');
    expect(wb).not.toContain('claim');
    expect(wb).not.toContain('TAT');
    expect(wb).not.toContain('scanner');
    expect(wb).not.toContain('ZPL');
  });

  it('specimen detail shows Received/Rejected fields, barcode/label actions, gates Receive/Reject', () => {
    const detail = read('components/lms/specimens/SpecimenDetailView.tsx');
    expect(detail).toContain('getLmsSpecimen');
    expect(detail).toContain('specimen-status');
    expect(detail).toContain('specimen-order-tests');
    expect(detail).toContain('specimen-accession');
    expect(detail).toContain('specimen-rejection-reason');
    expect(detail).toContain('specimen-detail-receive');
    expect(detail).toContain('LMS_SPECIMENS_PERMISSIONS.receive');
    expect(detail).toContain('specimen-barcode');
    expect(detail).toContain('specimen-print-label');
    expect(detail).toContain('specimen-reprint-label');
    expect(detail).toContain('Generate / Print Label');
    expect(detail).toContain('printLmsSpecimenLabel');
    expect(detail).toContain('CODE128');
    expect(detail).toContain('openSpecimenLabelPrintWindow');
    expect(detail).toContain('writeSpecimenLabelPrint');
    expect(detail).toMatch(
      /openSpecimenLabelPrintWindow\(\)[\s\S]*await printLmsSpecimenLabel/,
    );
    expect(detail).not.toContain('scanner');
    expect(detail).not.toContain('ZPL');
    expect(detail).not.toContain('thermal');
    expect(detail).not.toContain(LEGACY_LABORATORY_VIEW);
  });

  it('reprint dialog requires mandatory reason and reuses print API', () => {
    const dlg = read('components/lms/specimens/ReprintSpecimenLabelDialog.tsx');
    expect(dlg).toContain('reprint-reason');
    expect(dlg).toContain('Reprint reason is required');
    expect(dlg).toContain('reprintLmsSpecimenLabel');
    expect(dlg).toContain('aria-required');
    expect(dlg).toContain('openSpecimenLabelPrintWindow');
    expect(dlg).toMatch(
      /openSpecimenLabelPrintWindow\(\)[\s\S]*await reprintLmsSpecimenLabel/,
    );
    expect(dlg).toContain('No new barcode is allocated');
  });

  it('label print uses isolated browser document without DOB', () => {
    const print = read('lib/lms/specimen-label-print.ts');
    expect(print).toContain('openSpecimenLabelPrintWindow');
    expect(print).toContain('writeSpecimenLabelPrint');
    expect(print).toContain('window.open');
    expect(print).toContain('MRN');
    expect(print).toContain('Patient');
    expect(print).toContain('Order');
    expect(print).toContain('Collected');
    expect(print).toContain('Accession');
    expect(print).toContain("SPECIMEN_LABEL_PRINT_WINDOW_FEATURES = 'width=640,height=480'");
    expect(print).not.toContain('dateOfBirth');
    expect(print).not.toContain('DOB');
    expect(print).not.toContain('ZPL');
  });

  it('Receive dialog requires patient confirmation', () => {
    const dlg = read('components/lms/specimens/ReceiveSpecimenDialog.tsx');
    expect(dlg).toContain('receive-confirm-mrn');
    expect(dlg).toContain('receive-confirm-name');
    expect(dlg).toContain('receive-confirm-dob');
    expect(dlg).toContain('receive-identity-checkbox');
    expect(dlg).toContain('receiveLmsSpecimen');
    expect(dlg).toContain('isConcurrencyConflict');
  });

  it('Reject dialog loads governed reasons from server', () => {
    const dlg = read('components/lms/specimens/RejectSpecimenDialog.tsx');
    expect(dlg).toContain('listLmsSpecimenRejectionReasons');
    expect(dlg).toContain('reject-reason-select');
    expect(dlg).toContain('rejectLmsSpecimen');
    expect(dlg).not.toContain('DAMAGED');
    expect(dlg).not.toContain('INSUFFICIENT_SPECIMEN');
  });

  it('API client covers list, receive, reject, barcode, print, reprint', () => {
    const api = read('lib/lms/lms-specimens.api.ts');
    expect(api).toContain('/lms/specimens/');
    expect(api).toContain('/complete-collection');
    expect(api).toContain('by-collection-task');
    expect(api).toContain('/receive');
    expect(api).toContain('/reject');
    expect(api).toContain('rejection-reasons');
    expect(api).toContain('accession?:');
    expect(api).toContain('barcodeValue?:');
    expect(api).toContain('/barcode');
    expect(api).toContain('/label/print');
    expect(api).toContain('/label/reprint');
    expect(api).toContain('isConfigurationFailure');
    expect(api).not.toContain('/lab-reports');
    expect(api).toMatch(/assignLmsSpecimenBarcode[\s\S]*expectedRowVersion[\s\S]*operatingBranchId/);
    expect(api).not.toMatch(/assignLmsSpecimenBarcode[\s\S]*barcodeValue/);
  });

  it('frontend Complete Collection path matches LaboratoryApi SpecimenFunctions route', () => {
    const api = read('lib/lms/lms-specimens.api.ts');
    const backend = readFileSync(
      join(
        srcRoot,
        '../../../microservices/laboratory-service/LaboratoryApi/Functions/SpecimenFunctions.cs',
      ),
      'utf8',
    );
    const labClient = read('lib/api/laboratory-service.api.ts');

    expect(labClient).toContain("process.env.NEXT_PUBLIC_LABORATORY_API_URL ?? 'http://localhost:7076/api'");
    expect(api).toMatch(
      /`\/lms\/collection\/tasks\/\$\{collectionTaskId\}\/complete-collection`/,
    );
    expect(backend).toContain('LmsCollectionCompleteCollection');
    expect(backend).toContain('Route = "lms/specimens/{id:guid}/receive"');
    expect(backend).toContain('Route = "lms/specimens/{id:guid}/reject"');
    expect(backend).toContain('Route = "lms/specimens/{id:guid}/barcode"');
    expect(backend).toContain('Route = "lms/specimens/{id:guid}/label/print"');
    expect(backend).toContain('Route = "lms/specimens/{id:guid}/label/reprint"');
    expect(backend).toContain('LaboratoryAuthz.SpecimensReceive');
    expect(backend).toContain('LaboratoryAuthz.SpecimensLabelPrint');
    expect(backend).toContain('LaboratoryAuthz.SpecimensLabelReprint');
  });

  it('Generate / Print Label composes POST /api/lms/specimens/{id}/label/print without double /api', () => {
    const detail = read('components/lms/specimens/SpecimenDetailView.tsx');
    const api = read('lib/lms/lms-specimens.api.ts');
    const labClient = read('lib/api/laboratory-service.api.ts');
    const envLocal = readFileSync(
      join(srcRoot, '../.env.local'),
      'utf8',
    );

    expect(detail).toContain('printLmsSpecimenLabel');
    expect(detail).toContain('Generate / Print Label');
    expect(api).toMatch(
      /export async function printLmsSpecimenLabel[\s\S]*getLaboratoryApi\(\)\.post[\s\S]*`\/lms\/specimens\/\$\{specimenId\}\/label\/print`/,
    );
    expect(api).not.toMatch(/`\/api\/lms\/specimens\/\$\{specimenId\}\/label\/print`/);
    expect(labClient).toContain("process.env.NEXT_PUBLIC_LABORATORY_API_URL ?? 'http://localhost:7076/api'");
    expect(envLocal).toMatch(/NEXT_PUBLIC_LABORATORY_API_URL\s*=\s*http:\/\/localhost:7076\/api\b/);

    const base = 'http://localhost:7076/api';
    const path = '/lms/specimens/{id}/label/print';
    expect(`${base}${path}`).toBe('http://localhost:7076/api/lms/specimens/{id}/label/print');
    expect(`${base}${path}`).not.toContain('/api/api/');
  });

  it('does not use specimens.receive for Complete Collection', () => {
    const sheet = read('components/lms/collection/CollectionTaskDetailSheet.tsx');
    const wb = read('components/lms/collection/CollectionWorkbench.tsx');
    expect(sheet).not.toContain('LMS_SPECIMENS_PERMISSIONS.receive');
    expect(wb).not.toContain('LMS_SPECIMENS_PERMISSIONS.receive');
    expect(LMS_COLLECTION_PERMISSIONS.collect).toBe('lms.collection.collect');
  });
});

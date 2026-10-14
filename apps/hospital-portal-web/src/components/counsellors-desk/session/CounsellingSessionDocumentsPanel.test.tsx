import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNSELLING_DOCUMENT_REMOVE_CONFIRM } from '@/lib/patients/counselling-document-remove-confirm';

describe('counselling session documents panel', () => {
  const panel = readFileSync(resolve(__dirname, 'CounsellingSessionDocumentsPanel.tsx'), 'utf8');
  const modal = readFileSync(resolve(__dirname, '../../widgets/CustomDocumentModal.tsx'), 'utf8');
  const rail = readFileSync(resolve(__dirname, 'CounsellingJourneyRail.tsx'), 'utf8');
  const page = readFileSync(resolve(__dirname, 'CounsellingSessionPageContent.tsx'), 'utf8');

  it('uses certified type labels and uploader-only remove without CCMS slot mapping', () => {
    expect(panel).toContain('patient360DocumentTypeLabel');
    expect(panel).toContain('downloadCounselingCanonicalDocument');
    expect(panel).toContain('deleteCounselingSessionDocument');
    expect(panel).toContain('session_documents.delete');
    expect(panel).toContain('doc.createdByUserId === currentUserId');
    expect(panel).toContain('CustomDocumentModal');
    expect(panel).toContain('Session documents');
    expect(panel).toContain('Patient counselling documents');
    expect(panel).not.toContain('Insurance Card — Front');
    expect(panel).not.toContain('CoverageCase');

    expect(modal).toContain('COUNSELLING_GENERIC_DOCUMENT_TYPES');
    expect(modal).toContain('autoStart');
    expect(modal).not.toContain('AudioRecording');

    expect(rail).toContain('sessionDocuments');
    expect(rail).toContain("contextualDestination === 'documents'");
    expect(page).toContain('CounsellingSessionDocumentsPanel');
    expect(page).toContain("setContextualDestination('documents')");
  });

  it('uses CounsellingAlertDialog for remove confirmation instead of window.confirm', () => {
    expect(panel).not.toContain('window.confirm');
    expect(panel).not.toContain('window.alert');
    expect(panel).toContain('CounsellingAlertDialog');
    expect(panel).toContain('CounsellingAlertDialogTitle');
    expect(panel).toContain('CounsellingAlertDialogDescription');
    expect(panel).toContain('CounsellingAlertDialogCancel');
    expect(panel).toContain('CounsellingAlertDialogAction');
    expect(panel).toContain('data-testid="counselling-document-remove-confirm"');
    expect(panel).toContain('data-testid="counselling-document-remove-confirm-submit"');
    expect(panel).toContain('bg-red-600');
    expect(panel).toContain('onRequestRemove');
    expect(panel).toContain('setPendingRemove');
    expect(panel).toContain('confirmRemove');
  });

  it('uses the certified remove confirmation copy', () => {
    expect(COUNSELLING_DOCUMENT_REMOVE_CONFIRM.title).toBe('Remove document?');
    expect(COUNSELLING_DOCUMENT_REMOVE_CONFIRM.description).toBe(
      'This document will no longer be available in Counselling or Patient 360.',
    );
    expect(COUNSELLING_DOCUMENT_REMOVE_CONFIRM.cancelLabel).toBe('Cancel');
    expect(COUNSELLING_DOCUMENT_REMOVE_CONFIRM.confirmLabel).toBe('Remove');
    expect(panel).toContain('COUNSELLING_DOCUMENT_REMOVE_CONFIRM.title');
    expect(panel).toContain('COUNSELLING_DOCUMENT_REMOVE_CONFIRM.description');
    expect(panel).toContain('COUNSELLING_DOCUMENT_REMOVE_CONFIRM.cancelLabel');
    expect(panel).toContain('COUNSELLING_DOCUMENT_REMOVE_CONFIRM.confirmLabel');
    expect(panel).not.toContain('Delete permanently');
    expect(panel).not.toContain('This action cannot be undone');
  });

  it('calls delete only from confirmRemove after dialog confirmation', () => {
    const removeButtonStart = panel.indexOf('{canRemove ? (');
    const removeButtonEnd = panel.indexOf('</li>', removeButtonStart);
    const removeButtonBlock = panel.slice(removeButtonStart, removeButtonEnd);
    expect(removeButtonBlock).toContain('onRequestRemove');
    expect(removeButtonBlock).not.toContain('deleteCounselingSessionDocument');
    expect(removeButtonBlock).not.toContain('window.confirm');

    expect(panel).toContain('const confirmRemove = useCallback');
    expect(panel).toContain('await deleteCounselingSessionDocument(pendingRemove.documentId)');
    expect(panel).toContain('await reload()');
    expect(panel).toContain('if (!open && !removing) setPendingRemove(null)');
    expect(panel).toContain('data-testid="counselling-document-remove-confirm-submit"');
    expect(panel).toContain('void confirmRemove()');
  });
});

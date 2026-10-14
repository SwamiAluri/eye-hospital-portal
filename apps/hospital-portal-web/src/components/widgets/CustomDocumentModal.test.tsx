import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNSELLING_GENERIC_DOCUMENT_TYPES } from '@/lib/api/counseling-sessions.api';

describe('CustomDocumentModal counselling upload types', () => {
  it('exposes only certified counselling types and excludes AudioRecording and Patient 360 areas', () => {
    expect(COUNSELLING_GENERIC_DOCUMENT_TYPES).toHaveLength(9);
    expect(COUNSELLING_GENERIC_DOCUMENT_TYPES.map((t) => t.label)).toEqual([
      'Referral Letter',
      'Previous Report',
      'Insurance Card',
      'Policy Document',
      'ID Proof',
      'Address Proof',
      'Lab Report',
      'Imaging',
      'Other',
    ]);
    expect(COUNSELLING_GENERIC_DOCUMENT_TYPES.some((t) => t.id === 'AudioRecording')).toBe(false);

    const source = readFileSync(
      resolve(process.cwd(), 'src/components/widgets/CustomDocumentModal.tsx'),
      'utf8',
    );
    expect(source).toContain('COUNSELLING_GENERIC_DOCUMENT_TYPES');
    expect(source).not.toContain('AudioRecording');
    expect(source).toContain('autoStart');
    expect(source).toContain('Use Camera');
    expect(source).toContain('Upload Files');
    expect(source).not.toContain('Open Webcam');
  });
});

describe('PhotoCapture autoStart camera flow', () => {
  it('opens the webcam immediately when autoStart is set and keeps upload-photo for non-auto flows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/shared/PhotoCapture.tsx'),
      'utf8',
    );
    expect(source).toContain('autoStart');
    expect(source).toContain('getUserMedia');
    expect(source).toContain('drawWebcamCaptureFrame');
    expect(source).toContain('data-testid="photo-capture-video"');
    expect(source).toContain('data-testid="photo-capture-capture"');
    expect(source).toContain('data-testid="photo-capture-retake"');
    expect(source).toContain('data-testid="photo-capture-use"');
    expect(source).toContain('Could not access the camera');
    expect(source).toContain('Use Photo');
    expect(source).toContain('Retake');
    expect(source).toContain('Capture');
    expect(source).not.toContain('📷 Open Webcam');
    expect(source).not.toMatch(/context\.scale\(-1,\s*1\)/);
  });
});

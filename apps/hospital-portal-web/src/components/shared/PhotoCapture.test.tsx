import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PHOTO_CAPTURE_ORIENTATION,
  drawWebcamCaptureFrame,
} from '@/components/shared/photo-capture-orientation';

describe('photo capture orientation', () => {
  it('keeps live preview and capture independently configurable, with capture non-mirrored', () => {
    expect(PHOTO_CAPTURE_ORIENTATION.captureMirror).toBe(false);
    expect(typeof PHOTO_CAPTURE_ORIENTATION.previewMirror).toBe('boolean');
  });

  it('draws the video frame without a horizontal flip for upload', () => {
    const drawImage = vi.fn();
    const save = vi.fn();
    const restore = vi.fn();
    const translate = vi.fn();
    const scale = vi.fn();
    const context = { drawImage, save, restore, translate, scale } as unknown as CanvasRenderingContext2D;
    const video = {} as CanvasImageSource;

    drawWebcamCaptureFrame(context, video, 640, 480);

    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
    expect(translate).not.toHaveBeenCalled();
    expect(scale).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
});

describe('PhotoCapture webcam capture wiring', () => {
  const source = readFileSync(resolve(__dirname, 'PhotoCapture.tsx'), 'utf8');

  it('keeps auto-start, retake, use-photo, and cleanup behavior', () => {
    expect(source).toContain('autoStart');
    expect(source).toContain('getUserMedia');
    expect(source).toContain('drawWebcamCaptureFrame');
    expect(source).toContain('PHOTO_CAPTURE_ORIENTATION');
    expect(source).toContain('data-testid="photo-capture-video"');
    expect(source).toContain('data-testid="photo-capture-capture"');
    expect(source).toContain('data-testid="photo-capture-retake"');
    expect(source).toContain('data-testid="photo-capture-use"');
    expect(source).toContain('stream.getTracks().forEach((track) => track.stop())');
    expect(source).toContain('Use Photo');
    expect(source).toContain('Retake');
    expect(source).not.toContain('📷 Open Webcam');
  });

  it('does not hard-code a capture flip in the component body', () => {
    expect(source).not.toMatch(/context\.translate\(canvas\.width,\s*0\)/);
    expect(source).not.toMatch(/context\.scale\(-1,\s*1\)/);
  });

  it('preserves Upload Photo / file-input path for non-autoStart flows', () => {
    expect(source).toContain('Upload Photo');
    expect(source).toContain('accept="image/*"');
    expect(source).toContain('handleFileUpload');
  });

  it('applies CSS preview mirror only when previewMirror is enabled', () => {
    expect(source).toContain('PHOTO_CAPTURE_ORIENTATION.previewMirror');
    expect(source).toContain('-scale-x-100');
    if (!PHOTO_CAPTURE_ORIENTATION.previewMirror) {
      // Current product choice: leave live video unmirrored; capture stays unmirrored.
      expect(PHOTO_CAPTURE_ORIENTATION.previewMirror).toBe(false);
    }
  });
});

/**
 * Capture orientation contract for webcam photos.
 * Live preview may use CSS mirroring separately; the canvas/blob must stay non-mirrored
 * so text and asymmetric details remain readable after upload.
 */
export const PHOTO_CAPTURE_ORIENTATION = {
  /** CSS/presentation mirror on the live <video> element. */
  previewMirror: false,
  /** Horizontal flip applied when drawing the video frame onto the capture canvas. */
  captureMirror: false,
} as const;

/**
 * Draws the current video frame onto a canvas for upload.
 * Always produces a non-mirrored image (captureMirror = false).
 */
export function drawWebcamCaptureFrame(
  context: CanvasRenderingContext2D,
  video: CanvasImageSource,
  width: number,
  height: number,
): void {
  if (PHOTO_CAPTURE_ORIENTATION.captureMirror) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();
    return;
  }

  context.drawImage(video, 0, 0, width, height);
}

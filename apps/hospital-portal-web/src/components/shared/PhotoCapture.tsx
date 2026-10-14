'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PHOTO_CAPTURE_ORIENTATION,
  drawWebcamCaptureFrame,
} from '@/components/shared/photo-capture-orientation';

interface PhotoCaptureProps {
  onPhotoCapture: (file: File, preview: string) => void;
  currentPreview?: string | null;
  optional?: boolean;
  label?: string;
  /** When true, request camera permission and open the live preview immediately. */
  autoStart?: boolean;
  onCancel?: () => void;
}

export default function PhotoCapture({
  onPhotoCapture,
  currentPreview,
  optional = true,
  label = 'Patient Photo',
  autoStart = false,
  onCancel,
}: PhotoCaptureProps) {
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoStartedRef = useRef(false);

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowWebcam(false);
  };

  const startWebcam = async () => {
    try {
      setCameraError(null);
      setShowWebcam(true);
      setCapturedPreview(null);
      setCapturedFile(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      setStream(mediaStream);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {
            setCameraError('Could not start the camera preview.');
          });
        }
      }, 100);
    } catch {
      setCameraError('Could not access the camera. Check browser permissions and try again.');
      setShowWebcam(false);
    }
  };

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startWebcam();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot autoStart
  }, [autoStart]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        drawWebcamCaptureFrame(context, video, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
              const reader = new FileReader();
              reader.onloadend = () => {
                setCapturedFile(file);
                setCapturedPreview(reader.result as string);
                stopWebcam();
              };
              reader.readAsDataURL(file);
            }
          },
          'image/jpeg',
          0.9,
        );
      }
    }
  };

  const useCapturedPhoto = () => {
    if (capturedFile && capturedPreview) {
      onPhotoCapture(capturedFile, capturedPreview);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setCameraError('Please select an image file.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setCameraError('File size must be less than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onPhotoCapture(file, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    onPhotoCapture(null as any, null as any);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    stopWebcam();
    setCapturedPreview(null);
    setCapturedFile(null);
    setCameraError(null);
    onCancel?.();
  };

  const preview = capturedPreview ?? currentPreview;
  const videoClassName = PHOTO_CAPTURE_ORIENTATION.previewMirror
    ? 'w-full max-w-md rounded-lg border-2 border-blue-500 -scale-x-100'
    : 'w-full max-w-md rounded-lg border-2 border-blue-500';

  return (
    <div className="space-y-4" data-testid="photo-capture">
      {!autoStart ? (
        <label className="block text-sm font-medium text-gray-700">
          {label} {optional && <span className="text-gray-500">(Optional)</span>}
        </label>
      ) : null}

      {cameraError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {cameraError}
        </p>
      ) : null}

      {preview && !showWebcam ? (
        <div className="space-y-3">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="h-40 w-40 rounded-lg border-2 border-gray-300 object-cover"
            />
            {!autoStart ? (
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                ×
              </button>
            ) : null}
          </div>
          {autoStart && capturedFile ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={useCapturedPhoto}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                data-testid="photo-capture-use"
              >
                Use Photo
              </button>
              <button
                type="button"
                onClick={() => void startWebcam()}
                className="rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                data-testid="photo-capture-retake"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showWebcam ? (
        <div className="space-y-4">
          <div className="relative">
            <video
              ref={videoRef}
              className={videoClassName}
              autoPlay
              playsInline
              muted
              data-testid="photo-capture-video"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              data-testid="photo-capture-capture"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!autoStart && !showWebcam && !currentPreview ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void startWebcam()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Open Webcam
          </button>
          <label className="cursor-pointer rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Upload Photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : null}

      {!autoStart && !showWebcam && currentPreview ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void startWebcam()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retake with Webcam
          </button>
          <label className="cursor-pointer rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Upload New Photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : null}

      {autoStart && cameraError ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void startWebcam()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

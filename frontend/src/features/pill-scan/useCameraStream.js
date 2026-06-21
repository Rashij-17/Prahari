// deps: react
import { useState, useEffect, useRef, useCallback } from 'react';
import { logError } from '../../shared/error-handler.jsx';

export function useCameraStream() {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' (front) or 'environment' (back)
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError(null);
    stopCamera();

    const constraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      logError('CAMERA_DENIED', err);
      setError('CAMERA_DENIED');
    } finally {
      setLoading(false);
    }
  }, [facingMode, stopCamera]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Capture current frame from video stream to Canvas
  const captureFrame = useCallback((canvasElement) => {
    if (!videoRef.current || !stream) return null;
    const video = videoRef.current;
    const canvas = canvasElement || document.createElement('canvas');
    
    // Match resolution of stream track
    const track = stream.getVideoTracks()[0];
    const settings = track ? track.getSettings() : null;
    const width = settings?.width || video.videoWidth || 640;
    const height = settings?.height || video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  }, [stream]);

  // Restart camera when facingMode changes
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  return {
    videoRef,
    stream,
    facingMode,
    error,
    loading,
    startCamera,
    stopCamera,
    toggleFacingMode,
    captureFrame
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

export default function CameraGate({ onReady, onSkip, required = true }) {
  const [status, setStatus] = useState("prompt"); // "prompt" | "requesting" | "granted" | "denied" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);

  const requestPermissions = useCallback(async () => {
    setStatus("requesting");
    setErrorMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      setStatus("granted");
    } catch (err) {
      setStatus("denied");
      if (err.name === "NotAllowedError") {
        setErrorMessage("Camera and microphone access was denied. Please enable permissions in your browser settings to continue.");
      } else if (err.name === "NotFoundError") {
        setErrorMessage("No camera or microphone found. Please connect a camera and microphone to proceed.");
      } else if (err.name === "NotReadableError") {
        setErrorMessage("Your camera or microphone is already in use by another application. Please close it and try again.");
      } else {
        setErrorMessage(`Unable to access camera/microphone: ${err.message}`);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      // Don't stop the stream on unmount -- it's passed to the behavioral phase
    };
  }, []);

  const handleProceed = useCallback(() => {
    if (streamRef.current) {
      onReady(streamRef.current);
    }
  }, [onReady]);

  const handleRetry = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStatus("prompt");
    setErrorMessage("");
  }, []);

  if (status === "granted") {
    return (
      <div className="camera-gate">
        <div className="camera-gate__card camera-gate__card--ready">
          <div className="camera-gate__preview-wrap">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="camera-gate__preview-video"
            />
            <span className="camera-gate__live-badge">LIVE</span>
          </div>
          <h2 className="camera-gate__title">Camera & Microphone Ready</h2>
          <p className="camera-gate__desc">
            Your interview will be recorded for review. Make sure you're in a
            well-lit, quiet space with your face clearly visible.
          </p>
          <div className="camera-gate__checklist">
            <div className="camera-gate__check-item camera-gate__check-item--ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Camera connected
            </div>
            <div className="camera-gate__check-item camera-gate__check-item--ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Microphone connected
            </div>
            <div className="camera-gate__check-item camera-gate__check-item--ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Recording will start automatically
            </div>
          </div>
          <button className="camera-gate__btn camera-gate__btn--primary" onClick={handleProceed}>
            Begin Interview
          </button>
        </div>
      </div>
    );
  }

  if (status === "denied" || status === "error") {
    return (
      <div className="camera-gate">
        <div className="camera-gate__card camera-gate__card--error">
          <div className="camera-gate__icon camera-gate__icon--error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
          <h2 className="camera-gate__title">Camera Access Required</h2>
          <p className="camera-gate__desc camera-gate__desc--error">{errorMessage}</p>
          <div className="camera-gate__help">
            <h4>How to enable camera access:</h4>
            <ol>
              <li>Click the camera/lock icon in your browser's address bar</li>
              <li>Allow access to both camera and microphone</li>
              <li>Click "Try Again" below</li>
            </ol>
          </div>
          <div className="camera-gate__actions">
            <button className="camera-gate__btn camera-gate__btn--primary" onClick={handleRetry}>
              Try Again
            </button>
            {!required && onSkip && (
              <button className="camera-gate__btn camera-gate__btn--ghost" onClick={onSkip}>
                Skip (not recommended)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "requesting") {
    return (
      <div className="camera-gate">
        <div className="camera-gate__card">
          <div className="camera-gate__icon camera-gate__icon--loading">
            <div className="camera-gate__spinner" />
          </div>
          <h2 className="camera-gate__title">Requesting Access...</h2>
          <p className="camera-gate__desc">
            Please allow camera and microphone access in the browser prompt.
          </p>
        </div>
      </div>
    );
  }

  // Default: prompt state
  return (
    <div className="camera-gate">
      <div className="camera-gate__card">
        <div className="camera-gate__icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <h2 className="camera-gate__title">Camera & Microphone Required</h2>
        <p className="camera-gate__desc">
          This interview requires your camera and microphone to be on. You'll answer
          behavioral questions verbally while being recorded for the interviewer to review.
        </p>
        <div className="camera-gate__requirements">
          <div className="camera-gate__req-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Camera must be on throughout the interview
          </div>
          <div className="camera-gate__req-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Microphone used for spoken answers
          </div>
          <div className="camera-gate__req-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Session will be recorded for review
          </div>
        </div>
        <button className="camera-gate__btn camera-gate__btn--primary" onClick={requestPermissions}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Enable Camera & Microphone
        </button>
        {!required && onSkip && (
          <button className="camera-gate__btn camera-gate__btn--ghost" onClick={onSkip}>
            Continue without camera
          </button>
        )}
      </div>
    </div>
  );
}

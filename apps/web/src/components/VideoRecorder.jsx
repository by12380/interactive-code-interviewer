import { useCallback, useEffect, useRef, useState } from "react";

export default function VideoRecorder({
  onRecordingComplete,
  autoStartRecording = false,
  isPaused = false
}) {
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Request camera permissions and start preview
  const initializeCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: true
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setHasPermission(true);
      setCameraReady(true);

      // Auto-start recording if requested
      if (autoStartRecording) {
        setTimeout(() => startRecording(), 500);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setCameraReady(false);
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please enable camera permissions to continue with the interview.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please connect a camera to continue.");
      } else {
        setError("Unable to access camera. Please check your device settings and try again.");
      }
    }
  }, [autoStartRecording]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (onRecordingComplete && chunksRef.current.length > 0) {
          onRecordingComplete(chunksRef.current);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Unable to start recording. Your camera feed is still active.");
    }
  }, [onRecordingComplete]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  // Pause/Resume recording based on interview pause state
  useEffect(() => {
    if (isPaused && isRecording && mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } else if (!isPaused && isRecording && mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    }
  }, [isPaused, isRecording]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [initializeCamera]);

  // Download recorded video
  const downloadRecording = useCallback(() => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-recording-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Render error state - but still allow continuing without camera
  if (hasPermission === false) {
    return (
      <div className="video-recorder video-recorder--error">
        <div className="video-recorder__error">
          <span className="error-icon">📹</span>
          <p>{error || "Camera access required for the interview."}</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={initializeCamera}>
              Try Again
            </button>
          </div>
          <p className="error-hint">
            Tip: Check your browser's address bar for a camera icon to enable permissions.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (hasPermission === null) {
    return (
      <div className="video-recorder video-recorder--loading">
        <div className="video-recorder__loading">
          <div className="camera-icon-pulse">📹</div>
          <h3>Setting up your camera...</h3>
          <p>Please allow camera access when prompted</p>
          <div className="loading-bar">
            <div className="loading-bar__fill"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-recorder ${isMinimized ? 'video-recorder--minimized' : ''} ${isPaused ? 'video-recorder--paused' : ''}`}>
      {/* Header */}
      <div className="video-recorder__header">
        <div className="video-recorder__status">
          {isRecording && !isPaused && <span className="recording-indicator">●</span>}
          {isRecording && isPaused && <span className="paused-indicator">⏸</span>}
          {!isRecording && cameraReady && <span className="live-indicator">LIVE</span>}
          <span className="video-recorder__title">
            {isRecording ? `Recording ${formatTime(recordingTime)}` : 'Camera'}
          </span>
        </div>
        <div className="video-recorder__controls">
          <button
            className={`mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "⬜" : "➖"}
          </button>
        </div>
      </div>

      {/* Video Preview */}
      {!isMinimized && (
        <div className="video-recorder__preview">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="preview-video"
          />
          {isPaused && (
            <div className="paused-overlay">
              <span>Interview Paused</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="video-recorder__actions">
        <button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={isPaused}
        >
          {isRecording ? (
            <>
              <span className="stop-icon">■</span>
              Stop Recording
            </>
          ) : (
            <>
              <span className="record-icon">●</span>
              {chunksRef.current.length > 0 ? 'Record Again' : 'Start Recording'}
            </>
          )}
        </button>

        {!isRecording && chunksRef.current.length > 0 && (
          <button
            className="download-btn"
            onClick={downloadRecording}
          >
            💾 Save
          </button>
        )}
      </div>

      {/* Info */}
      {!isMinimized && (
        <div className="video-recorder__info">
          {isRecording ? (
            <p>Recording in progress. Click Stop to save.</p>
          ) : (
            <p>Camera is live. Record to save for review.</p>
          )}
        </div>
      )}
    </div>
  );
}

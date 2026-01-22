/**
 * Voice Control Panel - Floating UI component for voice controls in Interview Simulation
 * Provides mic toggle, mute AI, voice activity indicator, recording status, and quick commands
 */

import { memo, useState, useCallback, useEffect } from "react";
import { useVoice } from "../contexts/VoiceContext.jsx";

function VoiceControlPanel({
  onCommand,
  isPaused = false,
  isMinimized: initialMinimized = false,
  position = "bottom-right"
}) {
  const {
    isSupported,
    browserSupport,
    voiceSettings,
    updateVoiceSettings,
    isListening,
    interimTranscript,
    isSpeechActive,
    startListening,
    stopListening,
    isSpeaking,
    cancelSpeech,
    isRecordingAudio,
    recordingDuration,
    startRecording,
    stopRecording,
    error,
    clearError,
    VOICE_COMMANDS
  } = useVoice();
  
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  const [showCommands, setShowCommands] = useState(false);
  const [showError, setShowError] = useState(false);
  
  // Show error notification when error occurs
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);
  
  // Toggle microphone
  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);
  
  // Toggle AI voice mute
  const handleMuteToggle = useCallback(() => {
    if (isSpeaking) {
      cancelSpeech();
    }
    updateVoiceSettings('autoSpeak', !voiceSettings.autoSpeak);
  }, [isSpeaking, cancelSpeech, updateVoiceSettings, voiceSettings.autoSpeak]);
  
  // Toggle voice enabled
  const handleVoiceToggle = useCallback(() => {
    updateVoiceSettings('voiceEnabled', !voiceSettings.voiceEnabled);
    if (voiceSettings.voiceEnabled) {
      stopListening();
      cancelSpeech();
    }
  }, [updateVoiceSettings, voiceSettings.voiceEnabled, stopListening, cancelSpeech]);
  
  // Handle quick command
  const handleQuickCommand = useCallback((command) => {
    if (onCommand) {
      onCommand(command, `Voice command: ${command.description}`);
    }
    setShowCommands(false);
  }, [onCommand]);
  
  // Toggle recording
  const handleRecordingToggle = useCallback(() => {
    if (isRecordingAudio) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecordingAudio, startRecording, stopRecording]);
  
  // Format recording duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  if (!isSupported) {
    return (
      <div className={`voice-control-panel voice-control-panel--unsupported voice-control-panel--${position}`}>
        <div className="voice-control-panel__unsupported-message">
          <span className="voice-control-panel__icon">🎤</span>
          <span>Voice not supported</span>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={`
        voice-control-panel 
        voice-control-panel--${position}
        ${isMinimized ? 'voice-control-panel--minimized' : ''}
        ${isPaused ? 'voice-control-panel--paused' : ''}
        ${isListening ? 'voice-control-panel--listening' : ''}
        ${isSpeaking ? 'voice-control-panel--speaking' : ''}
      `}
    >
      {/* Error notification */}
      {showError && error && (
        <div className="voice-control-panel__error">
          <span className="voice-control-panel__error-icon">⚠️</span>
          <span className="voice-control-panel__error-text">{error}</span>
          <button 
            className="voice-control-panel__error-close"
            onClick={() => { setShowError(false); clearError(); }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="voice-control-panel__header">
        <div className="voice-control-panel__status">
          {isListening && isSpeechActive && (
            <span className="voice-control-panel__status-indicator voice-control-panel__status-indicator--active">
              <span className="pulse-dot"></span>
              Listening...
            </span>
          )}
          {isListening && !isSpeechActive && (
            <span className="voice-control-panel__status-indicator voice-control-panel__status-indicator--ready">
              <span className="mic-icon">🎤</span>
              Ready
            </span>
          )}
          {!isListening && !isSpeaking && (
            <span className="voice-control-panel__status-indicator voice-control-panel__status-indicator--off">
              Voice Off
            </span>
          )}
          {isSpeaking && (
            <span className="voice-control-panel__status-indicator voice-control-panel__status-indicator--speaking">
              <span className="speaking-icon">🔊</span>
              AI Speaking
            </span>
          )}
        </div>
        
        <button
          className="voice-control-panel__minimize-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          aria-label={isMinimized ? "Expand voice controls" : "Minimize voice controls"}
        >
          {isMinimized ? '⬆️' : '⬇️'}
        </button>
      </div>
      
      {/* Interim transcript preview */}
      {!isMinimized && interimTranscript && (
        <div className="voice-control-panel__transcript-preview">
          <span className="voice-control-panel__transcript-label">Hearing:</span>
          <span className="voice-control-panel__transcript-text">{interimTranscript}</span>
        </div>
      )}
      
      {/* Main controls */}
      {!isMinimized && (
        <div className="voice-control-panel__controls">
          {/* Master voice toggle */}
          <button
            className={`voice-control-panel__btn voice-control-panel__btn--master ${voiceSettings.voiceEnabled ? 'active' : ''}`}
            onClick={handleVoiceToggle}
            disabled={isPaused}
            aria-label={voiceSettings.voiceEnabled ? "Disable voice features" : "Enable voice features"}
            title={voiceSettings.voiceEnabled ? "Voice On" : "Voice Off"}
          >
            <span className="voice-control-panel__btn-icon">
              {voiceSettings.voiceEnabled ? '🎙️' : '🔇'}
            </span>
          </button>
          
          {/* Mic toggle */}
          <button
            className={`voice-control-panel__btn voice-control-panel__btn--mic ${isListening ? 'active' : ''} ${isSpeechActive ? 'speaking' : ''}`}
            onClick={handleMicToggle}
            disabled={isPaused || !voiceSettings.voiceEnabled}
            aria-label={isListening ? "Stop listening" : "Start listening"}
            title={isListening ? "Mic On (click to stop)" : "Mic Off (click to start)"}
          >
            <span className="voice-control-panel__btn-icon">
              {isListening ? (isSpeechActive ? '🗣️' : '🎤') : '🎤'}
            </span>
            {isListening && (
              <span className="voice-control-panel__btn-pulse"></span>
            )}
          </button>
          
          {/* Mute AI voice */}
          <button
            className={`voice-control-panel__btn voice-control-panel__btn--mute ${!voiceSettings.autoSpeak ? 'muted' : ''}`}
            onClick={handleMuteToggle}
            disabled={isPaused || !voiceSettings.voiceEnabled}
            aria-label={voiceSettings.autoSpeak ? "Mute AI voice" : "Unmute AI voice"}
            title={voiceSettings.autoSpeak ? "AI Voice On" : "AI Voice Muted"}
          >
            <span className="voice-control-panel__btn-icon">
              {voiceSettings.autoSpeak ? '🔊' : '🔇'}
            </span>
            {isSpeaking && (
              <span className="voice-control-panel__btn-speaking-indicator"></span>
            )}
          </button>
          
          {/* Recording toggle */}
          <button
            className={`voice-control-panel__btn voice-control-panel__btn--record ${isRecordingAudio ? 'recording' : ''}`}
            onClick={handleRecordingToggle}
            disabled={isPaused}
            aria-label={isRecordingAudio ? "Stop recording" : "Start recording"}
            title={isRecordingAudio ? `Recording ${formatDuration(recordingDuration)}` : "Record conversation"}
          >
            <span className="voice-control-panel__btn-icon">
              {isRecordingAudio ? '⏹️' : '⏺️'}
            </span>
            {isRecordingAudio && (
              <span className="voice-control-panel__recording-time">
                {formatDuration(recordingDuration)}
              </span>
            )}
          </button>
          
          {/* Commands menu toggle */}
          <button
            className={`voice-control-panel__btn voice-control-panel__btn--commands ${showCommands ? 'active' : ''}`}
            onClick={() => setShowCommands(!showCommands)}
            disabled={isPaused}
            aria-label="Show voice commands"
            title="Voice Commands"
          >
            <span className="voice-control-panel__btn-icon">⌨️</span>
          </button>
        </div>
      )}
      
      {/* Voice commands quick menu */}
      {!isMinimized && showCommands && (
        <div className="voice-control-panel__commands-menu">
          <div className="voice-control-panel__commands-header">
            <span>Voice Commands</span>
            <span className="voice-control-panel__commands-hint">Say or click:</span>
          </div>
          <div className="voice-control-panel__commands-list">
            {Object.entries(VOICE_COMMANDS).map(([key, command]) => (
              <button
                key={key}
                className="voice-control-panel__command-btn"
                onClick={() => handleQuickCommand(command)}
                disabled={isPaused}
              >
                <span className="voice-control-panel__command-phrase">
                  "{command.phrases[0]}"
                </span>
                <span className="voice-control-panel__command-desc">
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Minimized view */}
      {isMinimized && (
        <div className="voice-control-panel__minimized-controls">
          <button
            className={`voice-control-panel__mini-btn ${isListening ? 'active' : ''}`}
            onClick={handleMicToggle}
            disabled={isPaused || !voiceSettings.voiceEnabled}
            aria-label={isListening ? "Stop listening" : "Start listening"}
          >
            {isListening ? (isSpeechActive ? '🗣️' : '🎤') : '🎤'}
          </button>
          {isRecordingAudio && (
            <span className="voice-control-panel__mini-recording">
              ⏺️ {formatDuration(recordingDuration)}
            </span>
          )}
        </div>
      )}
      
      {/* Pause overlay */}
      {isPaused && (
        <div className="voice-control-panel__paused-overlay">
          <span>Interview Paused</span>
        </div>
      )}
    </div>
  );
}

export default memo(VoiceControlPanel);

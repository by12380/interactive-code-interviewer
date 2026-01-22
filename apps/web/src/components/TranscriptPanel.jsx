/**
 * Transcript Panel - Live conversation transcript display
 * Shows real-time transcript updates with speaker identification, timestamps, and export
 */

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { useVoice } from "../contexts/VoiceContext.jsx";

function TranscriptPanel({
  isVisible = true,
  onClose,
  isPaused = false,
  className = ""
}) {
  const {
    transcript,
    clearTranscript,
    exportTranscript,
    interimTranscript,
    isSpeechActive,
    downloadRecording,
    isRecordingAudio,
    getRecordingBlob
  } = useVoice();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const scrollRef = useRef(null);
  const autoScrollRef = useRef(true);
  
  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);
  
  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      autoScrollRef.current = isAtBottom;
    }
  }, []);
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      autoScrollRef.current = true;
    }
  }, []);
  
  // Filter transcript entries by search query
  const filteredTranscript = searchQuery
    ? transcript.filter(entry => 
        entry.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transcript;
  
  // Format timestamp
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Export as JSON
  const handleExportJSON = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      entries: transcript.map(entry => ({
        speaker: entry.speaker,
        text: entry.text,
        timestamp: entry.timestamp,
        isCommand: entry.isCommand || false,
        command: entry.command || null
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [transcript]);
  
  // Export as text
  const handleExportText = useCallback(() => {
    exportTranscript();
    setShowExportMenu(false);
  }, [exportTranscript]);
  
  // Export audio
  const handleExportAudio = useCallback(() => {
    downloadRecording('interview-conversation');
    setShowExportMenu(false);
  }, [downloadRecording]);
  
  // Clear and confirm
  const handleClear = useCallback(() => {
    if (transcript.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear the transcript? This cannot be undone.')) {
      clearTranscript();
    }
  }, [transcript.length, clearTranscript]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className={`transcript-panel ${isCollapsed ? 'transcript-panel--collapsed' : ''} ${className}`}>
      {/* Header */}
      <div className="transcript-panel__header">
        <div className="transcript-panel__title">
          <span className="transcript-panel__icon">📝</span>
          <span>Conversation Transcript</span>
          <span className="transcript-panel__count">({transcript.length})</span>
        </div>
        
        <div className="transcript-panel__actions">
          {/* Search */}
          {!isCollapsed && (
            <div className="transcript-panel__search">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="transcript-panel__search-input"
              />
              {searchQuery && (
                <button 
                  className="transcript-panel__search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}
          
          {/* Export button */}
          {!isCollapsed && transcript.length > 0 && (
            <div className="transcript-panel__export-wrapper">
              <button
                className="transcript-panel__action-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                aria-label="Export transcript"
                title="Export"
              >
                📥
              </button>
              
              {showExportMenu && (
                <div className="transcript-panel__export-menu">
                  <button onClick={handleExportText}>
                    📄 Export as Text
                  </button>
                  <button onClick={handleExportJSON}>
                    📋 Export as JSON
                  </button>
                  {getRecordingBlob() && (
                    <button onClick={handleExportAudio}>
                      🎵 Export Audio
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Clear button */}
          {!isCollapsed && transcript.length > 0 && (
            <button
              className="transcript-panel__action-btn transcript-panel__action-btn--danger"
              onClick={handleClear}
              aria-label="Clear transcript"
              title="Clear"
            >
              🗑️
            </button>
          )}
          
          {/* Collapse toggle */}
          <button
            className="transcript-panel__action-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand transcript" : "Collapse transcript"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? '⬆️' : '⬇️'}
          </button>
          
          {/* Close button */}
          {onClose && (
            <button
              className="transcript-panel__action-btn"
              onClick={onClose}
              aria-label="Close transcript"
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <>
          {/* Transcript list */}
          <div 
            className="transcript-panel__content"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {filteredTranscript.length === 0 && !interimTranscript && (
              <div className="transcript-panel__empty">
                {searchQuery ? (
                  <>
                    <span className="transcript-panel__empty-icon">🔍</span>
                    <span>No results for "{searchQuery}"</span>
                  </>
                ) : (
                  <>
                    <span className="transcript-panel__empty-icon">🎤</span>
                    <span>Start speaking to see the transcript</span>
                    <span className="transcript-panel__empty-hint">
                      Voice commands and conversation will appear here
                    </span>
                  </>
                )}
              </div>
            )}
            
            {filteredTranscript.map((entry, index) => (
              <div
                key={entry.id || index}
                className={`
                  transcript-panel__entry
                  transcript-panel__entry--${entry.speaker}
                  ${entry.isCommand ? 'transcript-panel__entry--command' : ''}
                `}
              >
                <div className="transcript-panel__entry-header">
                  <span className="transcript-panel__speaker">
                    {entry.speaker === 'ai' ? (
                      <>
                        <span className="transcript-panel__speaker-icon">🤖</span>
                        Interviewer
                      </>
                    ) : (
                      <>
                        <span className="transcript-panel__speaker-icon">👤</span>
                        You
                      </>
                    )}
                  </span>
                  <span className="transcript-panel__time">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                
                <div className="transcript-panel__entry-content">
                  {entry.isCommand && (
                    <span className="transcript-panel__command-badge">
                      Command
                    </span>
                  )}
                  <span className="transcript-panel__text">{entry.text}</span>
                </div>
              </div>
            ))}
            
            {/* Interim transcript (currently being spoken) */}
            {interimTranscript && (
              <div className="transcript-panel__entry transcript-panel__entry--user transcript-panel__entry--interim">
                <div className="transcript-panel__entry-header">
                  <span className="transcript-panel__speaker">
                    <span className="transcript-panel__speaker-icon">👤</span>
                    You
                    <span className="transcript-panel__interim-indicator">
                      (listening...)
                    </span>
                  </span>
                </div>
                <div className="transcript-panel__entry-content">
                  <span className="transcript-panel__text transcript-panel__text--interim">
                    {interimTranscript}
                  </span>
                  {isSpeechActive && (
                    <span className="transcript-panel__speech-indicator">
                      <span className="pulse-dot"></span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Footer with scroll to bottom button */}
          <div className="transcript-panel__footer">
            {!autoScrollRef.current && (
              <button
                className="transcript-panel__scroll-btn"
                onClick={scrollToBottom}
                aria-label="Scroll to bottom"
              >
                ⬇️ Scroll to latest
              </button>
            )}
            
            {isRecordingAudio && (
              <span className="transcript-panel__recording-badge">
                <span className="recording-dot"></span>
                Recording
              </span>
            )}
          </div>
        </>
      )}
      
      {/* Paused overlay */}
      {isPaused && !isCollapsed && (
        <div className="transcript-panel__paused-overlay">
          <span>Paused</span>
        </div>
      )}
    </div>
  );
}

export default memo(TranscriptPanel);

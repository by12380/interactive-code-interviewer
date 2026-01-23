import { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import {
  getStateAtTimestamp,
  generateHeatmapData,
  getReplayStats,
  formatDuration,
  compareReplays,
} from "../services/codeReplayService.js";

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 4];

function CodeReplayPanel({
  replay,
  onClose,
  problemTitle = "Problem",
  allReplays = [], // For comparison feature
}) {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareReplayId, setCompareReplayId] = useState(null);
  const [activeTab, setActiveTab] = useState("replay"); // 'replay' | 'stats' | 'compare'
  
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const playIntervalRef = useRef(null);
  const decorationsRef = useRef([]);
  
  const duration = replay?.duration || 0;
  const stats = useMemo(() => getReplayStats(replay), [replay]);
  const heatmapData = useMemo(() => generateHeatmapData(replay), [replay]);
  
  // Get current state based on playback position
  const currentState = useMemo(() => {
    return getStateAtTimestamp(replay, currentTime);
  }, [replay, currentTime]);
  
  // Get other replays for comparison (same problem)
  const comparableReplays = useMemo(() => {
    if (!replay?.problemId) return [];
    return allReplays
      .filter(r => r.id !== replay.id && r.problemId === replay.problemId)
      .slice(0, 10);
  }, [allReplays, replay]);
  
  // Comparison data
  const comparisonData = useMemo(() => {
    if (!compareReplayId || !replay) return null;
    const otherReplay = comparableReplays.find(r => r.id === compareReplayId);
    if (!otherReplay) return null;
    return compareReplays(otherReplay, replay);
  }, [compareReplayId, replay, comparableReplays]);

  // Handle editor mount
  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Make editor read-only for replay
    editor.updateOptions({ readOnly: true });
  }, []);

  // Apply heatmap decorations
  const applyHeatmapDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !showHeatmap) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = editor?.deltaDecorations(decorationsRef.current, []) || [];
      }
      return;
    }
    
    const decorations = heatmapData.map(({ line, intensity }) => {
      // Color from green (low) to red (high intensity)
      const r = Math.round(255 * intensity);
      const g = Math.round(255 * (1 - intensity));
      const bgColor = `rgba(${r}, ${g}, 100, 0.3)`;
      
      return {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: `heatmap-line-${Math.round(intensity * 10)}`,
          glyphMarginClassName: 'heatmap-glyph',
          overviewRuler: {
            color: `rgba(${r}, ${g}, 100, 0.8)`,
            position: monaco.editor.OverviewRulerLane.Right,
          },
          minimap: {
            color: `rgba(${r}, ${g}, 100, 0.5)`,
            position: monaco.editor.MinimapPosition.Inline,
          },
          linesDecorationsClassName: `heatmap-decoration intensity-${Math.round(intensity * 10)}`,
        }
      };
    });
    
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [showHeatmap, heatmapData]);

  // Update decorations when heatmap toggle changes
  useEffect(() => {
    applyHeatmapDecorations();
  }, [applyHeatmapDecorations]);

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }
    
    const interval = 50; // Update every 50ms for smooth playback
    const timeIncrement = interval * playbackSpeed;
    
    playIntervalRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + timeIncrement;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
    }, interval);
    
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, duration]);

  // Set cursor position in editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !currentState.cursorPosition) return;
    
    try {
      editor.setPosition(currentState.cursorPosition);
      editor.revealPositionInCenter(currentState.cursorPosition);
    } catch (e) {
      // Position might be invalid
    }
  }, [currentState.cursorPosition]);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying(prev => !prev);
  }, [currentTime, duration]);

  const handleSeek = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleSkipToEnd = useCallback(() => {
    setCurrentTime(duration);
    setIsPlaying(false);
  }, [duration]);

  const handleToggleHeatmap = useCallback(() => {
    setShowHeatmap(prev => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(prev => Math.max(0, prev - 5000));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(prev => Math.min(duration, prev + 5000));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, duration, onClose]);

  if (!replay) {
    return (
      <div className="replay-modal">
        <div className="replay-modal__backdrop" onClick={onClose} />
        <div className="replay-modal__content">
          <div className="replay-modal__header">
            <h2>No Replay Available</h2>
            <button className="replay-modal__close" onClick={onClose}>×</button>
          </div>
          <div className="replay__empty">
            <p>No replay data found for this session.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-modal">
      <div className="replay-modal__backdrop" onClick={onClose} />
      <div className="replay-modal__content">
        <div className="replay-modal__header">
          <div className="replay__header-info">
            <h2>Code Replay</h2>
            <span className="replay__problem-title">{problemTitle}</span>
          </div>
          <button 
            className="replay-modal__close" 
            onClick={onClose}
            aria-label="Close replay"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="replay__tabs">
          <button
            className={`replay__tab ${activeTab === 'replay' ? 'replay__tab--active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            Playback
          </button>
          <button
            className={`replay__tab ${activeTab === 'stats' ? 'replay__tab--active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
          {comparableReplays.length > 0 && (
            <button
              className={`replay__tab ${activeTab === 'compare' ? 'replay__tab--active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              Compare Attempts
            </button>
          )}
        </div>

        <div className="replay__body">
          {activeTab === 'replay' && (
            <>
              {/* Editor with replay */}
              <div className="replay__editor-container">
                <Editor
                  height="400px"
                  defaultLanguage="javascript"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={currentState.code}
                  onMount={handleEditorMount}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    glyphMargin: showHeatmap,
                  }}
                />
                
                {/* Heatmap legend */}
                {showHeatmap && (
                  <div className="replay__heatmap-legend">
                    <span className="replay__heatmap-label">Time spent:</span>
                    <div className="replay__heatmap-gradient">
                      <span>Low</span>
                      <div className="replay__heatmap-bar" />
                      <span>High</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Playback controls */}
              <div className="replay__controls">
                <div className="replay__controls-row">
                  <div className="replay__control-buttons">
                    <button 
                      className="replay__control-btn"
                      onClick={handleRestart}
                      title="Restart (Home)"
                    >
                      ⏮
                    </button>
                    <button 
                      className="replay__control-btn replay__control-btn--primary"
                      onClick={handlePlayPause}
                      title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                      {isPlaying ? '⏸' : '▶'}
                    </button>
                    <button 
                      className="replay__control-btn"
                      onClick={handleSkipToEnd}
                      title="Skip to end (End)"
                    >
                      ⏭
                    </button>
                  </div>

                  <div className="replay__time-display">
                    <span className="replay__current-time">{formatDuration(currentTime)}</span>
                    <span className="replay__time-separator">/</span>
                    <span className="replay__total-time">{formatDuration(duration)}</span>
                  </div>

                  <div className="replay__speed-controls">
                    <span className="replay__speed-label">Speed:</span>
                    {PLAYBACK_SPEEDS.map(speed => (
                      <button
                        key={speed}
                        className={`replay__speed-btn ${playbackSpeed === speed ? 'replay__speed-btn--active' : ''}`}
                        onClick={() => handleSpeedChange(speed)}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <button
                    className={`replay__heatmap-toggle ${showHeatmap ? 'replay__heatmap-toggle--active' : ''}`}
                    onClick={handleToggleHeatmap}
                    title="Toggle heatmap overlay"
                  >
                    🔥 Heatmap
                  </button>
                </div>

                {/* Scrubber/Timeline */}
                <div className="replay__timeline">
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="replay__scrubber"
                  />
                  <div 
                    className="replay__progress"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>

                <div className="replay__keyboard-hints">
                  <span>Space: Play/Pause</span>
                  <span>←/→: Skip 5s</span>
                  <span>Esc: Close</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'stats' && stats && (
            <div className="replay__stats">
              <div className="replay__stats-grid">
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">⏱</span>
                  <span className="replay__stat-value">{stats.durationFormatted}</span>
                  <span className="replay__stat-label">Total Time</span>
                </div>
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">⌨</span>
                  <span className="replay__stat-value">{stats.codeChanges}</span>
                  <span className="replay__stat-label">Code Changes</span>
                </div>
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">📝</span>
                  <span className="replay__stat-value">{stats.totalLines}</span>
                  <span className="replay__stat-label">Final Lines</span>
                </div>
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">💨</span>
                  <span className="replay__stat-value">{stats.avgTypingSpeed}</span>
                  <span className="replay__stat-label">Avg Speed (cpm)</span>
                </div>
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">📊</span>
                  <span className="replay__stat-value">{stats.typingBursts}</span>
                  <span className="replay__stat-label">Typing Bursts</span>
                </div>
                <div className="replay__stat-card">
                  <span className="replay__stat-icon">🎯</span>
                  <span className="replay__stat-value">{stats.charactersTyped}</span>
                  <span className="replay__stat-label">Chars Added</span>
                </div>
              </div>

              {/* Heatmap visualization */}
              <div className="replay__stats-section">
                <h3>Time Spent by Line (Heatmap)</h3>
                <div className="replay__line-heatmap">
                  {heatmapData.length > 0 ? (
                    <div className="replay__heatmap-bars">
                      {heatmapData.map(({ line, time, intensity }) => (
                        <div 
                          key={line}
                          className="replay__heatmap-bar-item"
                          title={`Line ${line}: ${formatDuration(time)}`}
                        >
                          <span className="replay__heatmap-line-num">{line}</span>
                          <div 
                            className="replay__heatmap-bar-fill"
                            style={{ 
                              width: `${intensity * 100}%`,
                              backgroundColor: `rgba(${Math.round(255 * intensity)}, ${Math.round(255 * (1 - intensity))}, 100, 0.8)`
                            }}
                          />
                          <span className="replay__heatmap-time">{formatDuration(time)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="replay__stats-empty">No line activity data available.</p>
                  )}
                </div>
              </div>

              {stats.hottestLine && (
                <div className="replay__insight">
                  <span className="replay__insight-icon">💡</span>
                  <span>You spent the most time on <strong>Line {stats.hottestLine}</strong></span>
                </div>
              )}

              {replay.metadata?.score && (
                <div className="replay__performance-summary">
                  <h3>Performance</h3>
                  <div className="replay__performance-row">
                    <span>Score:</span>
                    <strong>{replay.metadata.score}</strong>
                  </div>
                  {replay.metadata?.grade && (
                    <div className="replay__performance-row">
                      <span>Grade:</span>
                      <strong className={`replay__grade replay__grade--${replay.metadata.grade.charAt(0).toLowerCase()}`}>
                        {replay.metadata.grade}
                      </strong>
                    </div>
                  )}
                  {replay.metadata?.testsPassed !== undefined && (
                    <div className="replay__performance-row">
                      <span>Tests:</span>
                      <strong>{replay.metadata.testsPassed}/{replay.metadata.testsTotal}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="replay__compare">
              <div className="replay__compare-selector">
                <label>Compare with:</label>
                <select 
                  value={compareReplayId || ''} 
                  onChange={(e) => setCompareReplayId(e.target.value || null)}
                >
                  <option value="">Select a previous attempt...</option>
                  {comparableReplays.map(r => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.createdAt).toLocaleDateString()} - 
                      Score: {r.metadata?.score || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              {comparisonData ? (
                <div className="replay__comparison-results">
                  <div className="replay__comparison-header">
                    <div className="replay__comparison-col">
                      <span className="replay__comparison-label">Previous Attempt</span>
                      <span className="replay__comparison-date">
                        {new Date(comparisonData.replay1.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="replay__comparison-vs">vs</div>
                    <div className="replay__comparison-col">
                      <span className="replay__comparison-label">This Attempt</span>
                      <span className="replay__comparison-date">
                        {new Date(comparisonData.replay2.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="replay__comparison-metrics">
                    <div className="replay__comparison-metric">
                      <span className="replay__comparison-metric-label">Duration</span>
                      <div className="replay__comparison-metric-values">
                        <span>{comparisonData.replay1.stats.durationFormatted}</span>
                        <span className={`replay__comparison-diff ${comparisonData.comparison.durationDiff < 0 ? 'positive' : comparisonData.comparison.durationDiff > 0 ? 'negative' : ''}`}>
                          {comparisonData.comparison.durationDiff < 0 ? '↓' : comparisonData.comparison.durationDiff > 0 ? '↑' : '='} 
                          {formatDuration(Math.abs(comparisonData.comparison.durationDiff))}
                        </span>
                        <span>{comparisonData.replay2.stats.durationFormatted}</span>
                      </div>
                    </div>

                    <div className="replay__comparison-metric">
                      <span className="replay__comparison-metric-label">Score</span>
                      <div className="replay__comparison-metric-values">
                        <span>{comparisonData.replay1.metadata?.score || 'N/A'}</span>
                        <span className={`replay__comparison-diff ${comparisonData.comparison.scoreDiff > 0 ? 'positive' : comparisonData.comparison.scoreDiff < 0 ? 'negative' : ''}`}>
                          {comparisonData.comparison.scoreDiff > 0 ? '+' : ''}{comparisonData.comparison.scoreDiff}
                        </span>
                        <span>{comparisonData.replay2.metadata?.score || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="replay__comparison-metric">
                      <span className="replay__comparison-metric-label">Typing Speed</span>
                      <div className="replay__comparison-metric-values">
                        <span>{comparisonData.replay1.stats.avgTypingSpeed} cpm</span>
                        <span className={`replay__comparison-diff ${comparisonData.comparison.typingSpeedDiff > 0 ? 'positive' : comparisonData.comparison.typingSpeedDiff < 0 ? 'negative' : ''}`}>
                          {comparisonData.comparison.typingSpeedDiff > 0 ? '+' : ''}{comparisonData.comparison.typingSpeedDiff}
                        </span>
                        <span>{comparisonData.replay2.stats.avgTypingSpeed} cpm</span>
                      </div>
                    </div>

                    <div className="replay__comparison-metric">
                      <span className="replay__comparison-metric-label">Code Changes</span>
                      <div className="replay__comparison-metric-values">
                        <span>{comparisonData.replay1.stats.codeChanges}</span>
                        <span className="replay__comparison-diff">
                          →
                        </span>
                        <span>{comparisonData.replay2.stats.codeChanges}</span>
                      </div>
                    </div>
                  </div>

                  {comparisonData.comparison.improved && (
                    <div className="replay__comparison-verdict replay__comparison-verdict--improved">
                      <span>🎉</span>
                      <span>You improved your score!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="replay__compare-empty">
                  <p>Select a previous attempt to compare your progress over time.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CodeReplayPanel);

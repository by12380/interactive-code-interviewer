// Code Replay Service - Records and plays back coding sessions
// Records every keystroke with timestamps for detailed session replay

const REPLAY_STORAGE_KEY = 'code_interviewer_replays';
const MAX_REPLAYS_PER_USER = 50; // Limit storage usage

/**
 * Creates a new recording session
 * @param {string} problemId - The problem being worked on
 * @param {string} starterCode - Initial code in the editor
 * @returns {object} - Recording session object
 */
export const createRecordingSession = (problemId, starterCode = '') => {
  return {
    problemId,
    startTime: Date.now(),
    events: [],
    starterCode,
    currentCode: starterCode,
    metadata: {
      totalPauses: 0,
      totalPauseDuration: 0,
    }
  };
};

/**
 * Records a code change event
 * @param {object} session - The current recording session
 * @param {string} newCode - The new code state
 * @param {object} changeInfo - Monaco change event info (optional)
 * @returns {object} - Updated session
 */
export const recordCodeChange = (session, newCode, changeInfo = null) => {
  if (!session) return session;
  
  const timestamp = Date.now() - session.startTime;
  
  // Calculate diff from previous state for efficient storage
  const prevCode = session.currentCode;
  const event = {
    type: 'code_change',
    timestamp,
    code: newCode,
    // Store change info if available (from Monaco)
    changeInfo: changeInfo ? {
      range: changeInfo.range,
      text: changeInfo.text,
      rangeLength: changeInfo.rangeLength,
    } : null,
    // Character count for heatmap
    charDelta: newCode.length - prevCode.length,
    lineCount: newCode.split('\n').length,
  };
  
  return {
    ...session,
    events: [...session.events, event],
    currentCode: newCode,
  };
};

/**
 * Records a cursor position change
 * @param {object} session - The current recording session
 * @param {object} position - Cursor position {lineNumber, column}
 * @returns {object} - Updated session
 */
export const recordCursorMove = (session, position) => {
  if (!session) return session;
  
  const timestamp = Date.now() - session.startTime;
  const event = {
    type: 'cursor_move',
    timestamp,
    position,
  };
  
  return {
    ...session,
    events: [...session.events, event],
  };
};

/**
 * Records a selection change
 * @param {object} session - The current recording session
 * @param {object} selection - Selection range
 * @returns {object} - Updated session
 */
export const recordSelection = (session, selection) => {
  if (!session) return session;
  
  const timestamp = Date.now() - session.startTime;
  const event = {
    type: 'selection',
    timestamp,
    selection,
  };
  
  return {
    ...session,
    events: [...session.events, event],
  };
};

/**
 * Records a pause/resume event
 * @param {object} session - The current recording session
 * @param {boolean} isPaused - Whether the session is paused
 * @returns {object} - Updated session
 */
export const recordPauseEvent = (session, isPaused) => {
  if (!session) return session;
  
  const timestamp = Date.now() - session.startTime;
  const event = {
    type: isPaused ? 'pause' : 'resume',
    timestamp,
  };
  
  return {
    ...session,
    events: [...session.events, event],
    metadata: {
      ...session.metadata,
      totalPauses: session.metadata.totalPauses + (isPaused ? 1 : 0),
    }
  };
};

/**
 * Finalizes a recording session
 * @param {object} session - The recording session
 * @param {object} interviewData - Data from the completed interview
 * @returns {object} - Finalized replay data
 */
export const finalizeRecording = (session, interviewData = {}) => {
  if (!session) return null;
  
  const endTime = Date.now();
  const duration = endTime - session.startTime;
  
  // Calculate time spent on each line for heatmap
  const lineTimeMap = calculateLineTimeMap(session.events);
  
  return {
    id: 'replay_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    problemId: session.problemId,
    starterCode: session.starterCode,
    finalCode: session.currentCode,
    events: session.events,
    duration,
    createdAt: new Date().toISOString(),
    metadata: {
      ...session.metadata,
      eventCount: session.events.length,
      lineTimeMap,
      ...interviewData,
    }
  };
};

/**
 * Calculates time spent on each line (for heatmap)
 * @param {Array} events - Recording events
 * @returns {object} - Map of line numbers to time spent
 */
const calculateLineTimeMap = (events) => {
  const lineTimeMap = {};
  let lastCursorLine = 1;
  let lastTimestamp = 0;
  
  events.forEach(event => {
    if (event.type === 'cursor_move') {
      // Add time to the previous line
      const timeOnLine = event.timestamp - lastTimestamp;
      lineTimeMap[lastCursorLine] = (lineTimeMap[lastCursorLine] || 0) + timeOnLine;
      lastCursorLine = event.position.lineNumber;
      lastTimestamp = event.timestamp;
    } else if (event.type === 'code_change' && event.changeInfo?.range) {
      // Track time on the line being edited
      const line = event.changeInfo.range.startLineNumber;
      const timeOnLine = event.timestamp - lastTimestamp;
      lineTimeMap[line] = (lineTimeMap[line] || 0) + timeOnLine;
      lastCursorLine = line;
      lastTimestamp = event.timestamp;
    }
  });
  
  return lineTimeMap;
};

/**
 * Gets replay state at a specific timestamp
 * @param {object} replay - The replay data
 * @param {number} timestamp - Target timestamp in ms
 * @returns {object} - State at that timestamp
 */
export const getStateAtTimestamp = (replay, timestamp) => {
  if (!replay || !replay.events) {
    return { code: replay?.starterCode || '', cursorPosition: null };
  }
  
  let code = replay.starterCode;
  let cursorPosition = null;
  let selection = null;
  
  // Find all events up to the timestamp
  for (const event of replay.events) {
    if (event.timestamp > timestamp) break;
    
    if (event.type === 'code_change') {
      code = event.code;
    } else if (event.type === 'cursor_move') {
      cursorPosition = event.position;
    } else if (event.type === 'selection') {
      selection = event.selection;
    }
  }
  
  return { code, cursorPosition, selection };
};

/**
 * Gets the next event after a timestamp
 * @param {object} replay - The replay data
 * @param {number} currentTimestamp - Current timestamp
 * @returns {object|null} - Next event or null
 */
export const getNextEvent = (replay, currentTimestamp) => {
  if (!replay?.events) return null;
  
  return replay.events.find(event => event.timestamp > currentTimestamp) || null;
};

/**
 * Generates heatmap data from replay
 * @param {object} replay - The replay data
 * @returns {Array} - Array of {line, intensity} for visualization
 */
export const generateHeatmapData = (replay) => {
  if (!replay?.metadata?.lineTimeMap) return [];
  
  const lineTimeMap = replay.metadata.lineTimeMap;
  const maxTime = Math.max(...Object.values(lineTimeMap), 1);
  
  return Object.entries(lineTimeMap).map(([line, time]) => ({
    line: parseInt(line),
    time,
    intensity: time / maxTime, // 0-1 normalized intensity
  })).sort((a, b) => a.line - b.line);
};

/**
 * Gets replay statistics
 * @param {object} replay - The replay data
 * @returns {object} - Statistics about the replay
 */
export const getReplayStats = (replay) => {
  if (!replay) return null;
  
  const events = replay.events || [];
  const codeChanges = events.filter(e => e.type === 'code_change');
  const cursorMoves = events.filter(e => e.type === 'cursor_move');
  
  // Calculate typing bursts (periods of continuous typing)
  let bursts = 0;
  let inBurst = false;
  let lastChangeTime = 0;
  
  codeChanges.forEach(event => {
    if (event.timestamp - lastChangeTime > 3000) { // 3 second gap = new burst
      if (inBurst) bursts++;
      inBurst = true;
    }
    lastChangeTime = event.timestamp;
  });
  if (inBurst) bursts++;
  
  // Find the line with most activity
  const heatmap = generateHeatmapData(replay);
  const hottestLine = heatmap.length > 0 
    ? heatmap.reduce((max, item) => item.time > max.time ? item : max, heatmap[0])
    : null;
  
  return {
    duration: replay.duration,
    durationFormatted: formatDuration(replay.duration),
    totalEvents: events.length,
    codeChanges: codeChanges.length,
    cursorMoves: cursorMoves.length,
    typingBursts: bursts,
    totalLines: replay.finalCode?.split('\n').length || 0,
    charactersTyped: replay.finalCode?.length - replay.starterCode?.length || 0,
    hottestLine: hottestLine?.line || null,
    avgTypingSpeed: codeChanges.length > 0 
      ? Math.round((codeChanges.length / (replay.duration / 60000)) * 60) // chars per min approx
      : 0,
  };
};

/**
 * Formats duration in ms to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
export const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// ===== Storage Functions =====

/**
 * Gets all stored replays from localStorage
 * @returns {object} - Map of replayId -> replay data
 */
const getStoredReplays = () => {
  try {
    const stored = localStorage.getItem(REPLAY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

/**
 * Saves replays to localStorage
 * @param {object} replays - Map of replayId -> replay data
 */
const saveReplays = (replays) => {
  try {
    localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replays));
  } catch (e) {
    console.error('Failed to save replays:', e);
    // Storage might be full - try to clean up old replays
    cleanupOldReplays();
  }
};

/**
 * Cleans up old replays to free storage
 */
const cleanupOldReplays = () => {
  const replays = getStoredReplays();
  const replayList = Object.values(replays);
  
  if (replayList.length <= MAX_REPLAYS_PER_USER / 2) return;
  
  // Sort by creation date and keep only the newest half
  replayList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const toKeep = replayList.slice(0, MAX_REPLAYS_PER_USER / 2);
  
  const newReplays = {};
  toKeep.forEach(replay => {
    newReplays[replay.id] = replay;
  });
  
  saveReplays(newReplays);
};

/**
 * Saves a replay for a user
 * @param {string} interviewId - The interview ID to associate with
 * @param {object} replayData - The finalized replay data
 * @returns {boolean} - Success status
 */
export const saveReplay = (interviewId, replayData) => {
  if (!replayData) return false;
  
  try {
    const replays = getStoredReplays();
    
    // Check if we need to clean up
    if (Object.keys(replays).length >= MAX_REPLAYS_PER_USER) {
      cleanupOldReplays();
    }
    
    // Save with interview ID reference
    replays[replayData.id] = {
      ...replayData,
      interviewId,
    };
    
    saveReplays(replays);
    return true;
  } catch (e) {
    console.error('Failed to save replay:', e);
    return false;
  }
};

/**
 * Gets a replay by its ID
 * @param {string} replayId - The replay ID
 * @returns {object|null} - Replay data or null
 */
export const getReplayById = (replayId) => {
  const replays = getStoredReplays();
  return replays[replayId] || null;
};

/**
 * Gets a replay by interview ID
 * @param {string} interviewId - The interview ID
 * @returns {object|null} - Replay data or null
 */
export const getReplayByInterviewId = (interviewId) => {
  const replays = getStoredReplays();
  return Object.values(replays).find(r => r.interviewId === interviewId) || null;
};

/**
 * Gets all replays for a problem
 * @param {string} problemId - The problem ID
 * @returns {Array} - Array of replay data
 */
export const getReplaysByProblem = (problemId) => {
  const replays = getStoredReplays();
  return Object.values(replays)
    .filter(r => r.problemId === problemId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Gets all replays (most recent first)
 * @param {number} limit - Optional limit
 * @returns {Array} - Array of replay data
 */
export const getAllReplays = (limit = null) => {
  const replays = getStoredReplays();
  const sorted = Object.values(replays)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return limit ? sorted.slice(0, limit) : sorted;
};

/**
 * Deletes a replay
 * @param {string} replayId - The replay ID to delete
 * @returns {boolean} - Success status
 */
export const deleteReplay = (replayId) => {
  const replays = getStoredReplays();
  if (!replays[replayId]) return false;
  
  delete replays[replayId];
  saveReplays(replays);
  return true;
};

/**
 * Compares two replay attempts for the same problem
 * @param {object} replay1 - First replay
 * @param {object} replay2 - Second replay
 * @returns {object} - Comparison data
 */
export const compareReplays = (replay1, replay2) => {
  const stats1 = getReplayStats(replay1);
  const stats2 = getReplayStats(replay2);
  
  return {
    replay1: {
      id: replay1.id,
      date: replay1.createdAt,
      stats: stats1,
      metadata: replay1.metadata,
    },
    replay2: {
      id: replay2.id,
      date: replay2.createdAt,
      stats: stats2,
      metadata: replay2.metadata,
    },
    comparison: {
      durationDiff: stats2.duration - stats1.duration,
      scoreDiff: (replay2.metadata?.score || 0) - (replay1.metadata?.score || 0),
      typingSpeedDiff: stats2.avgTypingSpeed - stats1.avgTypingSpeed,
      improved: (replay2.metadata?.score || 0) > (replay1.metadata?.score || 0),
    }
  };
};

export default {
  createRecordingSession,
  recordCodeChange,
  recordCursorMove,
  recordSelection,
  recordPauseEvent,
  finalizeRecording,
  getStateAtTimestamp,
  getNextEvent,
  generateHeatmapData,
  getReplayStats,
  formatDuration,
  saveReplay,
  getReplayById,
  getReplayByInterviewId,
  getReplaysByProblem,
  getAllReplays,
  deleteReplay,
  compareReplays,
};

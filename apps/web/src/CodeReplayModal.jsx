import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { getReplay } from "./replayStore.js";
import { formatClockSeconds } from "./replay.js";

function Modal({ isOpen, title, children, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="ici-modal" role="dialog" aria-modal="true">
      <div className="ici-modal__backdrop" onClick={() => onClose?.()} />
      <div className="ici-modal__panel ici-replay-modal__panel">
        <div className="ici-modal__header">
          <div className="ici-modal__title">{title}</div>
          <button
            type="button"
            className="ici-modal__close"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="ici-modal__body">{children}</div>
      </div>
    </div>
  );
}

function clamp(n, lo, hi) {
  const x = Number(n || 0);
  return Math.max(lo, Math.min(hi, x));
}

function uniqueStrings(xs) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(xs) ? xs : []) {
    const s = String(x || "");
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function formatMs(ms) {
  const s = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  return formatClockSeconds(s);
}

function buildEditsFromEvent(model, monaco, ev) {
  const changeCount = Number(ev?.[3] || 0);
  if (!model || !monaco || changeCount <= 0) return [];

  // ev = [tMs, line, col, changeCount, ro, rl, text, ro, rl, text, ...]
  const changesFlat = ev.slice(4);
  const changes = [];
  for (let i = 0; i < changeCount; i++) {
    const base = i * 3;
    const rangeOffset = Number(changesFlat?.[base] || 0);
    const rangeLength = Number(changesFlat?.[base + 1] || 0);
    const text = String(changesFlat?.[base + 2] || "");
    changes.push({ rangeOffset, rangeLength, text });
  }

  // Apply from end → start so offsets remain valid.
  changes.sort((a, b) => b.rangeOffset - a.rangeOffset);
  return changes.map((c) => {
    const start = model.getPositionAt(c.rangeOffset);
    const end = model.getPositionAt(c.rangeOffset + c.rangeLength);
    return {
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      text: c.text,
      forceMoveMarkers: true
    };
  });
}

export default function CodeReplayModal({ isOpen, onClose, initialReplayId, sessionReplayIds, replayIndex }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const [selectedReplayId, setSelectedReplayId] = useState(initialReplayId || null);
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [tab, setTab] = useState("playback"); // playback | heatmap | compare
  const [compareReplayId, setCompareReplayId] = useState("");

  // Playback controls
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursorEventIndex, setCursorEventIndex] = useState(0); // 0..events.length
  const rafRef = useRef(0);
  const playStartPerfRef = useRef(0);
  const playStartIndexRef = useRef(0);

  const sessionIds = useMemo(() => uniqueStrings(sessionReplayIds), [sessionReplayIds]);
  const resolvedTheme = useMemo(() => {
    try {
      return document?.documentElement?.dataset?.theme === "dark" ? "vs-dark" : "vs";
    } catch {
      return "vs";
    }
  }, [isOpen]);

  const selectedMeta = useMemo(() => {
    const rid = String(selectedReplayId || "");
    const arr = Array.isArray(replayIndex) ? replayIndex : [];
    return arr.find((m) => String(m?.id || "") === rid) || null;
  }, [replayIndex, selectedReplayId]);

  const problemId = useMemo(() => {
    return String(selectedMeta?.problemId || payload?.problemId || "");
  }, [payload?.problemId, selectedMeta?.problemId]);

  const problemTitle = useMemo(() => {
    return String(selectedMeta?.problemTitle || payload?.problemTitle || problemId || "Replay");
  }, [payload?.problemTitle, problemId, selectedMeta?.problemTitle]);

  const events = useMemo(() => {
    return Array.isArray(payload?.events) ? payload.events : [];
  }, [payload?.events]);

  const totalEvents = events.length;

  const title = useMemo(() => {
    return `Code replay · ${problemTitle}`;
  }, [problemTitle]);

  const resetToInitial = () => {
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!editor || !model) return;
    const initialCode = String(payload?.initialCode || "");
    model.setValue(initialCode);
  };

  const applyUpTo = (nextIndex) => {
    const idx = clamp(nextIndex, 0, totalEvents);
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel?.();
    if (!editor || !monaco || !model) return;

    const initialCode = String(payload?.initialCode || "");
    model.setValue(initialCode);

    for (let i = 0; i < idx; i++) {
      const ev = events[i];
      const edits = buildEditsFromEvent(model, monaco, ev);
      if (edits.length) {
        try {
          editor.executeEdits("replay", edits);
        } catch {
          // ignore
        }
      }
      const line = Number(ev?.[1] || 1);
      const col = Number(ev?.[2] || 1);
      try {
        editor.setPosition({ lineNumber: line, column: col });
      } catch {
        // ignore
      }
    }

    setCursorEventIndex(idx);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } catch {
      // ignore
    }
    rafRef.current = 0;
  };

  const startPlayback = () => {
    if (totalEvents <= 0) return;
    if (cursorEventIndex >= totalEvents) {
      applyUpTo(0);
    }
    setIsPlaying(true);
    playStartIndexRef.current = cursorEventIndex;
    try {
      playStartPerfRef.current = performance.now();
    } catch {
      playStartPerfRef.current = Date.now();
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    if (!payload) return;
    if (totalEvents <= 0) return;

    const startIndex = playStartIndexRef.current || 0;
    const startEventT = Number(events[startIndex]?.[0] || 0);
    const speedFactor = Number(speed || 1) || 1;

    const tick = () => {
      if (!isPlaying) return;
      const nowPerf = (() => {
        try {
          return performance.now();
        } catch {
          return Date.now();
        }
      })();
      const elapsed = Math.max(0, nowPerf - playStartPerfRef.current);
      const targetT = startEventT + elapsed * speedFactor;

      let i = cursorEventIndex;
      while (i < totalEvents) {
        const t = Number(events[i]?.[0] || 0);
        if (t > targetT) break;
        i += 1;
      }

      if (i !== cursorEventIndex) {
        applyUpTo(i);
      }

      if (i >= totalEvents) {
        stopPlayback();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      try {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } catch {
        // ignore
      }
      rafRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, payload?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedReplayId(initialReplayId || null);
    setTab("playback");
    setCompareReplayId("");
  }, [isOpen, initialReplayId]);

  useEffect(() => {
    if (!isOpen) return;
    const rid = String(selectedReplayId || "");
    if (!rid) {
      setPayload(null);
      setStatus("idle");
      setError("");
      return;
    }

    setStatus("loading");
    setError("");
    stopPlayback();

    getReplay(rid)
      .then((r) => {
        if (!r) {
          setPayload(null);
          setStatus("error");
          setError("Replay not found (it may have been pruned).");
          return;
        }
        setPayload(r);
        setStatus("ready");
        setSpeed(1);
        setIsPlaying(false);
        setCursorEventIndex(0);
        setTab("playback");
        setCompareReplayId("");
      })
      .catch((e) => {
        setPayload(null);
        setStatus("error");
        setError(e?.message || "Unable to load replay.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedReplayId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!payload) return;
    // When payload loads, sync editor to initial state.
    resetToInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.id, isOpen]);

  const durationText = useMemo(() => {
    const durationMs =
      typeof selectedMeta?.durationMs === "number"
        ? selectedMeta.durationMs
        : typeof payload?.startedAt === "number" && typeof payload?.endedAt === "number"
          ? payload.endedAt - payload.startedAt
          : 0;
    return formatMs(durationMs);
  }, [payload?.endedAt, payload?.startedAt, selectedMeta?.durationMs]);

  const sameProblemReplays = useMemo(() => {
    const arr = Array.isArray(replayIndex) ? replayIndex : [];
    if (!problemId) return arr.slice(0, 50);
    return arr.filter((m) => String(m?.problemId || "") === problemId);
  }, [problemId, replayIndex]);

  const compareMeta = useMemo(() => {
    const rid = String(compareReplayId || "");
    if (!rid) return null;
    return (Array.isArray(replayIndex) ? replayIndex : []).find((m) => String(m?.id || "") === rid) || null;
  }, [compareReplayId, replayIndex]);

  const heatmapRows = useMemo(() => {
    const rows = Array.isArray(selectedMeta?.heatmapSummary) ? selectedMeta.heatmapSummary : [];
    return rows
      .map((r) => ({
        line: Number(r?.line || 0),
        timeMs: Number(r?.timeMs || 0),
        edits: Number(r?.edits || 0)
      }))
      .filter((r) => r.line > 0)
      .slice(0, 20);
  }, [selectedMeta?.heatmapSummary]);

  const maxHeatMs = useMemo(() => {
    let m = 0;
    for (const r of heatmapRows) m = Math.max(m, Number(r.timeMs || 0));
    return m || 1;
  }, [heatmapRows]);

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={() => {
        stopPlayback();
        onClose?.();
      }}
    >
      <div className="ici-replay">
        <div className="ici-replay__top">
          <div className="ici-replay__meta">
            <div className="ici-replay__meta-row">
              <span className="ici-replay__k">Duration</span>
              <span className="ici-replay__v">{durationText}</span>
            </div>
            <div className="ici-replay__meta-row">
              <span className="ici-replay__k">Edits</span>
              <span className="ici-replay__v">{Number(selectedMeta?.eventCount || 0)}</span>
            </div>
          </div>

          <div className="ici-replay__picker">
            <label className="ici-replay__label">
              Replay
              <select
                className="ici-replay__select"
                value={String(selectedReplayId || "")}
                onChange={(e) => setSelectedReplayId(e.target.value)}
              >
                {sessionIds.length ? (
                  <optgroup label="This session">
                    {sessionIds.map((id) => (
                      <option key={id} value={id}>
                        {id.slice(0, 10)}…
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="All saved replays">
                  {(Array.isArray(replayIndex) ? replayIndex : []).slice(0, 50).map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.problemTitle || m.problemId || "Replay") + " · " + formatMs(m.durationMs)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
        </div>

        <div className="ici-replay__tabs" role="tablist" aria-label="Replay tabs">
          <button
            type="button"
            className={`ici-replay__tab ${tab === "playback" ? "is-active" : ""}`}
            onClick={() => setTab("playback")}
          >
            Playback
          </button>
          <button
            type="button"
            className={`ici-replay__tab ${tab === "heatmap" ? "is-active" : ""}`}
            onClick={() => setTab("heatmap")}
          >
            Heatmap
          </button>
          <button
            type="button"
            className={`ici-replay__tab ${tab === "compare" ? "is-active" : ""}`}
            onClick={() => setTab("compare")}
          >
            Compare
          </button>
        </div>

        {status === "loading" ? <div className="ici-replay__status">Loading…</div> : null}
        {status === "error" ? <div className="ici-replay__status ici-replay__status--error">{error}</div> : null}

        {tab === "playback" ? (
          <>
            <div className="ici-replay__controls">
              <button
                type="button"
                className="ici-replay__btn"
                onClick={() => applyUpTo(Math.max(0, cursorEventIndex - 1))}
                disabled={!payload || cursorEventIndex <= 0}
              >
                Step back
              </button>
              {isPlaying ? (
                <button type="button" className="ici-replay__btn ici-replay__btn--primary" onClick={stopPlayback}>
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="ici-replay__btn ici-replay__btn--primary"
                  onClick={startPlayback}
                  disabled={!payload || totalEvents <= 0}
                >
                  Play
                </button>
              )}
              <button
                type="button"
                className="ici-replay__btn"
                onClick={() => applyUpTo(Math.min(totalEvents, cursorEventIndex + 1))}
                disabled={!payload || cursorEventIndex >= totalEvents}
              >
                Step forward
              </button>

              <label className="ici-replay__label ici-replay__speed">
                Speed
                <select
                  className="ici-replay__select"
                  value={String(speed)}
                  onChange={(e) => setSpeed(Number(e.target.value || 1))}
                >
                  <option value="0.25">0.25×</option>
                  <option value="0.5">0.5×</option>
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
              </label>
            </div>

            <div className="ici-replay__scrub">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalEvents)}
                value={cursorEventIndex}
                onChange={(e) => {
                  stopPlayback();
                  applyUpTo(Number(e.target.value || 0));
                }}
                className="ici-replay__range"
                disabled={!payload || totalEvents <= 0}
              />
              <div className="ici-replay__scrub-meta">
                <span>
                  Event {cursorEventIndex}/{totalEvents}
                </span>
              </div>
            </div>

            <div className="ici-replay__editor">
              <Editor
                height="420px"
                defaultLanguage="javascript"
                theme={resolvedTheme}
                value={String(payload?.initialCode || "")}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  monacoRef.current = monaco;
                  try {
                    editor.updateOptions({ readOnly: true, minimap: { enabled: false }, wordWrap: "on" });
                  } catch {
                    // ignore
                  }
                  // Ensure initial state after mount.
                  setTimeout(() => resetToInitial(), 0);
                }}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on"
                }}
              />
            </div>
          </>
        ) : null}

        {tab === "heatmap" ? (
          <div className="ici-replay__heatmap">
            {!heatmapRows.length ? (
              <div className="ici-replay__status">No heatmap yet for this replay.</div>
            ) : (
              <div className="ici-replay__heatmap-list">
                {heatmapRows.map((r) => (
                  <div key={r.line} className="ici-replay__heatmap-row">
                    <div className="ici-replay__heatmap-line">L{r.line}</div>
                    <div className="ici-replay__heatmap-bar">
                      <div
                        className="ici-replay__heatmap-fill"
                        style={{ width: `${Math.round((r.timeMs / maxHeatMs) * 100)}%` }}
                      />
                    </div>
                    <div className="ici-replay__heatmap-meta">
                      {formatMs(r.timeMs)} · {r.edits} edits
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="ici-replay__note">
              Heatmap is based on cursor location over time (sampled while you moved/typed).
            </div>
          </div>
        ) : null}

        {tab === "compare" ? (
          <div className="ici-replay__compare">
            <div className="ici-replay__compare-top">
              <div className="ici-replay__compare-title">Compare attempts for {problemTitle}</div>
              <label className="ici-replay__label">
                Other attempt
                <select
                  className="ici-replay__select"
                  value={String(compareReplayId || "")}
                  onChange={(e) => setCompareReplayId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {sameProblemReplays
                    .filter((m) => String(m?.id || "") !== String(selectedReplayId || ""))
                    .slice(0, 50)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatMs(m.durationMs)} · {Number(m.eventCount || 0)} edits · {new Date(m.startedAt).toLocaleString()}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {!compareMeta ? (
              <div className="ici-replay__status">Pick another attempt to compare.</div>
            ) : (
              <div className="ici-replay__compare-grid">
                <div className="ici-replay__compare-card">
                  <div className="ici-replay__compare-card-title">This replay</div>
                  <div className="ici-replay__compare-kv">
                    <div>Duration</div>
                    <div>{formatMs(selectedMeta?.durationMs)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Edits</div>
                    <div>{Number(selectedMeta?.eventCount || 0)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Inserted</div>
                    <div>{Number(selectedMeta?.charsInserted || 0)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Deleted</div>
                    <div>{Number(selectedMeta?.charsDeleted || 0)}</div>
                  </div>
                </div>
                <div className="ici-replay__compare-card">
                  <div className="ici-replay__compare-card-title">Other attempt</div>
                  <div className="ici-replay__compare-kv">
                    <div>Duration</div>
                    <div>{formatMs(compareMeta?.durationMs)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Edits</div>
                    <div>{Number(compareMeta?.eventCount || 0)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Inserted</div>
                    <div>{Number(compareMeta?.charsInserted || 0)}</div>
                  </div>
                  <div className="ici-replay__compare-kv">
                    <div>Deleted</div>
                    <div>{Number(compareMeta?.charsDeleted || 0)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}


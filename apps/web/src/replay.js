/**
 * Replay event format:
 * - Edit event: [tMs, cursorLine, cursorCol, changeCount, ...changes]
 *   where each change is [rangeOffset, rangeLength, text]
 * - Cursor-only event: [tMs, cursorLine, cursorCol, 0]
 */

export function createReplayRecorder({
  replayId,
  mode,
  problemId,
  problemTitle,
  startedAt,
  initialCode,
  editor
}) {
  const id = String(replayId || "");
  const pid = String(problemId || "");
  const ptitle = String(problemTitle || pid);
  const m = String(mode || "practice");
  const startedAtTs = typeof startedAt === "number" ? startedAt : Date.now();
  const initial = String(initialCode || "");

  /** @type {any[]} */
  const events = [];
  let charsInserted = 0;
  let charsDeleted = 0;
  let editEventCount = 0;
  let disposed = false;

  const startPerf = (() => {
    try {
      return performance.now();
    } catch {
      return Date.now();
    }
  })();

  const nowMs = () => {
    try {
      return Math.max(0, Math.round(performance.now() - startPerf));
    } catch {
      return Math.max(0, Date.now() - startedAtTs);
    }
  };

  let lastCursorSampleAt = -Infinity;
  const CURSOR_SAMPLE_MS = 250;

  const d1 = editor?.onDidChangeModelContent?.((e) => {
    if (disposed) return;
    const t = nowMs();
    const pos = editor?.getPosition?.() || null;
    const line = Number(pos?.lineNumber || 1);
    const col = Number(pos?.column || 1);
    const changes = Array.isArray(e?.changes) ? e.changes : [];
    if (!changes.length) return;

    const flat = [];
    for (const c of changes) {
      const ro = Number(c?.rangeOffset || 0);
      const rl = Number(c?.rangeLength || 0);
      const text = String(c?.text || "");
      charsInserted += text.length;
      charsDeleted += rl;
      flat.push(ro, rl, text);
    }

    editEventCount += 1;
    events.push([t, line, col, changes.length, ...flat]);
  });

  const d2 = editor?.onDidChangeCursorPosition?.((e) => {
    if (disposed) return;
    const t = nowMs();
    if (t - lastCursorSampleAt < CURSOR_SAMPLE_MS) return;
    lastCursorSampleAt = t;

    const pos = e?.position || editor?.getPosition?.() || null;
    if (!pos) return;
    const line = Number(pos?.lineNumber || 1);
    const col = Number(pos?.column || 1);
    events.push([t, line, col, 0]);
  });

  return {
    id,
    stop() {
      if (disposed) return null;
      disposed = true;
      try {
        d1?.dispose?.();
      } catch {
        // ignore
      }
      try {
        d2?.dispose?.();
      } catch {
        // ignore
      }

      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - startedAtTs);
      const heatmap = computeLineHeatmap({ events, totalDurationMs: durationMs });
      const heatmapSummary = summarizeHeatmap(heatmap, 12);

      const payload = {
        id,
        v: 1,
        mode: m,
        problemId: pid,
        problemTitle: ptitle,
        startedAt: startedAtTs,
        endedAt,
        initialCode: initial,
        events
      };

      const meta = {
        id,
        mode: m,
        problemId: pid,
        problemTitle: ptitle,
        startedAt: startedAtTs,
        endedAt,
        durationMs,
        eventCount: editEventCount,
        charsInserted,
        charsDeleted,
        heatmapSummary
      };

      return { payload, meta };
    }
  };
}

export function computeLineHeatmap({ events, totalDurationMs }) {
  const timeByLine = new Map();
  const editsByLine = new Map();

  const ev = Array.isArray(events) ? events : [];
  if (!ev.length) {
    return { timeByLine: {}, editsByLine: {}, totalDurationMs: Number(totalDurationMs || 0) };
  }

  // Allocate time between events to the *previous* event's cursor line.
  for (let i = 0; i < ev.length; i++) {
    const cur = ev[i];
    const next = i + 1 < ev.length ? ev[i + 1] : null;
    const t = Number(cur?.[0] || 0);
    const line = Number(cur?.[1] || 1);
    const changeCount = Number(cur?.[3] || 0);

    if (changeCount > 0) {
      editsByLine.set(line, (editsByLine.get(line) || 0) + changeCount);
    }

    const nextT = next ? Number(next?.[0] || t) : Number(totalDurationMs || t);
    const dt = Math.max(0, nextT - t);
    timeByLine.set(line, (timeByLine.get(line) || 0) + dt);
  }

  const timeObj = {};
  const editsObj = {};
  for (const [k, v] of timeByLine.entries()) timeObj[String(k)] = v;
  for (const [k, v] of editsByLine.entries()) editsObj[String(k)] = v;
  return { timeByLine: timeObj, editsByLine: editsObj, totalDurationMs: Number(totalDurationMs || 0) };
}

export function summarizeHeatmap(heatmap, topN = 10) {
  const timeByLine = heatmap?.timeByLine && typeof heatmap.timeByLine === "object" ? heatmap.timeByLine : {};
  const editsByLine = heatmap?.editsByLine && typeof heatmap.editsByLine === "object" ? heatmap.editsByLine : {};

  const rows = [];
  for (const [lineStr, timeMs] of Object.entries(timeByLine)) {
    const line = Number(lineStr || 0);
    if (!line || !Number.isFinite(line)) continue;
    rows.push({
      line,
      timeMs: Number(timeMs || 0),
      edits: Number(editsByLine[lineStr] || 0)
    });
  }
  rows.sort((a, b) => b.timeMs - a.timeMs);
  return rows.slice(0, Math.max(1, Math.min(50, Number(topN || 10))));
}

export function formatClockSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}


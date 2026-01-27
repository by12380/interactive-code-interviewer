import { useEffect, useMemo, useRef, useState } from "react";
import { createAmbientEngine } from "./ambientSound.js";

function clamp(n, { min, max, fallback }) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function getBreathingProgram(pattern) {
  if (pattern === "478") {
    return [
      { id: "inhale", label: "Inhale", seconds: 4 },
      { id: "hold", label: "Hold", seconds: 7 },
      { id: "exhale", label: "Exhale", seconds: 8 }
    ];
  }
  // Default: box breathing (4-4-4-4)
  return [
    { id: "inhale", label: "Inhale", seconds: 4 },
    { id: "hold1", label: "Hold", seconds: 4 },
    { id: "exhale", label: "Exhale", seconds: 4 },
    { id: "hold2", label: "Hold", seconds: 4 }
  ];
}

export default function FocusModeOverlay({
  isEnabled,
  zenEnabled,
  backdropOpacity,
  backdropBlur,
  onExit,
  onChangePrefs
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Ambient sound state
  const engineRef = useRef(null);
  const [soundStatus, setSoundStatus] = useState({ playing: false, preset: "rain", volume: 0.25 });
  const soundSupported = useMemo(() => {
    try {
      return Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    } catch {
      return false;
    }
  }, []);

  // Breathing timer state
  const [breathing, setBreathing] = useState({
    running: false,
    pattern: "box",
    phaseIndex: 0,
    phaseEndsAt: 0
  });
  const breathingProgram = useMemo(() => getBreathingProgram(breathing.pattern), [breathing.pattern]);
  const [breathNow, setBreathNow] = useState(() => Date.now());

  // Keep ticking while breathing is running.
  useEffect(() => {
    if (!isEnabled) return;
    if (!breathing.running) return;
    const t = setInterval(() => setBreathNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [isEnabled, breathing.running]);

  // Auto-advance breathing phases.
  useEffect(() => {
    if (!isEnabled) return;
    if (!breathing.running) return;
    if (!breathing.phaseEndsAt) return;
    const now = breathNow;
    if (now < breathing.phaseEndsAt) return;

    setBreathing((b) => {
      const prog = getBreathingProgram(b.pattern);
      const nextIndex = (b.phaseIndex + 1) % prog.length;
      const nextPhase = prog[nextIndex];
      return {
        ...b,
        phaseIndex: nextIndex,
        phaseEndsAt: Date.now() + nextPhase.seconds * 1000
      };
    });
  }, [isEnabled, breathing.running, breathing.phaseEndsAt, breathNow]);

  // Stop sounds when leaving focus mode.
  useEffect(() => {
    if (isEnabled) return;
    try {
      engineRef.current?.stop?.();
    } catch {
      // ignore
    }
    setSoundStatus((s) => ({ ...s, playing: false }));
  }, [isEnabled]);

  // ESC exits focus mode.
  useEffect(() => {
    if (!isEnabled) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit?.();
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Z is common; don't steal it.
        return;
      }
      if (e.key === "Z" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEnabled, onExit]);

  function ensureEngine() {
    if (!engineRef.current) engineRef.current = createAmbientEngine();
    return engineRef.current;
  }

  async function toggleSound() {
    const engine = ensureEngine();
    if (!engine?.supported) return;
    if (soundStatus.playing) {
      engine.stop();
      setSoundStatus((s) => ({ ...s, playing: false }));
      return;
    }
    const ok = await engine.start({ preset: soundStatus.preset, volume: soundStatus.volume });
    setSoundStatus((s) => ({ ...s, playing: Boolean(ok) }));
  }

  function setSoundPreset(preset) {
    setSoundStatus((s) => ({ ...s, preset }));
    try {
      const engine = ensureEngine();
      if (soundStatus.playing) engine.start({ preset, volume: soundStatus.volume });
    } catch {
      // ignore
    }
  }

  function setSoundVolume(v) {
    const vol = clamp(v, { min: 0, max: 1, fallback: 0.25 });
    setSoundStatus((s) => ({ ...s, volume: vol }));
    try {
      const engine = ensureEngine();
      if (soundStatus.playing) engine.setVolume(vol);
    } catch {
      // ignore
    }
  }

  function startBreathing() {
    const phase = breathingProgram[0];
    setBreathing((b) => ({
      ...b,
      running: true,
      phaseIndex: 0,
      phaseEndsAt: Date.now() + phase.seconds * 1000
    }));
  }

  function stopBreathing() {
    setBreathing((b) => ({ ...b, running: false, phaseIndex: 0, phaseEndsAt: 0 }));
  }

  const activePhase = breathingProgram[breathing.phaseIndex] || breathingProgram[0];
  const breathRemainingSec = breathing.running
    ? Math.ceil(Math.max(0, (breathing.phaseEndsAt - breathNow) / 1000))
    : 0;

  if (!isEnabled) return null;

  return (
    <>
      <div className="focus-backdrop" aria-hidden="true" />

      <div className={`focus-overlay ${isExpanded ? "is-expanded" : ""}`}>
        <div className="focus-overlay__bar" role="toolbar" aria-label="Focus mode controls">
          <div className="focus-overlay__left">
            <span className="focus-overlay__pill" title="Focus Mode is on">
              Focus Mode
            </span>
            {zenEnabled ? <span className="focus-overlay__pill">Zen</span> : null}
          </div>
          <div className="focus-overlay__right">
            <button
              type="button"
              className="focus-overlay__btn"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? "Hide Focus Mode settings" : "Show Focus Mode settings"}
              title="Settings"
            >
              {isExpanded ? "Hide" : "Settings"}
            </button>
            <button
              type="button"
              className="focus-overlay__btn focus-overlay__btn--primary"
              onClick={() => onExit?.()}
              aria-label="Exit Focus Mode"
              title="Exit (Esc)"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="focus-overlay__panel" aria-label="Focus Mode utilities">
          <div className="focus-overlay__section">
            <div className="focus-overlay__section-title">Zen</div>
            <label className="focus-overlay__toggle">
              <input
                type="checkbox"
                checked={Boolean(zenEnabled)}
                onChange={(e) => onChangePrefs?.({ focusZen: e.target.checked })}
              />
              Minimal visuals
            </label>
            <div className="focus-overlay__row">
              <label className="focus-overlay__field">
                <span>Background dim</span>
                <input
                  type="range"
                  min="0"
                  max="0.7"
                  step="0.02"
                  value={backdropOpacity}
                  onChange={(e) => onChangePrefs?.({ focusBackdropOpacity: Number(e.target.value) })}
                />
              </label>
              <label className="focus-overlay__field">
                <span>Blur</span>
                <input
                  type="range"
                  min="0"
                  max="28"
                  step="1"
                  value={backdropBlur}
                  onChange={(e) => onChangePrefs?.({ focusBackdropBlur: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="focus-overlay__section">
            <div className="focus-overlay__section-title">Breathing</div>
            <div className="focus-overlay__row">
              <label className="focus-overlay__field">
                <span>Pattern</span>
                <select
                  value={breathing.pattern}
                  onChange={(e) => {
                    const next = e.target.value;
                    stopBreathing();
                    setBreathing((b) => ({ ...b, pattern: next }));
                    onChangePrefs?.({ focusBreathingPattern: next });
                  }}
                >
                  <option value="box">Box (4-4-4-4)</option>
                  <option value="478">4-7-8</option>
                </select>
              </label>
              <div className="focus-overlay__breath">
                <div className="focus-overlay__breath-top">
                  <div className="focus-overlay__breath-phase">
                    {breathing.running ? activePhase.label : "Ready"}
                  </div>
                  <div className="focus-overlay__breath-time">
                    {breathing.running ? formatMMSS(breathRemainingSec) : "00:00"}
                  </div>
                </div>
                <div className="focus-overlay__breath-actions">
                  {breathing.running ? (
                    <button type="button" className="focus-overlay__btn" onClick={stopBreathing}>
                      Stop
                    </button>
                  ) : (
                    <button type="button" className="focus-overlay__btn" onClick={startBreathing}>
                      Start
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="focus-overlay__hint">Quick reset: Stop → Start.</div>
          </div>

          <div className="focus-overlay__section">
            <div className="focus-overlay__section-title">Ambient sound</div>
            {!soundSupported ? (
              <div className="focus-overlay__hint">WebAudio not supported in this browser.</div>
            ) : (
              <>
                <div className="focus-overlay__row">
                  <label className="focus-overlay__field">
                    <span>Preset</span>
                    <select value={soundStatus.preset} onChange={(e) => setSoundPreset(e.target.value)}>
                      <option value="rain">Rain</option>
                      <option value="coffee_shop">Coffee shop</option>
                    </select>
                  </label>
                  <label className="focus-overlay__field">
                    <span>Volume</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={soundStatus.volume}
                      onChange={(e) => setSoundVolume(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="focus-overlay__row">
                  <button
                    type="button"
                    className={`focus-overlay__btn ${soundStatus.playing ? "is-on" : ""}`}
                    onClick={toggleSound}
                  >
                    {soundStatus.playing ? "Stop sound" : "Play sound"}
                  </button>
                </div>
                <div className="focus-overlay__hint">
                  Note: sound must be started by a click (browser autoplay policy).
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


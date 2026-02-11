import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampNumber,
  isSpeechRecognitionSupported,
  matchVoiceCommand,
  normalizeSpeechText,
  speechToCode,
  getSpeechRecognitionCtor
} from "./voice.js";

const VOICE_SETTINGS_KEY = "ici.voice.settings.v1";
const TRANSCRIPT_KEY = "ici.voice.transcript.v1";

function safeJsonParse(raw, fallback) {
  try {
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadJson(key, fallback) {
  try {
    return safeJsonParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function downloadBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function nowTs() {
  return Date.now();
}

function makeEntry({ role, text, kind = "speech" }) {
  return {
    id: `${kind}-${nowTs()}-${Math.random().toString(16).slice(2)}`,
    ts: nowTs(),
    role: String(role || "user"),
    kind: String(kind || "speech"),
    text: String(text || "")
  };
}

function getDefaultSettings() {
  return {
    enabled: false,
    target: "auto", // auto | code | coach | commands
    lang: "en-US",

    vadEnabled: true,
    vadAutoPause: true,
    vadThreshold: 0.02,
    vadSilenceMs: 650,

    ttsEnabled: true,
    ttsRate: 1.02,
    ttsPitch: 1.0,
    ttsVolume: 0.9,
    ttsVoiceURI: ""
  };
}

export default function VoicePanel({
  isLocked,
  isInterviewMode,
  isPaused,
  messages,
  onInsertCode,
  onSendChatText,
  onRunCode,
  onRunTests,
  onNext,
  onStop,
  onRevealHint,
  onExplainApproach,
  onPause,
  onResume,
  onSetVoiceHold,
  onToast
}) {
  const [settings, setSettings] = useState(() => {
    const loaded = loadJson(VOICE_SETTINGS_KEY, null);
    return { ...getDefaultSettings(), ...(loaded && typeof loaded === "object" ? loaded : {}) };
  });

  const [transcript, setTranscript] = useState(() => {
    const loaded = loadJson(TRANSCRIPT_KEY, []);
    return Array.isArray(loaded) ? loaded : [];
  });
  const [interimUserText, setInterimUserText] = useState("");
  const [recognitionStatus, setRecognitionStatus] = useState("idle"); // idle | listening | error
  const [recognitionError, setRecognitionError] = useState(null);

  const [ttsVoices, setTtsVoices] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const micStreamRef = useRef(null);
  const micAcquireInFlightRef = useRef(false);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [audioRec, setAudioRec] = useState({ status: "idle", error: null, blobUrl: null });

  const recognitionRef = useRef(null);
  const vadRafRef = useRef(0);
  const vadCleanupRef = useRef(null);
  const vadLastVoiceTsRef = useRef(0);
  const vadSpeakingRef = useRef(false);
  const didAutoHoldRef = useRef(false);
  const enabledRef = useRef(Boolean(settings.enabled));

  const lastSpokenAssistantIdxRef = useRef(-1);
  const transcriptContainerRef = useRef(null);

  const sttSupported = isSpeechRecognitionSupported();
  const ttsSupported = Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance);

  const langOptions = useMemo(
    () => [
      { id: "en-US", label: "English (US)" },
      { id: "en-GB", label: "English (UK)" },
      { id: "es-ES", label: "Español (España)" },
      { id: "es-MX", label: "Español (México)" },
      { id: "fr-FR", label: "Français" },
      { id: "de-DE", label: "Deutsch" },
      { id: "hi-IN", label: "हिन्दी" },
      { id: "ja-JP", label: "日本語" },
      { id: "ko-KR", label: "한국어" },
      { id: "zh-CN", label: "中文 (简体)" }
    ],
    []
  );

  // Persist settings/transcript.
  useEffect(() => {
    saveJson(VOICE_SETTINGS_KEY, settings);
  }, [settings]);
  useEffect(() => {
    saveJson(TRANSCRIPT_KEY, transcript.slice(-500));
  }, [transcript]);

  useEffect(() => {
    enabledRef.current = Boolean(settings.enabled);
  }, [settings.enabled]);

  // Keep transcript view pinned to bottom.
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [transcript.length, interimUserText]);

  // Load TTS voices list (async in many browsers).
  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => {
      try {
        const list = globalThis.speechSynthesis.getVoices() || [];
        setTtsVoices(list);
      } catch {
        setTtsVoices([]);
      }
    };
    load();
    try {
      globalThis.speechSynthesis.onvoiceschanged = load;
    } catch {
      // ignore
    }
    return () => {
      try {
        globalThis.speechSynthesis.onvoiceschanged = null;
      } catch {
        // ignore
      }
    };
  }, [ttsSupported]);

  // Speak assistant messages (including interruptions) when enabled.
  useEffect(() => {
    if (!settings.enabled) return;
    if (!settings.ttsEnabled) return;
    if (!ttsSupported) return;
    if (!Array.isArray(messages) || messages.length === 0) return;

    // Find new assistant messages since last.
    for (let i = lastSpokenAssistantIdxRef.current + 1; i < messages.length; i++) {
      const m = messages[i];
      if (m?.role !== "assistant") continue;
      const text = String(m?.content || "").trim();
      if (!text) continue;

      lastSpokenAssistantIdxRef.current = i;
      addTranscriptEntry({ role: "assistant", text, kind: "ai" });
      speak(text);
    }
  }, [messages, settings.enabled, settings.ttsEnabled, ttsSupported]);

  function addTranscriptEntry({ role, text, kind }) {
    const entry = makeEntry({ role, text, kind });
    setTranscript((prev) => [...(Array.isArray(prev) ? prev : []), entry].slice(-500));
  }

  function toast(kind, title, message) {
    if (typeof onToast === "function") {
      onToast(kind, title, message);
    }
  }

  function speak(text) {
    try {
      const utter = new SpeechSynthesisUtterance(String(text || ""));
      utter.rate = clampNumber(settings.ttsRate, { min: 0.6, max: 1.6, fallback: 1.0 });
      utter.pitch = clampNumber(settings.ttsPitch, { min: 0.5, max: 1.5, fallback: 1.0 });
      utter.volume = clampNumber(settings.ttsVolume, { min: 0, max: 1, fallback: 1.0 });

      const chosen = settings.ttsVoiceURI
        ? ttsVoices.find((v) => String(v.voiceURI) === String(settings.ttsVoiceURI))
        : null;
      if (chosen) utter.voice = chosen;
      else if (settings.lang) utter.lang = settings.lang;

      globalThis.speechSynthesis.cancel();
      globalThis.speechSynthesis.speak(utter);
    } catch {
      // ignore
    }
  }

  async function ensureMicStream() {
    if (micStreamRef.current) return micStreamRef.current;
    if (micAcquireInFlightRef.current) return null;
    micAcquireInFlightRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      micStreamRef.current = stream;
      return stream;
    } catch (e) {
      toast("info", "Microphone permission", e?.message || "Unable to access microphone.");
      return null;
    } finally {
      micAcquireInFlightRef.current = false;
    }
  }

  function teardownMicStream() {
    try {
      if (micStreamRef.current) {
        for (const t of micStreamRef.current.getTracks()) t.stop();
      }
    } catch {
      // ignore
    } finally {
      micStreamRef.current = null;
    }
  }

  function stopVAD() {
    try {
      if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
    } catch {
      // ignore
    } finally {
      vadRafRef.current = 0;
      try {
        if (typeof vadCleanupRef.current === "function") vadCleanupRef.current();
      } catch {
        // ignore
      } finally {
        vadCleanupRef.current = null;
      }
      vadSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }

  async function startVAD() {
    const stream = await ensureMicStream();
    if (!stream) return;

    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // ignore
    }
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    const threshold = clampNumber(settings.vadThreshold, { min: 0.005, max: 0.2, fallback: 0.02 });
    const silenceMs = clampNumber(settings.vadSilenceMs, { min: 200, max: 3000, fallback: 650 });

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      const now = nowTs();
      const voice = rms >= threshold;
      if (voice) vadLastVoiceTsRef.current = now;
      const consideredSpeaking = voice || now - vadLastVoiceTsRef.current < silenceMs;

      if (consideredSpeaking !== vadSpeakingRef.current) {
        vadSpeakingRef.current = consideredSpeaking;
        setIsSpeaking(consideredSpeaking);

        if (consideredSpeaking) {
          try {
            globalThis.speechSynthesis?.cancel?.();
          } catch {
            // ignore
          }
        }

        if (settings.enabled && settings.vadAutoPause && isInterviewMode) {
          if (consideredSpeaking) {
            didAutoHoldRef.current = true;
            if (typeof onSetVoiceHold === "function") onSetVoiceHold(true);
            if (!isPaused && typeof onPause === "function") onPause("voice");
          } else {
            if (didAutoHoldRef.current) {
              didAutoHoldRef.current = false;
              if (typeof onSetVoiceHold === "function") onSetVoiceHold(false);
              if (isPaused && typeof onResume === "function") onResume("voice");
            }
          }
        }
      }

      vadRafRef.current = requestAnimationFrame(tick);
    };

    // On teardown, close audio context.
    vadCleanupRef.current = () => {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // ignore
      }
      try {
        ctx.close();
      } catch {
        // ignore
      }
    };

    vadLastVoiceTsRef.current = nowTs();
    vadRafRef.current = requestAnimationFrame(tick);
  }

  function stopRecognition() {
    try {
      const rec = recognitionRef.current;
      if (rec) rec.stop();
    } catch {
      // ignore
    } finally {
      recognitionRef.current = null;
    }
  }

  function startRecognition() {
    if (!sttSupported) {
      toast("info", "Speech-to-text unavailable", "Your browser does not support SpeechRecognition.");
      return;
    }

    try {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = settings.lang || "en-US";
      rec.interimResults = true;
      rec.continuous = true;

      rec.onstart = () => {
        setRecognitionStatus("listening");
        setRecognitionError(null);
      };
      rec.onerror = (e) => {
        const msg = String(e?.error || e?.message || "Speech recognition error");
        setRecognitionStatus("error");
        setRecognitionError(msg);
      };
      rec.onend = () => {
        setRecognitionStatus("idle");
        setInterimUserText("");
        // Auto-restart while enabled (common pattern for Chrome).
        if (enabledRef.current) {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };
      rec.onresult = (event) => {
        try {
          let interim = "";
          let finalText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const txt = String(res?.[0]?.transcript || "");
            if (res.isFinal) finalText += txt;
            else interim += txt;
          }
          setInterimUserText(interim.trim());
          if (finalText.trim()) {
            handleFinalSpeech(finalText.trim());
          }
        } catch {
          // ignore
        }
      };

      rec.start();
    } catch (e) {
      setRecognitionStatus("error");
      setRecognitionError(e?.message || "Unable to start speech recognition");
    }
  }

  function handleFinalSpeech(text) {
    const normalized = normalizeSpeechText(text);
    if (!normalized) return;

    // Transcript always captures user speech.
    addTranscriptEntry({ role: "user", text, kind: "speech" });

    const cmd = matchVoiceCommand(text);
    if (cmd) {
      addTranscriptEntry({ role: "system", text: `Command: ${cmd.type}`, kind: "command" });
      if (cmd.type === "RUN_CODE") onRunCode?.();
      else if (cmd.type === "RUN_TESTS") onRunTests?.();
      else if (cmd.type === "NEXT") onNext?.();
      else if (cmd.type === "STOP") onStop?.();
      else if (cmd.type === "HINT") onRevealHint?.();
      else if (cmd.type === "EXPLAIN_APPROACH") onExplainApproach?.();
      else if (cmd.type === "PAUSE") onPause?.("voice");
      else if (cmd.type === "RESUME") onResume?.("voice");
      else if (cmd.type === "CLEAR_TRANSCRIPT") setTranscript([]);
      return;
    }

    const target = settings.target || "auto";
    if (target === "commands") return;

    if (target === "coach" || (target === "auto" && normalized.length >= 10 && normalized.includes("explain"))) {
      onSendChatText?.(text);
      return;
    }

    // Default: code dictation
    const code = speechToCode(text);
    if (code) onInsertCode?.(code);
  }

  async function startAudioRecording() {
    setAudioRec({ status: "requesting", error: null, blobUrl: null });
    try {
      const stream = await ensureMicStream();
      if (!stream) {
        setAudioRec({ status: "error", error: "No microphone stream available", blobUrl: null });
        return;
      }

      audioChunksRef.current = [];
      const mimeTypeCandidates = ["audio/webm;codecs=opus", "audio/webm"];
      const mimeType = mimeTypeCandidates.find((t) => {
        try {
          return globalThis.MediaRecorder?.isTypeSupported?.(t);
        } catch {
          return false;
        }
      });
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e?.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onerror = (e) => {
        setAudioRec({ status: "error", error: String(e?.error?.message || "Audio recording error"), blobUrl: null });
      };
      rec.onstop = () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          setAudioRec({ status: "stopped", error: null, blobUrl: url });
        } catch (e) {
          setAudioRec({ status: "error", error: e?.message || "Unable to save audio", blobUrl: null });
        }
      };

      rec.start(1000);
      setAudioRec({ status: "recording", error: null, blobUrl: null });
    } catch (e) {
      setAudioRec({ status: "error", error: e?.message || "Unable to start audio recording", blobUrl: null });
    }
  }

  function stopAudioRecording() {
    try {
      const rec = audioRecorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {
      // ignore
    }
  }

  // Toggle voice engine (STT + VAD).
  useEffect(() => {
    if (!settings.enabled) {
      stopRecognition();
      stopVAD();
      if (typeof onSetVoiceHold === "function") onSetVoiceHold(false);
      didAutoHoldRef.current = false;
      if (audioRec.status !== "recording") {
        teardownMicStream();
      }
      return;
    }

    // Best effort: acquire mic for VAD/recording early (STT will still request its own).
    ensureMicStream();
    startRecognition();
    if (settings.vadEnabled) startVAD();

    return () => {
      stopRecognition();
      stopVAD();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, settings.lang, settings.vadEnabled]);

  // If VAD controls change while enabled, restart VAD.
  useEffect(() => {
    if (!settings.enabled) return;
    if (!settings.vadEnabled) return;
    stopVAD();
    startVAD();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.vadThreshold, settings.vadSilenceMs, settings.vadAutoPause, isInterviewMode, isPaused]);

  useEffect(() => {
    return () => {
      stopRecognition();
      stopVAD();
      stopAudioRecording();
      teardownMicStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceStatusLabel =
    recognitionStatus === "listening"
      ? "Listening"
      : recognitionStatus === "error"
        ? `Error: ${recognitionError || "speech recognition"}`
        : "Idle";

  const canRecordAudio = Boolean(globalThis.MediaRecorder && navigator.mediaDevices?.getUserMedia);

  return (
    <section className="panel panel--voice" data-tutorial="voice">
      <div className="panel__header panel__header--voice">
        <div className="voice__title">
          <span>Voice Interview Mode</span>
          <span className={`voice__badge ${settings.enabled ? "is-on" : "is-off"}`}>
            {settings.enabled ? "On" : "Off"}
          </span>
        </div>
        <div className="voice__actions">
          <button
            type="button"
            className="voice__btn voice__btn--primary"
            onClick={() => {
              setSettings((s) => ({ ...s, enabled: !s.enabled }));
              if (!settings.enabled) toast("success", "Voice mode", "Enabled. Say “run code”, “give me a hint”, etc.");
            }}
            disabled={isLocked}
          >
            {settings.enabled ? "Disable" : "Enable"}
          </button>
          {settings.enabled ? (
            <button
              type="button"
              className="voice__btn"
              onClick={() => {
                try {
                  globalThis.speechSynthesis?.cancel?.();
                } catch {
                  // ignore
                }
              }}
              title="Stop text-to-speech"
            >
              Stop voice
            </button>
          ) : null}
        </div>
      </div>

      <div className="voice">
        <div className="voice__grid">
          <div className="voice__field">
            <div className="voice__label">Speech input</div>
            <select
              value={settings.target}
              onChange={(e) => setSettings((s) => ({ ...s, target: e.target.value }))}
              disabled={!settings.enabled}
            >
              <option value="auto">Auto (commands + coach + code)</option>
              <option value="code">Code dictation</option>
              <option value="coach">Coach conversation</option>
              <option value="commands">Commands only</option>
            </select>
          </div>

          <div className="voice__field">
            <div className="voice__label">Language</div>
            <select
              value={settings.lang}
              onChange={(e) => setSettings((s) => ({ ...s, lang: e.target.value }))}
              disabled={!settings.enabled}
            >
              {langOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="voice__field">
            <div className="voice__label">Status</div>
            <div className="voice__status">
              <div>{voiceStatusLabel}</div>
              <div className="voice__status-sub">
                {settings.vadEnabled ? (
                  <span className={`voice__chip ${isSpeaking ? "is-hot" : ""}`}>
                    VAD: {isSpeaking ? "speaking" : "silent"}
                  </span>
                ) : (
                  <span className="voice__chip">VAD: off</span>
                )}
                <span className="voice__chip">TTS: {settings.ttsEnabled ? "on" : "off"}</span>
                <span className="voice__chip">{isInterviewMode ? "Interview" : "Practice"}</span>
                {isInterviewMode ? <span className="voice__chip">{isPaused ? "Paused" : "Running"}</span> : null}
              </div>
              {!sttSupported && (
                <div className="voice__warn">Speech-to-text not supported in this browser (try Chrome).</div>
              )}
            </div>
          </div>

          <div className="voice__field voice__field--wide">
            <div className="voice__label">Live transcript</div>
            <div className="voice__transcript" role="log" aria-label="Voice transcript" ref={transcriptContainerRef}>
              {transcript.map((t) => (
                <div key={t.id} className={`voice__line voice__line--${t.role}`}>
                  <span className="voice__who">{t.role}</span>
                  <span className="voice__text">{t.text}</span>
                </div>
              ))}
              {settings.enabled && interimUserText ? (
                <div className="voice__line voice__line--interim">
                  <span className="voice__who">user</span>
                  <span className="voice__text">{interimUserText}</span>
                </div>
              ) : null}
            </div>
            <div className="voice__transcript-actions">
              <button
                type="button"
                className="voice__btn"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(transcript, null, 2)], { type: "application/json" });
                  downloadBlob({
                    blob,
                    filename: `transcript_${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`
                  });
                }}
                disabled={transcript.length === 0}
              >
                Export transcript
              </button>
              <button
                type="button"
                className="voice__btn voice__btn--ghost"
                onClick={() => setTranscript([])}
                disabled={transcript.length === 0}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="voice__field">
            <div className="voice__label">Voice activity</div>
            <label className="voice__toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.vadEnabled)}
                onChange={(e) => setSettings((s) => ({ ...s, vadEnabled: e.target.checked }))}
                disabled={!settings.enabled}
              />
              Enable VAD
            </label>
            <label className="voice__toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.vadAutoPause)}
                onChange={(e) => setSettings((s) => ({ ...s, vadAutoPause: e.target.checked }))}
                disabled={!settings.enabled || !settings.vadEnabled}
              />
              Auto-pause interview while speaking
            </label>
            <div className="voice__slider">
              <div className="voice__slider-label">Sensitivity</div>
              <input
                type="range"
                min="0.005"
                max="0.08"
                step="0.005"
                value={settings.vadThreshold}
                onChange={(e) => setSettings((s) => ({ ...s, vadThreshold: Number(e.target.value) }))}
                disabled={!settings.enabled || !settings.vadEnabled}
              />
            </div>
          </div>

          <div className="voice__field">
            <div className="voice__label">Text-to-speech</div>
            <label className="voice__toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.ttsEnabled)}
                onChange={(e) => setSettings((s) => ({ ...s, ttsEnabled: e.target.checked }))}
                disabled={!settings.enabled || !ttsSupported}
              />
              Speak AI responses
            </label>
            <div className="voice__field-sub">
              <div className="voice__label-sub">Voice</div>
              <select
                value={settings.ttsVoiceURI || ""}
                onChange={(e) => setSettings((s) => ({ ...s, ttsVoiceURI: e.target.value }))}
                disabled={!settings.enabled || !ttsSupported}
              >
                <option value="">Auto (by language)</option>
                {ttsVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </option>
                ))}
              </select>
            </div>
            <div className="voice__slider">
              <div className="voice__slider-label">Speed</div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.02"
                value={settings.ttsRate}
                onChange={(e) => setSettings((s) => ({ ...s, ttsRate: Number(e.target.value) }))}
                disabled={!settings.enabled || !ttsSupported}
              />
            </div>
            <div className="voice__slider">
              <div className="voice__slider-label">Volume</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.ttsVolume}
                onChange={(e) => setSettings((s) => ({ ...s, ttsVolume: Number(e.target.value) }))}
                disabled={!settings.enabled || !ttsSupported}
              />
            </div>
          </div>

          <div className="voice__field voice__field--wide">
            <div className="voice__label">Recording</div>
            {!canRecordAudio ? (
              <div className="voice__warn">Audio recording is not supported in this browser.</div>
            ) : (
              <div className="voice__rec">
                <div className="voice__rec-actions">
                  {audioRec.status !== "recording" ? (
                    <button
                      type="button"
                      className="voice__btn voice__btn--primary"
                      onClick={startAudioRecording}
                      disabled={!settings.enabled}
                    >
                      Record audio
                    </button>
                  ) : (
                    <button type="button" className="voice__btn" onClick={stopAudioRecording}>
                      Stop recording
                    </button>
                  )}
                  {audioRec.blobUrl ? (
                    <a
                      className="voice__download"
                      href={audioRec.blobUrl}
                      download={`interview_audio_${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.webm`}
                    >
                      Download latest audio
                    </a>
                  ) : null}
                </div>
                {audioRec.error ? <div className="voice__warn">Recording error: {audioRec.error}</div> : null}
                {audioRec.blobUrl ? (
                  <audio className="voice__player" controls src={audioRec.blobUrl} />
                ) : (
                  <div className="voice__hint">Tip: keep this tab open; download the audio after the session.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="voice__hint">
          Commands: “run code”, “run tests”, “next problem”, “give me a hint”, “pause interview”, “resume interview”.
        </div>
      </div>
    </section>
  );
}


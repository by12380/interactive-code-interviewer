import { memo, useCallback, useEffect, useRef } from "react";
import { useTheme, THEMES, COLOR_SCHEMES } from "../contexts/ThemeContext.jsx";
import { useVoice } from "../contexts/VoiceContext.jsx";

function SettingsPanel() {
  const {
    theme,
    setTheme,
    colorScheme,
    setColorScheme,
    accessibility,
    updateAccessibility,
    resetSettings,
    isSettingsOpen,
    closeSettings,
  } = useTheme();

  const {
    isSupported: voiceSupported,
    browserSupport,
    voiceSettings,
    updateVoiceSettings,
    resetVoiceSettings,
    availableVoices,
    testVoice,
    isSpeaking
  } = useVoice();

  const panelRef = useRef(null);
  const firstFocusableRef = useRef(null);

  // Handle escape key and click outside
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeSettings();
      }
      // Trap focus within panel
      if (e.key === "Tab") {
        const focusableElements = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements?.length) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closeSettings();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    // Focus first element
    firstFocusableRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSettingsOpen, closeSettings]);

  const handleFontSizeChange = useCallback(
    (e) => updateAccessibility("fontSize", e.target.value),
    [updateAccessibility]
  );

  if (!isSettingsOpen) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-backdrop" onClick={closeSettings} />
      <div className="settings-panel" ref={panelRef}>
        <div className="settings-panel__header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-panel__close"
            onClick={closeSettings}
            ref={firstFocusableRef}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="settings-panel__content">
          {/* Theme Section */}
          <section className="settings-section" aria-labelledby="theme-heading">
            <h3 id="theme-heading" className="settings-section__title">
              <span className="settings-section__icon">🎨</span>
              Appearance
            </h3>

            <div className="settings-group">
              <label className="settings-label">Theme</label>
              <div className="theme-switcher" role="radiogroup" aria-label="Theme selection">
                {Object.values(THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-option ${theme === t.id ? "theme-option--active" : ""}`}
                    onClick={() => setTheme(t.id)}
                    role="radio"
                    aria-checked={theme === t.id}
                  >
                    <span className="theme-option__icon">{t.icon}</span>
                    <span className="theme-option__name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <label className="settings-label">Color Scheme</label>
              <div className="color-scheme-grid" role="radiogroup" aria-label="Color scheme selection">
                {Object.values(COLOR_SCHEMES).map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    className={`color-scheme-option ${colorScheme === scheme.id ? "color-scheme-option--active" : ""}`}
                    onClick={() => setColorScheme(scheme.id)}
                    role="radio"
                    aria-checked={colorScheme === scheme.id}
                    aria-label={scheme.name}
                  >
                    <span
                      className="color-scheme-option__swatch"
                      style={{ background: scheme.primary }}
                    />
                    <span className="color-scheme-option__name">{scheme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Accessibility Section */}
          <section className="settings-section" aria-labelledby="a11y-heading">
            <h3 id="a11y-heading" className="settings-section__title">
              <span className="settings-section__icon">♿</span>
              Accessibility
            </h3>

            <div className="settings-group">
              <label className="settings-label" htmlFor="font-size-select">
                Font Size
              </label>
              <select
                id="font-size-select"
                className="settings-select"
                value={accessibility.fontSize}
                onChange={handleFontSizeChange}
              >
                <option value="small">Small (14px)</option>
                <option value="medium">Medium (16px)</option>
                <option value="large">Large (18px)</option>
                <option value="xlarge">Extra Large (20px)</option>
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={accessibility.highContrast}
                  onChange={(e) => updateAccessibility("highContrast", e.target.checked)}
                />
                <span className="settings-toggle__slider" />
                <span className="settings-toggle__label">
                  <strong>High Contrast Mode</strong>
                  <span className="settings-toggle__description">
                    Increases color contrast for better visibility
                  </span>
                </span>
              </label>
            </div>

            <div className="settings-group">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={accessibility.reducedMotion}
                  onChange={(e) => updateAccessibility("reducedMotion", e.target.checked)}
                />
                <span className="settings-toggle__slider" />
                <span className="settings-toggle__label">
                  <strong>Reduce Motion</strong>
                  <span className="settings-toggle__description">
                    Minimizes animations and transitions
                  </span>
                </span>
              </label>
            </div>

            <div className="settings-group">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={accessibility.keyboardNavigation}
                  onChange={(e) => updateAccessibility("keyboardNavigation", e.target.checked)}
                />
                <span className="settings-toggle__slider" />
                <span className="settings-toggle__label">
                  <strong>Keyboard Navigation Mode</strong>
                  <span className="settings-toggle__description">
                    Shows focus indicators and enables keyboard shortcuts
                  </span>
                </span>
              </label>
            </div>

            <div className="settings-group">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={accessibility.screenReaderMode}
                  onChange={(e) => updateAccessibility("screenReaderMode", e.target.checked)}
                />
                <span className="settings-toggle__slider" />
                <span className="settings-toggle__label">
                  <strong>Screen Reader Optimized</strong>
                  <span className="settings-toggle__description">
                    Enhances ARIA labels and live region announcements
                  </span>
                </span>
              </label>
            </div>
          </section>

          {/* Voice Settings Section */}
          <section className="settings-section" aria-labelledby="voice-heading">
            <h3 id="voice-heading" className="settings-section__title">
              <span className="settings-section__icon">🎤</span>
              Voice Settings
            </h3>

            {!voiceSupported ? (
              <div className="settings-group settings-group--warning">
                <p className="settings-warning">
                  <span className="settings-warning__icon">⚠️</span>
                  {browserSupport?.message || "Voice features are not supported in this browser. Please use Chrome, Edge, or Safari."}
                </p>
              </div>
            ) : (
              <>
                <div className="settings-group">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={voiceSettings.voiceEnabled}
                      onChange={(e) => updateVoiceSettings("voiceEnabled", e.target.checked)}
                    />
                    <span className="settings-toggle__slider" />
                    <span className="settings-toggle__label">
                      <strong>Enable Voice Features</strong>
                      <span className="settings-toggle__description">
                        Use speech recognition and text-to-speech in interview mode
                      </span>
                    </span>
                  </label>
                </div>

                <div className="settings-group">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={voiceSettings.autoSpeak}
                      onChange={(e) => updateVoiceSettings("autoSpeak", e.target.checked)}
                      disabled={!voiceSettings.voiceEnabled}
                    />
                    <span className="settings-toggle__slider" />
                    <span className="settings-toggle__label">
                      <strong>Auto-Speak AI Responses</strong>
                      <span className="settings-toggle__description">
                        AI interviewer speaks responses automatically
                      </span>
                    </span>
                  </label>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="voice-select">
                    AI Voice
                  </label>
                  <div className="settings-voice-select-wrapper">
                    <select
                      id="voice-select"
                      className="settings-select"
                      value={voiceSettings.selectedVoice || ""}
                      onChange={(e) => updateVoiceSettings("selectedVoice", e.target.value)}
                      disabled={!voiceSettings.voiceEnabled}
                    >
                      {availableVoices.length === 0 && (
                        <option value="">Loading voices...</option>
                      )}
                      {availableVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="settings-voice-test-btn"
                      onClick={testVoice}
                      disabled={!voiceSettings.voiceEnabled || isSpeaking}
                      title="Test voice"
                    >
                      {isSpeaking ? "..." : "🔊 Test"}
                    </button>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="speech-rate">
                    Speech Rate: {voiceSettings.speechRate.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    id="speech-rate"
                    className="settings-range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={voiceSettings.speechRate}
                    onChange={(e) => updateVoiceSettings("speechRate", parseFloat(e.target.value))}
                    disabled={!voiceSettings.voiceEnabled}
                  />
                  <div className="settings-range-labels">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="pitch">
                    Pitch: {voiceSettings.pitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    id="pitch"
                    className="settings-range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={voiceSettings.pitch}
                    onChange={(e) => updateVoiceSettings("pitch", parseFloat(e.target.value))}
                    disabled={!voiceSettings.voiceEnabled}
                  />
                  <div className="settings-range-labels">
                    <span>Low</span>
                    <span>Normal</span>
                    <span>High</span>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="volume">
                    Volume: {Math.round(voiceSettings.volume * 100)}%
                  </label>
                  <input
                    type="range"
                    id="volume"
                    className="settings-range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={voiceSettings.volume}
                    onChange={(e) => updateVoiceSettings("volume", parseFloat(e.target.value))}
                    disabled={!voiceSettings.voiceEnabled}
                  />
                  <div className="settings-range-labels">
                    <span>🔇</span>
                    <span>🔉</span>
                    <span>🔊</span>
                  </div>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="language-select">
                    Recognition Language
                  </label>
                  <select
                    id="language-select"
                    className="settings-select"
                    value={voiceSettings.language}
                    onChange={(e) => updateVoiceSettings("language", e.target.value)}
                    disabled={!voiceSettings.voiceEnabled}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="en-AU">English (Australia)</option>
                    <option value="en-IN">English (India)</option>
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="es-MX">Spanish (Mexico)</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="it-IT">Italian</option>
                    <option value="pt-BR">Portuguese (Brazil)</option>
                    <option value="ja-JP">Japanese</option>
                    <option value="ko-KR">Korean</option>
                    <option value="zh-CN">Chinese (Simplified)</option>
                    <option value="hi-IN">Hindi</option>
                  </select>
                </div>

                <div className="settings-group">
                  <button
                    type="button"
                    className="settings-reset-voice-btn"
                    onClick={resetVoiceSettings}
                  >
                    Reset Voice Settings
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Voice Commands Reference */}
          {voiceSupported && (
            <section className="settings-section" aria-labelledby="voice-commands-heading">
              <h3 id="voice-commands-heading" className="settings-section__title">
                <span className="settings-section__icon">🗣️</span>
                Voice Commands
              </h3>
              <p className="settings-section__description">
                Say these commands during an interview simulation:
              </p>
              <div className="voice-commands-grid">
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Run code"</span>
                  <span className="voice-command-desc">Execute your solution</span>
                </div>
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Next problem"</span>
                  <span className="voice-command-desc">Skip to next section</span>
                </div>
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Give me a hint"</span>
                  <span className="voice-command-desc">Request AI assistance</span>
                </div>
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Pause"</span>
                  <span className="voice-command-desc">Pause the interview</span>
                </div>
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Resume"</span>
                  <span className="voice-command-desc">Continue interview</span>
                </div>
                <div className="voice-command-item">
                  <span className="voice-command-phrase">"Repeat that"</span>
                  <span className="voice-command-desc">AI repeats last response</span>
                </div>
              </div>
            </section>
          )}

          {/* Keyboard Shortcuts Info */}
          <section className="settings-section" aria-labelledby="shortcuts-heading">
            <h3 id="shortcuts-heading" className="settings-section__title">
              <span className="settings-section__icon">⌨️</span>
              Keyboard Shortcuts
            </h3>
            <div className="shortcuts-grid">
              <div className="shortcut-item">
                <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd>
                <span>Run Code</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl/⌘</kbd> + <kbd>Z</kbd>
                <span>Undo</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl/⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
                <span>Redo</span>
              </div>
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>Close modals</span>
              </div>
              <div className="shortcut-item">
                <kbd>Tab</kbd>
                <span>Navigate elements</span>
              </div>
              <div className="shortcut-item">
                <kbd>?</kbd>
                <span>Show shortcuts</span>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-panel__footer">
          <button
            type="button"
            className="settings-reset-btn"
            onClick={resetSettings}
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            className="settings-done-btn"
            onClick={closeSettings}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsPanel);

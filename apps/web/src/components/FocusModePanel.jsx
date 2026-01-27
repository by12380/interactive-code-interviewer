import { memo, useCallback, useEffect, useRef } from "react";
import { useFocusMode, AMBIENT_SOUNDS, BREATHING_PATTERNS } from "../contexts/FocusModeContext.jsx";
import BreathingExercise from "./BreathingExercise.jsx";

function FocusModePanel() {
  const {
    settings,
    updateSetting,
    toggleFocusMode,
    enableFocusMode,
    disableFocusMode,
    resetSettings,
    isPanelOpen,
    closePanel,
    isBreathingActive,
    startBreathing,
    stopBreathing,
  } = useFocusMode();

  const panelRef = useRef(null);
  const firstFocusableRef = useRef(null);

  // Handle escape key and click outside
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closePanel();
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
        closePanel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    // Focus first element
    setTimeout(() => firstFocusableRef.current?.focus(), 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPanelOpen, closePanel]);

  const handlePresetClick = useCallback((preset) => {
    enableFocusMode(preset);
    closePanel(); // Auto-close modal when preset is selected
  }, [enableFocusMode, closePanel]);

  // Auto-close panel when focus mode is enabled via toggle
  const handleToggleFocusMode = useCallback(() => {
    const willEnable = !settings.isEnabled;
    toggleFocusMode();
    if (willEnable) {
      closePanel(); // Auto-close modal when enabling focus mode
    }
  }, [toggleFocusMode, settings.isEnabled, closePanel]);

  const handleBlurChange = useCallback((e) => {
    updateSetting("backgroundBlur", parseInt(e.target.value, 10));
  }, [updateSetting]);

  const handleOpacityChange = useCallback((e) => {
    updateSetting("backgroundOpacity", parseInt(e.target.value, 10));
  }, [updateSetting]);

  const handleVolumeChange = useCallback((e) => {
    updateSetting("ambientVolume", parseInt(e.target.value, 10));
  }, [updateSetting]);

  if (!isPanelOpen) return null;

  return (
    <div className="focus-panel-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-panel-title">
      <div className="focus-panel-backdrop" onClick={closePanel} />
      <div className="focus-panel" ref={panelRef}>
        <div className="focus-panel__header">
          <div className="focus-panel__title-section">
            <span className="focus-panel__icon">🎯</span>
            <h2 id="focus-panel-title">Focus Mode</h2>
          </div>
          <button
            type="button"
            className="focus-panel__close"
            onClick={closePanel}
            ref={firstFocusableRef}
            aria-label="Close focus mode panel"
          >
            ×
          </button>
        </div>

        <div className="focus-panel__content">
          {/* Quick Toggle */}
          <div className="focus-panel__quick-toggle">
            <button
              type="button"
              className={`focus-toggle-btn ${settings.isEnabled ? "focus-toggle-btn--active" : ""}`}
              onClick={handleToggleFocusMode}
            >
              <span className="focus-toggle-btn__icon">
                {settings.isEnabled ? "🔵" : "⚪"}
              </span>
              <span className="focus-toggle-btn__text">
                {settings.isEnabled ? "Focus Mode Active" : "Enable Focus Mode"}
              </span>
            </button>
          </div>

          {/* Quick Presets */}
          <section className="focus-section" aria-labelledby="presets-heading">
            <h3 id="presets-heading" className="focus-section__title">
              <span className="focus-section__icon">⚡</span>
              Quick Presets
            </h3>
            <div className="focus-presets">
              <button
                type="button"
                className="focus-preset-btn"
                onClick={() => handlePresetClick("minimal")}
              >
                <span className="focus-preset-btn__icon">🌙</span>
                <span className="focus-preset-btn__name">Minimal</span>
                <span className="focus-preset-btn__desc">Editor + Problem only</span>
              </button>
              <button
                type="button"
                className="focus-preset-btn focus-preset-btn--zen"
                onClick={() => handlePresetClick("zen")}
              >
                <span className="focus-preset-btn__icon">🧘</span>
                <span className="focus-preset-btn__name">Zen Mode</span>
                <span className="focus-preset-btn__desc">Maximum focus</span>
              </button>
            </div>
          </section>

          {/* UI Visibility Controls */}
          <section className="focus-section" aria-labelledby="visibility-heading">
            <h3 id="visibility-heading" className="focus-section__title">
              <span className="focus-section__icon">👁️</span>
              Hide UI Elements
            </h3>
            <div className="focus-toggles">
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={settings.hideSidebar}
                  onChange={(e) => updateSetting("hideSidebar", e.target.checked)}
                />
                <span className="focus-toggle__slider" />
                <span className="focus-toggle__label">Hide Sidebar</span>
              </label>
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={settings.hideProblem}
                  onChange={(e) => updateSetting("hideProblem", e.target.checked)}
                />
                <span className="focus-toggle__slider" />
                <span className="focus-toggle__label">Hide Problem Panel</span>
              </label>
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={settings.hideChat}
                  onChange={(e) => updateSetting("hideChat", e.target.checked)}
                />
                <span className="focus-toggle__slider" />
                <span className="focus-toggle__label">Hide Chat Panel</span>
              </label>
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={settings.hideMetrics}
                  onChange={(e) => updateSetting("hideMetrics", e.target.checked)}
                />
                <span className="focus-toggle__slider" />
                <span className="focus-toggle__label">Hide Metrics</span>
              </label>
              <label className="focus-toggle">
                <input
                  type="checkbox"
                  checked={settings.hideHeader}
                  onChange={(e) => updateSetting("hideHeader", e.target.checked)}
                />
                <span className="focus-toggle__slider" />
                <span className="focus-toggle__label">Hide Header</span>
              </label>
            </div>
          </section>

          {/* Visual Effects */}
          <section className="focus-section" aria-labelledby="effects-heading">
            <h3 id="effects-heading" className="focus-section__title">
              <span className="focus-section__icon">✨</span>
              Visual Effects
            </h3>
            <div className="focus-sliders">
              <div className="focus-slider">
                <label className="focus-slider__label" htmlFor="blur-slider">
                  Background Blur: {settings.backgroundBlur}px
                </label>
                <input
                  type="range"
                  id="blur-slider"
                  className="focus-slider__input"
                  min="0"
                  max="20"
                  step="1"
                  value={settings.backgroundBlur}
                  onChange={handleBlurChange}
                />
                <div className="focus-slider__marks">
                  <span>None</span>
                  <span>Subtle</span>
                  <span>Heavy</span>
                </div>
              </div>
              <div className="focus-slider">
                <label className="focus-slider__label" htmlFor="opacity-slider">
                  Background Opacity: {settings.backgroundOpacity}%
                </label>
                <input
                  type="range"
                  id="opacity-slider"
                  className="focus-slider__input"
                  min="50"
                  max="100"
                  step="5"
                  value={settings.backgroundOpacity}
                  onChange={handleOpacityChange}
                />
                <div className="focus-slider__marks">
                  <span>Dim</span>
                  <span>Normal</span>
                  <span>Full</span>
                </div>
              </div>
            </div>
          </section>

          {/* Ambient Sounds */}
          <section className="focus-section" aria-labelledby="ambient-heading">
            <h3 id="ambient-heading" className="focus-section__title">
              <span className="focus-section__icon">🎵</span>
              Ambient Sounds
            </h3>
            <div className="ambient-sounds-grid">
              {Object.values(AMBIENT_SOUNDS).map((sound) => (
                <button
                  key={sound.id}
                  type="button"
                  className={`ambient-sound-btn ${settings.ambientSound === sound.id ? "ambient-sound-btn--active" : ""}`}
                  onClick={() => updateSetting("ambientSound", sound.id)}
                  aria-pressed={settings.ambientSound === sound.id}
                >
                  <span className="ambient-sound-btn__icon">{sound.icon}</span>
                  <span className="ambient-sound-btn__name">{sound.name}</span>
                </button>
              ))}
            </div>
            {settings.ambientSound !== "silence" && (
              <div className="focus-slider focus-slider--volume">
                <label className="focus-slider__label" htmlFor="volume-slider">
                  Volume: {settings.ambientVolume}%
                </label>
                <input
                  type="range"
                  id="volume-slider"
                  className="focus-slider__input"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.ambientVolume}
                  onChange={handleVolumeChange}
                />
                <div className="focus-slider__marks">
                  <span>🔇</span>
                  <span>🔉</span>
                  <span>🔊</span>
                </div>
              </div>
            )}
          </section>

          {/* Breathing Exercise */}
          <section className="focus-section" aria-labelledby="breathing-heading">
            <h3 id="breathing-heading" className="focus-section__title">
              <span className="focus-section__icon">🌬️</span>
              Breathing Exercise
            </h3>
            <p className="focus-section__description">
              Take a moment to relax and reduce stress with guided breathing.
            </p>
            
            {/* Breathing Pattern Selector */}
            <div className="breathing-patterns">
              {Object.values(BREATHING_PATTERNS).map((pattern) => (
                <button
                  key={pattern.id}
                  type="button"
                  className={`breathing-pattern-btn ${settings.breathingPattern === pattern.id ? "breathing-pattern-btn--active" : ""}`}
                  onClick={() => updateSetting("breathingPattern", pattern.id)}
                  aria-pressed={settings.breathingPattern === pattern.id}
                >
                  <span className="breathing-pattern-btn__icon">{pattern.icon}</span>
                  <span className="breathing-pattern-btn__info">
                    <span className="breathing-pattern-btn__name">{pattern.name}</span>
                    <span className="breathing-pattern-btn__desc">{pattern.description}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Breathing Exercise Widget */}
            <BreathingExercise
              isActive={isBreathingActive}
              onStart={startBreathing}
              onStop={stopBreathing}
              pattern={BREATHING_PATTERNS[settings.breathingPattern]}
            />
          </section>

          {/* Keyboard Shortcuts */}
          <section className="focus-section" aria-labelledby="shortcuts-heading">
            <h3 id="shortcuts-heading" className="focus-section__title">
              <span className="focus-section__icon">⌨️</span>
              Keyboard Shortcuts
            </h3>
            <div className="focus-shortcuts">
              <div className="focus-shortcut">
                <kbd>Ctrl/⌘</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>
                <span>Toggle Focus Mode</span>
              </div>
              <div className="focus-shortcut">
                <kbd>Esc</kbd>
                <span>Exit Focus Mode</span>
              </div>
            </div>
          </section>
        </div>

        <div className="focus-panel__footer">
          <button
            type="button"
            className="focus-reset-btn"
            onClick={resetSettings}
          >
            Reset to Defaults
          </button>
          {settings.isEnabled && (
            <button
              type="button"
              className="focus-exit-btn"
              onClick={disableFocusMode}
            >
              Exit Focus Mode
            </button>
          )}
          <button
            type="button"
            className="focus-done-btn"
            onClick={closePanel}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(FocusModePanel);

import { memo, useCallback, useEffect, useRef } from "react";
import { useTheme, THEMES, COLOR_SCHEMES } from "../contexts/ThemeContext.jsx";

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

import { memo, useCallback, useState } from "react";
import { useTheme, THEMES, COLOR_SCHEMES } from "../contexts/ThemeContext.jsx";
import { useVoice } from "../contexts/VoiceContext.jsx";
import { useFocusMode } from "../contexts/FocusModeContext.jsx";

const SETTINGS_TABS = [
  { id: "general", label: "General", icon: "\u{1F3A8}" },
  { id: "tools", label: "Tools", icon: "\u{1F6E0}\uFE0F" },
  { id: "voice", label: "Voice", icon: "\u{1F3A4}" },
  { id: "accessibility", label: "Accessibility", icon: "\u267F" },
  { id: "shortcuts", label: "Shortcuts", icon: "\u2328\uFE0F" },
  { id: "help", label: "Help", icon: "\u2753" },
];

function SettingsPanel({
  onNavigate,
  onOpenTranslator,
  onOpenTemplates,
  onOpenSplitScreen,
  onStartTutorial,
  user,
}) {
  const {
    theme,
    setTheme,
    colorScheme,
    setColorScheme,
    accessibility,
    updateAccessibility,
    resetSettings,
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

  const {
    settings: focusSettings,
    toggleFocusMode,
    updateSetting: updateFocusSetting,
  } = useFocusMode();

  const [activeTab, setActiveTab] = useState("general");

  const handleFontSizeChange = useCallback(
    (e) => updateAccessibility("fontSize", e.target.value),
    [updateAccessibility]
  );

  return (
    <div className="screen screen--settings">
      {/* Screen Header */}
      <div className="screen__header">
        <button 
          type="button" 
          className="screen__back-btn"
          onClick={() => onNavigate("interview")}
          aria-label="Back to interview"
        >
          <span className="screen__back-arrow">&larr;</span>
          Back
        </button>
        <h1 className="screen__title">Settings</h1>
      </div>

      <div className="settings-layout">
        {/* Tab Navigation */}
        <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tabs__item ${activeTab === tab.id ? "settings-tabs__item--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-tabpanel-${tab.id}`}
            >
              <span className="settings-tabs__icon">{tab.icon}</span>
              <span className="settings-tabs__label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="settings-content">
          {/* General Tab */}
          {activeTab === "general" && (
            <div role="tabpanel" id="settings-tabpanel-general" className="settings-tabpanel">
              <section className="settings-section" aria-labelledby="theme-heading">
                <h3 id="theme-heading" className="settings-section__title">
                  <span className="settings-section__icon">{"\u{1F3A8}"}</span>
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

              {/* Focus Mode Section */}
              <section className="settings-section" aria-labelledby="focus-heading">
                <h3 id="focus-heading" className="settings-section__title">
                  <span className="settings-section__icon">{"\u{1F3AF}"}</span>
                  Focus Mode
                </h3>

                <div className="settings-group">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={focusSettings.isEnabled}
                      onChange={toggleFocusMode}
                    />
                    <span className="settings-toggle__slider" />
                    <span className="settings-toggle__label">
                      <strong>Enable Focus Mode</strong>
                      <span className="settings-toggle__description">
                        Minimize distractions by hiding non-essential UI elements
                      </span>
                    </span>
                  </label>
                </div>

                {focusSettings.isEnabled && (
                  <>
                    <div className="settings-group">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={focusSettings.hideSidebar}
                          onChange={(e) => updateFocusSetting("hideSidebar", e.target.checked)}
                        />
                        <span className="settings-toggle__slider" />
                        <span className="settings-toggle__label">
                          <strong>Hide Sidebar</strong>
                        </span>
                      </label>
                    </div>
                    <div className="settings-group">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={focusSettings.hideHeader}
                          onChange={(e) => updateFocusSetting("hideHeader", e.target.checked)}
                        />
                        <span className="settings-toggle__slider" />
                        <span className="settings-toggle__label">
                          <strong>Hide Header</strong>
                        </span>
                      </label>
                    </div>
                    <div className="settings-group">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={focusSettings.hideChat}
                          onChange={(e) => updateFocusSetting("hideChat", e.target.checked)}
                        />
                        <span className="settings-toggle__slider" />
                        <span className="settings-toggle__label">
                          <strong>Hide Chat Panel</strong>
                        </span>
                      </label>
                    </div>
                    <div className="settings-group">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={focusSettings.hideMetrics}
                          onChange={(e) => updateFocusSetting("hideMetrics", e.target.checked)}
                        />
                        <span className="settings-toggle__slider" />
                        <span className="settings-toggle__label">
                          <strong>Hide Metrics</strong>
                        </span>
                      </label>
                    </div>
                    <div className="settings-group">
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={focusSettings.zenMode}
                          onChange={(e) => updateFocusSetting("zenMode", e.target.checked)}
                        />
                        <span className="settings-toggle__slider" />
                        <span className="settings-toggle__label">
                          <strong>Zen Mode</strong>
                          <span className="settings-toggle__description">
                            Editor only &mdash; maximum focus
                          </span>
                        </span>
                      </label>
                    </div>
                  </>
                )}
              </section>

              <div className="settings-section__actions">
                <button type="button" className="settings-reset-btn" onClick={resetSettings}>
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === "tools" && (
            <div role="tabpanel" id="settings-tabpanel-tools" className="settings-tabpanel">
              <section className="settings-section">
                <h3 className="settings-section__title">
                  <span className="settings-section__icon">{"\u{1F6E0}\uFE0F"}</span>
                  Practice Tools
                </h3>
                <p className="settings-section__description">
                  Launch tools to enhance your interview preparation.
                </p>

                <div className="settings-tools-grid">
                  <button
                    type="button"
                    className="settings-tool-card"
                    onClick={onOpenTranslator}
                  >
                    <span className="settings-tool-card__icon">{"\u{1F504}"}</span>
                    <div className="settings-tool-card__info">
                      <strong>Code Translator</strong>
                      <span>Translate code between programming languages</span>
                    </div>
                    <span className="settings-tool-card__arrow">{"\u2192"}</span>
                  </button>

                  <button
                    type="button"
                    className="settings-tool-card"
                    onClick={onOpenTemplates}
                  >
                    <span className="settings-tool-card__icon">{"\u{1F4DD}"}</span>
                    <div className="settings-tool-card__info">
                      <strong>Prompt Templates</strong>
                      <span>Pre-built AI prompts for common scenarios</span>
                    </div>
                    <span className="settings-tool-card__arrow">{"\u2192"}</span>
                  </button>

                  <button
                    type="button"
                    className="settings-tool-card"
                    onClick={onOpenSplitScreen}
                  >
                    <span className="settings-tool-card__icon">{"\u{1F4CA}"}</span>
                    <div className="settings-tool-card__info">
                      <strong>Multi-Problem Practice</strong>
                      <span>Work on multiple problems side by side</span>
                    </div>
                    <span className="settings-tool-card__arrow">{"\u2192"}</span>
                  </button>

                  {user && (
                    <button
                      type="button"
                      className="settings-tool-card"
                      onClick={() => onNavigate("roadmap")}
                    >
                      <span className="settings-tool-card__icon">{"\u{1F5FA}\uFE0F"}</span>
                      <div className="settings-tool-card__info">
                        <strong>Prep Roadmap</strong>
                        <span>Personalized study plan and progress tracking</span>
                      </div>
                      <span className="settings-tool-card__arrow">{"\u2192"}</span>
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === "voice" && (
            <div role="tabpanel" id="settings-tabpanel-voice" className="settings-tabpanel">
              <section className="settings-section" aria-labelledby="voice-heading">
                <h3 id="voice-heading" className="settings-section__title">
                  <span className="settings-section__icon">{"\u{1F3A4}"}</span>
                  Voice Settings
                </h3>

                {!voiceSupported ? (
                  <div className="settings-group settings-group--warning">
                    <p className="settings-warning">
                      <span className="settings-warning__icon">{"\u26A0\uFE0F"}</span>
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
                          {isSpeaking ? "..." : "\u{1F50A} Test"}
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
                        <span>{"\u{1F507}"}</span>
                        <span>{"\u{1F509}"}</span>
                        <span>{"\u{1F50A}"}</span>
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
                    <span className="settings-section__icon">{"\u{1F5E3}\uFE0F"}</span>
                    Voice Commands
                  </h3>
                  <p className="settings-section__description">
                    Say these commands during an interview simulation:
                  </p>
                  <div className="voice-commands-grid">
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Run code&quot;</span>
                      <span className="voice-command-desc">Execute your solution</span>
                    </div>
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Next problem&quot;</span>
                      <span className="voice-command-desc">Skip to next section</span>
                    </div>
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Give me a hint&quot;</span>
                      <span className="voice-command-desc">Request AI assistance</span>
                    </div>
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Pause&quot;</span>
                      <span className="voice-command-desc">Pause the interview</span>
                    </div>
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Resume&quot;</span>
                      <span className="voice-command-desc">Continue interview</span>
                    </div>
                    <div className="voice-command-item">
                      <span className="voice-command-phrase">&quot;Repeat that&quot;</span>
                      <span className="voice-command-desc">AI repeats last response</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Accessibility Tab */}
          {activeTab === "accessibility" && (
            <div role="tabpanel" id="settings-tabpanel-accessibility" className="settings-tabpanel">
              <section className="settings-section" aria-labelledby="a11y-heading">
                <h3 id="a11y-heading" className="settings-section__title">
                  <span className="settings-section__icon">{"\u267F"}</span>
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
            </div>
          )}

          {/* Shortcuts Tab */}
          {activeTab === "shortcuts" && (
            <div role="tabpanel" id="settings-tabpanel-shortcuts" className="settings-tabpanel">
              <section className="settings-section" aria-labelledby="shortcuts-heading">
                <h3 id="shortcuts-heading" className="settings-section__title">
                  <span className="settings-section__icon">{"\u2328\uFE0F"}</span>
                  Keyboard Shortcuts
                </h3>
                <div className="shortcuts-grid">
                  <div className="shortcut-item">
                    <kbd>Ctrl/\u2318</kbd> + <kbd>Enter</kbd>
                    <span>Run Code</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Ctrl/\u2318</kbd> + <kbd>Z</kbd>
                    <span>Undo</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Ctrl/\u2318</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
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
          )}

          {/* Help Tab */}
          {activeTab === "help" && (
            <div role="tabpanel" id="settings-tabpanel-help" className="settings-tabpanel">
              <section className="settings-section">
                <h3 className="settings-section__title">
                  <span className="settings-section__icon">{"\u2753"}</span>
                  Help &amp; Resources
                </h3>

                <div className="settings-tools-grid">
                  <button
                    type="button"
                    className="settings-tool-card"
                    onClick={onStartTutorial}
                  >
                    <span className="settings-tool-card__icon">{"\u{1F4D6}"}</span>
                    <div className="settings-tool-card__info">
                      <strong>How It Works</strong>
                      <span>Interactive walkthrough of the platform features</span>
                    </div>
                    <span className="settings-tool-card__arrow">{"\u2192"}</span>
                  </button>

                  <div className="settings-help-info">
                    <h4>Tips for Success</h4>
                    <ul>
                      <li>Talk through your approach before coding</li>
                      <li>Start with a brute-force solution, then optimize</li>
                      <li>Test with edge cases before submitting</li>
                      <li>Use the AI interviewer to practice explaining your code</li>
                      <li>Review your score reports to identify areas for improvement</li>
                    </ul>
                  </div>

                  <div className="settings-help-info">
                    <h4>About</h4>
                    <p>
                      AI Coding Interviewer helps you prepare for technical interviews
                      with real-time AI feedback, scoring, and detailed analysis.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsPanel);

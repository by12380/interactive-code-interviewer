import { memo, useState, useCallback, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import {
  SUPPORTED_LANGUAGES,
  detectLanguage,
  getLanguagePairInfo,
  getIdiomaticSuggestions,
  validateTranslation,
} from "../services/codeTranslationService.js";
import { translateCode } from "../api.js";

function CodeTranslatorPanel({ onClose, initialCode = "", initialLanguage = null }) {
  const { theme } = useTheme();
  
  // Source code state
  const [sourceCode, setSourceCode] = useState(initialCode);
  const [sourceLanguage, setSourceLanguage] = useState(
    initialLanguage || detectLanguage(initialCode) || "javascript"
  );
  
  // Target code state
  const [targetCode, setTargetCode] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("python");
  
  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [translationHistory, setTranslationHistory] = useState([]);
  
  // Options state
  const [preserveComments, setPreserveComments] = useState(true);
  const [generateIdiomatic, setGenerateIdiomatic] = useState(true);
  const [includeTestCases, setIncludeTestCases] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState("translate");
  const [showOptions, setShowOptions] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);
  
  const panelRef = useRef(null);
  const sourceEditorRef = useRef(null);
  const targetEditorRef = useRef(null);

  // Get language pair compatibility info
  const pairInfo = getLanguagePairInfo(sourceLanguage, targetLanguage);

  // Auto-detect language when source code changes
  useEffect(() => {
    if (sourceCode && !initialLanguage) {
      const detected = detectLanguage(sourceCode);
      if (detected && detected !== sourceLanguage) {
        setSourceLanguage(detected);
      }
    }
  }, [sourceCode, initialLanguage, sourceLanguage]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Handle translation
  const handleTranslate = useCallback(async () => {
    if (!sourceCode.trim()) {
      setError("Please enter some code to translate");
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setError("Source and target languages must be different");
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTargetCode("");
    setSuggestions([]);
    setValidationIssues([]);

    try {
      const result = await translateCode({
        code: sourceCode,
        sourceLanguage,
        targetLanguage,
        options: {
          preserveComments,
          generateIdiomatic,
          includeTestCases,
        },
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setTargetCode(result.translatedCode);
      
      // Get idiomatic suggestions
      const idiomaticSuggestions = getIdiomaticSuggestions(
        result.translatedCode,
        targetLanguage
      );
      setSuggestions(idiomaticSuggestions);

      // Validate translation
      const validation = validateTranslation(
        sourceCode,
        result.translatedCode,
        targetLanguage
      );
      setValidationIssues(validation.issues);

      // Add to history
      setTranslationHistory((prev) => [
        {
          id: Date.now(),
          sourceLanguage,
          targetLanguage,
          sourceCode: sourceCode.substring(0, 100) + (sourceCode.length > 100 ? "..." : ""),
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);
    } catch (err) {
      setError(err.message || "Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }, [sourceCode, sourceLanguage, targetLanguage, preserveComments, generateIdiomatic, includeTestCases]);

  // Swap languages
  const handleSwapLanguages = useCallback(() => {
    const tempLang = sourceLanguage;
    const tempCode = sourceCode;
    
    setSourceLanguage(targetLanguage);
    setTargetLanguage(tempLang);
    
    if (targetCode) {
      setSourceCode(targetCode);
      setTargetCode(tempCode);
    }
  }, [sourceLanguage, targetLanguage, sourceCode, targetCode]);

  // Copy target code
  const handleCopyTarget = useCallback(async () => {
    if (!targetCode) return;
    
    try {
      await navigator.clipboard.writeText(targetCode);
      setCopiedTarget(true);
      setTimeout(() => setCopiedTarget(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [targetCode]);

  // Clear all
  const handleClear = useCallback(() => {
    setSourceCode("");
    setTargetCode("");
    setError(null);
    setSuggestions([]);
    setValidationIssues([]);
  }, []);

  // Handle source editor mount
  const handleSourceEditorMount = useCallback((editor) => {
    sourceEditorRef.current = editor;
  }, []);

  // Handle target editor mount
  const handleTargetEditorMount = useCallback((editor) => {
    targetEditorRef.current = editor;
  }, []);

  const languages = Object.values(SUPPORTED_LANGUAGES);

  return (
    <div className="translator-overlay" role="dialog" aria-modal="true" aria-labelledby="translator-title">
      <div className="translator-backdrop" onClick={onClose} />
      <div className="translator-panel" ref={panelRef}>
        {/* Header */}
        <div className="translator-panel__header">
          <div className="translator-panel__title-section">
            <h2 id="translator-title" className="translator-panel__title">
              <span className="translator-panel__icon">🔄</span>
              Code Translator
            </h2>
            <p className="translator-panel__subtitle">
              Convert code between Python, JavaScript, Java, and C++
            </p>
          </div>
          <button
            type="button"
            className="translator-panel__close"
            onClick={onClose}
            aria-label="Close translator"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="translator-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "translate"}
            className={`translator-tab ${activeTab === "translate" ? "translator-tab--active" : ""}`}
            onClick={() => setActiveTab("translate")}
          >
            <span className="translator-tab__icon">🔄</span>
            Translate
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`translator-tab ${activeTab === "history" ? "translator-tab--active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span className="translator-tab__icon">📜</span>
            History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reference"}
            className={`translator-tab ${activeTab === "reference" ? "translator-tab--active" : ""}`}
            onClick={() => setActiveTab("reference")}
          >
            <span className="translator-tab__icon">📚</span>
            Reference
          </button>
        </div>

        {/* Main Content */}
        <div className="translator-panel__content">
          {activeTab === "translate" && (
            <>
              {/* Language Selectors */}
              <div className="translator-language-bar">
                <div className="translator-language-select">
                  <label htmlFor="source-language">Source</label>
                  <select
                    id="source-language"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="translator-select"
                  >
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.icon} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="translator-swap-btn"
                  onClick={handleSwapLanguages}
                  aria-label="Swap languages"
                  title="Swap languages"
                >
                  ⇄
                </button>

                <div className="translator-language-select">
                  <label htmlFor="target-language">Target</label>
                  <select
                    id="target-language"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="translator-select"
                  >
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.icon} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="translator-options-toggle"
                  onClick={() => setShowOptions(!showOptions)}
                  aria-expanded={showOptions}
                >
                  <span className="translator-options-toggle__icon">⚙️</span>
                  Options
                </button>
              </div>

              {/* Options Panel */}
              {showOptions && (
                <div className="translator-options">
                  <label className="translator-option">
                    <input
                      type="checkbox"
                      checked={preserveComments}
                      onChange={(e) => setPreserveComments(e.target.checked)}
                    />
                    <span className="translator-option__label">
                      <strong>Preserve Comments</strong>
                      <span>Keep and convert comments to target language format</span>
                    </span>
                  </label>
                  <label className="translator-option">
                    <input
                      type="checkbox"
                      checked={generateIdiomatic}
                      onChange={(e) => setGenerateIdiomatic(e.target.checked)}
                    />
                    <span className="translator-option__label">
                      <strong>Generate Idiomatic Code</strong>
                      <span>Use language-specific best practices and patterns</span>
                    </span>
                  </label>
                  <label className="translator-option">
                    <input
                      type="checkbox"
                      checked={includeTestCases}
                      onChange={(e) => setIncludeTestCases(e.target.checked)}
                    />
                    <span className="translator-option__label">
                      <strong>Translate Test Cases</strong>
                      <span>Convert test assertions to target language format</span>
                    </span>
                  </label>
                </div>
              )}

              {/* Compatibility Notes */}
              {pairInfo.notes.length > 0 && (
                <div className="translator-compatibility">
                  <div className="translator-compatibility__header">
                    <span className="translator-compatibility__icon">💡</span>
                    Translation Notes ({SUPPORTED_LANGUAGES[sourceLanguage]?.name} → {SUPPORTED_LANGUAGES[targetLanguage]?.name})
                  </div>
                  <ul className="translator-compatibility__list">
                    {pairInfo.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editors */}
              <div className="translator-editors">
                {/* Source Editor */}
                <div className="translator-editor">
                  <div className="translator-editor__header">
                    <span className="translator-editor__title">
                      {SUPPORTED_LANGUAGES[sourceLanguage]?.icon} Source Code
                    </span>
                    <button
                      type="button"
                      className="translator-editor__action"
                      onClick={handleClear}
                      disabled={!sourceCode}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="translator-editor__container">
                    <Editor
                      height="300px"
                      language={SUPPORTED_LANGUAGES[sourceLanguage]?.monacoLanguage || "javascript"}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      value={sourceCode}
                      onChange={(value) => setSourceCode(value || "")}
                      onMount={handleSourceEditorMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        lineNumbers: "on",
                        tabSize: 2,
                      }}
                    />
                  </div>
                </div>

                {/* Target Editor */}
                <div className="translator-editor">
                  <div className="translator-editor__header">
                    <span className="translator-editor__title">
                      {SUPPORTED_LANGUAGES[targetLanguage]?.icon} Translated Code
                    </span>
                    <button
                      type="button"
                      className="translator-editor__action translator-editor__action--copy"
                      onClick={handleCopyTarget}
                      disabled={!targetCode}
                    >
                      {copiedTarget ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                  <div className="translator-editor__container">
                    <Editor
                      height="300px"
                      language={SUPPORTED_LANGUAGES[targetLanguage]?.monacoLanguage || "python"}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      value={targetCode}
                      onChange={(value) => setTargetCode(value || "")}
                      onMount={handleTargetEditorMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        lineNumbers: "on",
                        tabSize: 2,
                        readOnly: false,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="translator-error" role="alert">
                  <span className="translator-error__icon">⚠️</span>
                  {error}
                </div>
              )}

              {/* Validation Issues */}
              {validationIssues.length > 0 && (
                <div className="translator-validation">
                  <div className="translator-validation__header">
                    <span className="translator-validation__icon">🔍</span>
                    Translation Notes
                  </div>
                  <ul className="translator-validation__list">
                    {validationIssues.map((issue, index) => (
                      <li
                        key={index}
                        className={`translator-validation__item translator-validation__item--${issue.type}`}
                      >
                        <span className="translator-validation__badge">
                          {issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️"}
                        </span>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Idiomatic Suggestions */}
              {suggestions.length > 0 && (
                <div className="translator-suggestions">
                  <div className="translator-suggestions__header">
                    <span className="translator-suggestions__icon">✨</span>
                    Idiomatic Suggestions
                  </div>
                  <ul className="translator-suggestions__list">
                    {suggestions.map((suggestion, index) => (
                      <li key={index} className="translator-suggestions__item">
                        <p className="translator-suggestions__message">{suggestion.message}</p>
                        {suggestion.example && (
                          <code className="translator-suggestions__example">{suggestion.example}</code>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Translate Button */}
              <div className="translator-actions">
                <button
                  type="button"
                  className="translator-translate-btn"
                  onClick={handleTranslate}
                  disabled={isTranslating || !sourceCode.trim()}
                >
                  {isTranslating ? (
                    <>
                      <span className="translator-translate-btn__spinner" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <span className="translator-translate-btn__icon">🔄</span>
                      Translate Code
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {activeTab === "history" && (
            <div className="translator-history">
              {translationHistory.length === 0 ? (
                <div className="translator-history__empty">
                  <span className="translator-history__empty-icon">📜</span>
                  <p>No translation history yet</p>
                  <p className="translator-history__empty-hint">
                    Your recent translations will appear here
                  </p>
                </div>
              ) : (
                <ul className="translator-history__list">
                  {translationHistory.map((item) => (
                    <li key={item.id} className="translator-history__item">
                      <div className="translator-history__languages">
                        <span className="translator-history__lang">
                          {SUPPORTED_LANGUAGES[item.sourceLanguage]?.icon}{" "}
                          {SUPPORTED_LANGUAGES[item.sourceLanguage]?.name}
                        </span>
                        <span className="translator-history__arrow">→</span>
                        <span className="translator-history__lang">
                          {SUPPORTED_LANGUAGES[item.targetLanguage]?.icon}{" "}
                          {SUPPORTED_LANGUAGES[item.targetLanguage]?.name}
                        </span>
                      </div>
                      <div className="translator-history__preview">{item.sourceCode}</div>
                      <div className="translator-history__time">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "reference" && (
            <div className="translator-reference">
              <h3 className="translator-reference__title">Language Feature Reference</h3>
              
              <div className="translator-reference__grid">
                {languages.map((lang) => (
                  <div key={lang.id} className="translator-reference__card">
                    <div className="translator-reference__card-header">
                      <span className="translator-reference__card-icon">{lang.icon}</span>
                      <span className="translator-reference__card-name">{lang.name}</span>
                    </div>
                    <div className="translator-reference__card-content">
                      <h4>Key Features</h4>
                      <ul className="translator-reference__features">
                        {lang.features.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                      <h4>Comments</h4>
                      <div className="translator-reference__syntax">
                        <code>Single: {lang.commentSingle}</code>
                        <code>Multi: {lang.commentMultiStart}...{lang.commentMultiEnd}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="translator-reference__tips">
                <h3 className="translator-reference__tips-title">
                  <span className="translator-reference__tips-icon">💡</span>
                  Translation Tips
                </h3>
                <ul className="translator-reference__tips-list">
                  <li>
                    <strong>Python → JavaScript:</strong> List comprehensions become map/filter chains.
                    Generators become async iterators.
                  </li>
                  <li>
                    <strong>JavaScript → Python:</strong> Arrow functions become lambdas or regular functions.
                    Promises translate to asyncio.
                  </li>
                  <li>
                    <strong>Java → Python/JS:</strong> Explicit types are removed or become optional hints.
                    Streams become functional methods.
                  </li>
                  <li>
                    <strong>C++ → Others:</strong> Manual memory management is removed.
                    Templates become generic patterns.
                  </li>
                  <li>
                    <strong>Any → Java:</strong> Code may need to be wrapped in a class.
                    Dynamic typing requires explicit types.
                  </li>
                  <li>
                    <strong>Any → C++:</strong> May need #include directives.
                    Consider memory management patterns.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CodeTranslatorPanel);

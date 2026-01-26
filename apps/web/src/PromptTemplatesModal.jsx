import { useEffect, useMemo, useState } from "react";
import {
  BUILTIN_PROMPT_TEMPLATES,
  PROMPT_TEMPLATE_CATEGORIES,
  createCustomPromptTemplate,
  extractTemplateVariables,
  normalizeCustomPromptTemplates,
  renderTemplate
} from "./promptTemplates.js";

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
      <div className="ici-modal__panel templates-modal__panel">
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

function categoryLabel(c) {
  const s = String(c || "");
  if (!s) return "Other";
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export default function PromptTemplatesModal({
  isOpen,
  onClose,
  storageUserId,
  customTemplates,
  onChangeCustomTemplates,
  contextVars,
  onRunPrompt
}) {
  const normalizedCustom = useMemo(
    () => normalizeCustomPromptTemplates(customTemplates),
    [customTemplates]
  );

  const templates = useMemo(() => {
    const custom = normalizedCustom.map((t) => ({ ...t, source: "custom" }));
    return [...BUILTIN_PROMPT_TEMPLATES, ...custom];
  }, [normalizedCustom]);

  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null); // { ...template }
  const [vars, setVars] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setCategory("all");
    setQuery("");
    const first = templates[0]?.id || "";
    setSelectedId((prev) => prev || first);
    setDraft(null);
    setVars({});
  }, [isOpen]); // intentionally not depending on templates

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && String(t.category || "") !== category) return false;
      if (!q) return true;
      return (
        String(t.title || "").toLowerCase().includes(q) ||
        String(t.body || "").toLowerCase().includes(q)
      );
    });
  }, [templates, category, query]);

  const selected = useMemo(() => {
    const inDraft = draft && draft.id === selectedId ? draft : null;
    if (inDraft) return inDraft;
    return templates.find((t) => t.id === selectedId) || null;
  }, [templates, selectedId, draft]);

  const variableKeys = useMemo(() => extractTemplateVariables(selected?.body || ""), [selected]);

  const effectiveContext = useMemo(() => {
    const ctx = contextVars && typeof contextVars === "object" ? contextVars : {};
    return {
      ...ctx,
      storageUserId: String(storageUserId || "guest")
    };
  }, [contextVars, storageUserId]);

  useEffect(() => {
    if (!isOpen) return;
    // Initialize variables when selection changes (but don't clobber user edits).
    setVars((prev) => {
      const next = { ...(prev || {}) };
      for (const k of variableKeys) {
        if (next[k] != null && String(next[k]).trim() !== "") continue;
        if (effectiveContext[k] != null && String(effectiveContext[k]).trim() !== "") {
          next[k] = String(effectiveContext[k]);
        } else {
          next[k] = next[k] ?? "";
        }
      }
      return next;
    });
  }, [isOpen, selectedId, variableKeys.join("|")]);

  const startNewCustom = () => {
    const t = createCustomPromptTemplate({
      title: "New template",
      category: "explanation",
      body: "Write your prompt here.\n\nCode:\n{{code}}"
    });
    setDraft(t);
    setSelectedId(t.id);
    setError("");
  };

  const duplicateToCustom = () => {
    if (!selected) return;
    const t = createCustomPromptTemplate({
      title: `${selected.title} (copy)`,
      category: selected.category,
      body: selected.body
    });
    setDraft(t);
    setSelectedId(t.id);
    setError("");
  };

  const isEditingCustom = Boolean(selected && selected.source === "custom" && draft);

  const saveDraft = () => {
    if (!draft) return;
    const title = String(draft.title || "").trim();
    const body = String(draft.body || "").trim();
    if (!title || !body) {
      setError("Title and body are required.");
      return;
    }
    setError("");
    const now = Date.now();
    const next = normalizeCustomPromptTemplates(customTemplates);
    const idx = next.findIndex((t) => t.id === draft.id);
    const updated = { ...draft, title, body, updatedAt: now, source: "custom" };
    if (idx === -1) {
      onChangeCustomTemplates?.([...next, updated]);
    } else {
      const copy = [...next];
      copy[idx] = updated;
      onChangeCustomTemplates?.(copy);
    }
    setDraft(null);
  };

  const deleteCustom = () => {
    if (!selected || selected.source !== "custom") return;
    const next = normalizeCustomPromptTemplates(customTemplates).filter((t) => t.id !== selected.id);
    onChangeCustomTemplates?.(next);
    setDraft(null);
    setSelectedId(BUILTIN_PROMPT_TEMPLATES[0]?.id || "");
  };

  const runTemplate = (templateToRun = selected) => {
    if (!templateToRun) return;
    const rendered = renderTemplate(templateToRun.body || "", {
      ...effectiveContext,
      ...(vars || {})
    });
    if (rendered.missing.length) {
      setError(`Missing: ${rendered.missing.join(", ")}`);
      return;
    }
    setError("");
    onRunPrompt?.(rendered.text);
    onClose?.();
  };

  const runFromList = (t) => {
    if (!t) return;
    const rendered = renderTemplate(t.body || "", { ...effectiveContext });
    if (rendered.missing.length) {
      setSelectedId(t.id);
      setDraft(null);
      setError(`Missing: ${rendered.missing.join(", ")}`);
      return;
    }
    setError("");
    onRunPrompt?.(rendered.text);
    onClose?.();
  };

  const preview = useMemo(() => {
    if (!selected) return "";
    const rendered = renderTemplate(selected.body || "", { ...effectiveContext, ...(vars || {}) });
    return rendered.text;
  }, [selected, vars, effectiveContext]);

  const canEditSelected = Boolean(selected && selected.source === "custom");

  return (
    <Modal isOpen={isOpen} title="AI Prompt Templates" onClose={onClose}>
      <div className="templates">
        <div className="templates__top">
          <div className="templates__filters">
            <label className="templates__field">
              <span className="templates__label">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All</option>
                {PROMPT_TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
            </label>
            <label className="templates__field templates__field--grow">
              <span className="templates__label">Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find templates…"
              />
            </label>
          </div>
          <div className="templates__actions">
            <button type="button" className="templates__btn" onClick={startNewCustom}>
              New custom
            </button>
          </div>
        </div>

        <div className="templates__grid">
          <div className="templates__list" role="list">
            {filtered.length === 0 ? (
              <div className="templates__empty">No templates match your filters.</div>
            ) : (
              filtered.map((t) => (
                <div key={t.id} className={`templates__row ${t.id === selectedId ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="templates__item"
                    onClick={() => {
                      setSelectedId(t.id);
                      setError("");
                      setDraft(null);
                    }}
                  >
                    <div className="templates__item-title">{t.title}</div>
                    <div className="templates__item-meta">
                      {categoryLabel(t.category)} • {t.source === "builtin" ? "Built-in" : "Custom"}
                    </div>
                  </button>
                  <button type="button" className="templates__item-run" onClick={() => runFromList(t)}>
                    Run
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="templates__detail">
            {!selected ? (
              <div className="templates__empty">Select a template.</div>
            ) : (
              <>
                <div className="templates__detail-top">
                  <div className="templates__detail-title">{selected.title}</div>
                  <div className="templates__detail-actions">
                    <button type="button" className="templates__btn templates__btn--primary" onClick={() => runTemplate(selected)}>
                      Run
                    </button>
                    {selected.source === "builtin" ? (
                      <button type="button" className="templates__btn" onClick={duplicateToCustom}>
                        Duplicate
                      </button>
                    ) : null}
                    {canEditSelected ? (
                      <>
                        <button
                          type="button"
                          className="templates__btn"
                          onClick={() => {
                            setDraft({ ...selected });
                            setError("");
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="templates__btn templates__btn--danger" onClick={deleteCustom}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {error ? <div className="templates__error">{error}</div> : null}

                {isEditingCustom ? (
                  <div className="templates__editor">
                    <label className="templates__field templates__field--grow">
                      <span className="templates__label">Title</span>
                      <input
                        value={draft.title || ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                      />
                    </label>
                    <label className="templates__field">
                      <span className="templates__label">Category</span>
                      <select
                        value={draft.category || "explanation"}
                        onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                      >
                        {PROMPT_TEMPLATE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {categoryLabel(c)}
                          </option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                    </label>

                    <label className="templates__field templates__field--grow">
                      <span className="templates__label">Body</span>
                      <textarea
                        value={draft.body || ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
                        rows={10}
                      />
                    </label>

                    <div className="templates__detail-actions">
                      <button type="button" className="templates__btn templates__btn--primary" onClick={saveDraft}>
                        Save
                      </button>
                      <button type="button" className="templates__btn" onClick={() => setDraft(null)}>
                        Cancel
                      </button>
                    </div>
                    <div className="templates__hint">
                      Use placeholders like <code>{"{{code}}"}</code>, <code>{"{{problemTitle}}"}</code>,{" "}
                      <code>{"{{problemDescription}}"}</code>, <code>{"{{problemSignature}}"}</code>,{" "}
                      <code>{"{{difficulty}}"}</code>, <code>{"{{hints}}"}</code>.
                    </div>
                  </div>
                ) : null}

                {variableKeys.length ? (
                  <div className="templates__vars">
                    <div className="templates__vars-title">Variables</div>
                    <div className="templates__vars-grid">
                      {variableKeys.map((k) => (
                        <label key={k} className="templates__field templates__field--grow">
                          <span className="templates__label">{k}</span>
                          {k === "code" || k.toLowerCase().includes("description") || k === "hints" ? (
                            <textarea
                              value={vars?.[k] ?? ""}
                              onChange={(e) => setVars((prev) => ({ ...(prev || {}), [k]: e.target.value }))}
                              rows={k === "code" ? 6 : 3}
                            />
                          ) : (
                            <input
                              value={vars?.[k] ?? ""}
                              onChange={(e) => setVars((prev) => ({ ...(prev || {}), [k]: e.target.value }))}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="templates__preview">
                  <div className="templates__preview-title">Preview</div>
                  <pre className="templates__pre">{preview}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}


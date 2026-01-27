import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  TEMPLATE_CATEGORIES,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplates,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  getFavorites,
  toggleFavorite,
  getFavoriteTemplates,
  getRecentTemplates,
  addToRecent,
  preparePrompt,
  cloneTemplate,
  exportTemplates,
  importTemplates,
} from "../services/promptTemplatesService.js";

function PromptTemplatesPanel({ onClose, onExecutePrompt, currentCode = "" }) {
  // State
  const [activeTab, setActiveTab] = useState("browse"); // browse, create, favorites, recent
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [variableValues, setVariableValues] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [favorites, setFavorites] = useState(() => getFavorites());
  
  // Create/Edit state
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    prompt: "",
    variables: [],
    tags: []
  });
  const [newVariableInput, setNewVariableInput] = useState({ name: "", label: "", placeholder: "", required: false });
  const [newTagInput, setNewTagInput] = useState("");
  
  // Import/Export state
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState(null);
  
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);

  // Get templates based on current view
  const templates = useMemo(() => {
    if (searchQuery.trim()) {
      return searchTemplates(searchQuery);
    }
    if (selectedCategory) {
      return getTemplatesByCategory(selectedCategory);
    }
    return getAllTemplates();
  }, [searchQuery, selectedCategory]);

  const recentTemplates = useMemo(() => getRecentTemplates(), []);
  const favoriteTemplates = useMemo(() => getFavoriteTemplates(), [favorites]);
  const customTemplates = useMemo(() => getCustomTemplates(), []);

  // Auto-fill code variable when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      const initialValues = {};
      for (const variable of selectedTemplate.variables || []) {
        if (variable.autoFill === "code" && currentCode) {
          initialValues[variable.name] = currentCode;
        } else if (variable.default) {
          initialValues[variable.name] = variable.default;
        }
      }
      setVariableValues(initialValues);
      setValidationErrors([]);
    }
  }, [selectedTemplate, currentCode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (selectedTemplate) {
          setSelectedTemplate(null);
        } else if (isCreating) {
          setIsCreating(false);
          setEditingTemplate(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedTemplate, isCreating]);

  // Handle variable input change
  const handleVariableChange = useCallback((variableName, value) => {
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }));
    // Clear validation error for this field
    setValidationErrors(prev => prev.filter(e => e.variable !== variableName));
  }, []);

  // Handle template selection
  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    addToRecent(template.id);
  }, []);

  // Handle prompt execution
  const handleExecutePrompt = useCallback(() => {
    if (!selectedTemplate) return;

    const result = preparePrompt(selectedTemplate, variableValues);
    
    if (!result.success) {
      setValidationErrors(result.errors);
      return;
    }

    // Execute the prompt
    onExecutePrompt(result.prompt);
    
    // Close the panel
    onClose();
  }, [selectedTemplate, variableValues, onExecutePrompt, onClose]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback((templateId, e) => {
    e?.stopPropagation();
    const newFavorites = toggleFavorite(templateId);
    setFavorites(newFavorites);
  }, []);

  // Handle template clone
  const handleCloneTemplate = useCallback((templateId, e) => {
    e?.stopPropagation();
    const cloned = cloneTemplate(templateId);
    if (cloned) {
      setNewTemplate(cloned);
      setIsCreating(true);
      setActiveTab("create");
    }
  }, []);

  // Handle delete custom template
  const handleDeleteTemplate = useCallback((templateId, e) => {
    e?.stopPropagation();
    if (window.confirm("Are you sure you want to delete this template?")) {
      deleteCustomTemplate(templateId);
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    }
  }, [selectedTemplate]);

  // Handle edit template
  const handleEditTemplate = useCallback((template, e) => {
    e?.stopPropagation();
    setEditingTemplate(template);
    setNewTemplate({
      id: template.id,
      name: template.name,
      description: template.description || "",
      prompt: template.prompt,
      variables: template.variables || [],
      tags: template.tags || []
    });
    setIsCreating(true);
    setActiveTab("create");
  }, []);

  // Handle save template
  const handleSaveTemplate = useCallback(() => {
    if (!newTemplate.name.trim() || !newTemplate.prompt.trim()) {
      return;
    }

    const templateToSave = {
      ...newTemplate,
      id: editingTemplate?.id
    };

    saveCustomTemplate(templateToSave);
    
    setNewTemplate({
      name: "",
      description: "",
      prompt: "",
      variables: [],
      tags: []
    });
    setEditingTemplate(null);
    setIsCreating(false);
    setActiveTab("browse");
    setSelectedCategory("custom");
  }, [newTemplate, editingTemplate]);

  // Handle add variable to new template
  const handleAddVariable = useCallback(() => {
    if (!newVariableInput.name.trim() || !newVariableInput.label.trim()) return;
    
    setNewTemplate(prev => ({
      ...prev,
      variables: [...prev.variables, { ...newVariableInput }]
    }));
    setNewVariableInput({ name: "", label: "", placeholder: "", required: false });
  }, [newVariableInput]);

  // Handle remove variable
  const handleRemoveVariable = useCallback((index) => {
    setNewTemplate(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  }, []);

  // Handle add tag
  const handleAddTag = useCallback(() => {
    if (!newTagInput.trim()) return;
    
    setNewTemplate(prev => ({
      ...prev,
      tags: [...prev.tags, newTagInput.trim().toLowerCase()]
    }));
    setNewTagInput("");
  }, [newTagInput]);

  // Handle remove tag
  const handleRemoveTag = useCallback((index) => {
    setNewTemplate(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    const data = exportTemplates();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-templates-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Handle import
  const handleImport = useCallback(() => {
    setImportError(null);
    
    try {
      const data = JSON.parse(importText);
      const result = importTemplates(data);
      
      if (result.success) {
        setImportText("");
        setShowImportExport(false);
        setSelectedCategory("custom");
      } else {
        setImportError(result.error);
      }
    } catch (e) {
      setImportError("Invalid JSON format");
    }
  }, [importText]);

  // Copy prompt to clipboard
  const handleCopyPrompt = useCallback(() => {
    if (!selectedTemplate) return;
    
    const result = preparePrompt(selectedTemplate, variableValues);
    if (result.success) {
      navigator.clipboard.writeText(result.prompt);
    }
  }, [selectedTemplate, variableValues]);

  // Render category list
  const renderCategories = () => (
    <div className="templates-categories">
      <button
        type="button"
        className={`templates-category ${!selectedCategory ? "templates-category--active" : ""}`}
        onClick={() => setSelectedCategory(null)}
      >
        <span className="templates-category__icon">📋</span>
        <span className="templates-category__name">All Templates</span>
        <span className="templates-category__count">{getAllTemplates().length}</span>
      </button>
      {Object.values(TEMPLATE_CATEGORIES).map(category => (
        <button
          key={category.id}
          type="button"
          className={`templates-category ${selectedCategory === category.id ? "templates-category--active" : ""}`}
          onClick={() => setSelectedCategory(category.id)}
        >
          <span className="templates-category__icon">{category.icon}</span>
          <span className="templates-category__name">{category.name}</span>
          <span className="templates-category__count">
            {getTemplatesByCategory(category.id).length}
          </span>
        </button>
      ))}
    </div>
  );

  // Render template list
  const renderTemplateList = (templateList, showCategory = true) => (
    <div className="templates-list">
      {templateList.length === 0 ? (
        <div className="templates-empty">
          <span className="templates-empty__icon">📭</span>
          <p>No templates found</p>
          {searchQuery && (
            <button
              type="button"
              className="templates-empty__clear"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        templateList.map(template => {
          const isFavorite = favorites.includes(template.id);
          const category = TEMPLATE_CATEGORIES[template.category];
          
          return (
            <button
              key={template.id}
              type="button"
              className={`templates-item ${selectedTemplate?.id === template.id ? "templates-item--selected" : ""}`}
              onClick={() => handleSelectTemplate(template)}
            >
              <div className="templates-item__header">
                <span className="templates-item__name">{template.name}</span>
                <div className="templates-item__actions">
                  <button
                    type="button"
                    className={`templates-item__favorite ${isFavorite ? "templates-item__favorite--active" : ""}`}
                    onClick={(e) => handleToggleFavorite(template.id, e)}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    className="templates-item__clone"
                    onClick={(e) => handleCloneTemplate(template.id, e)}
                    aria-label="Clone template"
                    title="Clone as custom template"
                  >
                    📋
                  </button>
                  {template.isCustom && (
                    <>
                      <button
                        type="button"
                        className="templates-item__edit"
                        onClick={(e) => handleEditTemplate(template, e)}
                        aria-label="Edit template"
                        title="Edit template"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="templates-item__delete"
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        aria-label="Delete template"
                        title="Delete template"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="templates-item__description">{template.description}</p>
              <div className="templates-item__footer">
                {showCategory && category && (
                  <span className="templates-item__category">
                    {category.icon} {category.name}
                  </span>
                )}
                {template.tags?.length > 0 && (
                  <div className="templates-item__tags">
                    {template.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="templates-item__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  // Render template detail view
  const renderTemplateDetail = () => {
    if (!selectedTemplate) return null;

    const result = preparePrompt(selectedTemplate, variableValues);

    return (
      <div className="templates-detail">
        <button
          type="button"
          className="templates-detail__back"
          onClick={() => setSelectedTemplate(null)}
        >
          ← Back to templates
        </button>

        <div className="templates-detail__header">
          <h3 className="templates-detail__title">
            {TEMPLATE_CATEGORIES[selectedTemplate.category]?.icon} {selectedTemplate.name}
          </h3>
          <p className="templates-detail__description">{selectedTemplate.description}</p>
        </div>

        {/* Variable Inputs */}
        {selectedTemplate.variables?.length > 0 && (
          <div className="templates-detail__variables">
            <h4 className="templates-detail__section-title">Fill in the details</h4>
            {selectedTemplate.variables.map(variable => (
              <div key={variable.name} className="templates-variable">
                <label htmlFor={`var-${variable.name}`} className="templates-variable__label">
                  {variable.label}
                  {variable.required && <span className="templates-variable__required">*</span>}
                </label>
                {variable.autoFill === "code" ? (
                  <textarea
                    id={`var-${variable.name}`}
                    className={`templates-variable__input templates-variable__input--code ${
                      validationErrors.some(e => e.variable === variable.name) ? "templates-variable__input--error" : ""
                    }`}
                    placeholder={variable.placeholder}
                    value={variableValues[variable.name] || ""}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    rows={6}
                  />
                ) : (
                  <input
                    id={`var-${variable.name}`}
                    type="text"
                    className={`templates-variable__input ${
                      validationErrors.some(e => e.variable === variable.name) ? "templates-variable__input--error" : ""
                    }`}
                    placeholder={variable.placeholder}
                    value={variableValues[variable.name] || ""}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                  />
                )}
                {validationErrors.find(e => e.variable === variable.name) && (
                  <span className="templates-variable__error">
                    {validationErrors.find(e => e.variable === variable.name).message}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        <div className="templates-detail__preview">
          <div className="templates-detail__preview-header">
            <h4 className="templates-detail__section-title">Preview</h4>
            <button
              type="button"
              className="templates-detail__copy"
              onClick={handleCopyPrompt}
              disabled={!result.success}
            >
              📋 Copy
            </button>
          </div>
          <pre className="templates-detail__prompt">
            {result.success ? result.prompt : selectedTemplate.prompt}
          </pre>
        </div>

        {/* Actions */}
        <div className="templates-detail__actions">
          <button
            type="button"
            className="templates-detail__execute"
            onClick={handleExecutePrompt}
          >
            <span className="templates-detail__execute-icon">▶</span>
            Execute Prompt
          </button>
        </div>
      </div>
    );
  };

  // Render create/edit form
  const renderCreateForm = () => (
    <div className="templates-create">
      <h3 className="templates-create__title">
        {editingTemplate ? "Edit Template" : "Create Custom Template"}
      </h3>

      <div className="templates-create__field">
        <label htmlFor="template-name">Template Name *</label>
        <input
          id="template-name"
          type="text"
          placeholder="e.g., Review My Function"
          value={newTemplate.name}
          onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      <div className="templates-create__field">
        <label htmlFor="template-description">Description</label>
        <input
          id="template-description"
          type="text"
          placeholder="Brief description of what this template does"
          value={newTemplate.description}
          onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div className="templates-create__field">
        <label htmlFor="template-prompt">Prompt Template *</label>
        <textarea
          id="template-prompt"
          placeholder="Your prompt text. Use {{variableName}} for variables."
          value={newTemplate.prompt}
          onChange={(e) => setNewTemplate(prev => ({ ...prev, prompt: e.target.value }))}
          rows={8}
        />
        <p className="templates-create__hint">
          Use {"{{variableName}}"} syntax for variables that will be filled in when using the template.
        </p>
      </div>

      {/* Variables */}
      <div className="templates-create__section">
        <h4>Variables</h4>
        
        {newTemplate.variables.length > 0 && (
          <div className="templates-create__variables-list">
            {newTemplate.variables.map((variable, index) => (
              <div key={index} className="templates-create__variable-item">
                <span className="templates-create__variable-name">
                  {"{{"}{variable.name}{"}}"}
                </span>
                <span className="templates-create__variable-label">{variable.label}</span>
                {variable.required && <span className="templates-create__variable-required">Required</span>}
                <button
                  type="button"
                  className="templates-create__variable-remove"
                  onClick={() => handleRemoveVariable(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="templates-create__add-variable">
          <input
            type="text"
            placeholder="Variable name (no spaces)"
            value={newVariableInput.name}
            onChange={(e) => setNewVariableInput(prev => ({ 
              ...prev, 
              name: e.target.value.replace(/\s/g, '') 
            }))}
          />
          <input
            type="text"
            placeholder="Label"
            value={newVariableInput.label}
            onChange={(e) => setNewVariableInput(prev => ({ ...prev, label: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Placeholder text"
            value={newVariableInput.placeholder}
            onChange={(e) => setNewVariableInput(prev => ({ ...prev, placeholder: e.target.value }))}
          />
          <label className="templates-create__checkbox">
            <input
              type="checkbox"
              checked={newVariableInput.required}
              onChange={(e) => setNewVariableInput(prev => ({ ...prev, required: e.target.checked }))}
            />
            Required
          </label>
          <button
            type="button"
            className="templates-create__add-btn"
            onClick={handleAddVariable}
            disabled={!newVariableInput.name.trim() || !newVariableInput.label.trim()}
          >
            Add Variable
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="templates-create__section">
        <h4>Tags</h4>
        
        {newTemplate.tags.length > 0 && (
          <div className="templates-create__tags-list">
            {newTemplate.tags.map((tag, index) => (
              <span key={index} className="templates-create__tag">
                {tag}
                <button
                  type="button"
                  className="templates-create__tag-remove"
                  onClick={() => handleRemoveTag(index)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="templates-create__add-tag">
          <input
            type="text"
            placeholder="Add a tag"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <button
            type="button"
            className="templates-create__add-btn"
            onClick={handleAddTag}
            disabled={!newTagInput.trim()}
          >
            Add Tag
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="templates-create__actions">
        <button
          type="button"
          className="templates-create__cancel"
          onClick={() => {
            setIsCreating(false);
            setEditingTemplate(null);
            setNewTemplate({
              name: "",
              description: "",
              prompt: "",
              variables: [],
              tags: []
            });
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="templates-create__save"
          onClick={handleSaveTemplate}
          disabled={!newTemplate.name.trim() || !newTemplate.prompt.trim()}
        >
          {editingTemplate ? "Update Template" : "Save Template"}
        </button>
      </div>
    </div>
  );

  // Render import/export panel
  const renderImportExport = () => (
    <div className="templates-import-export">
      <h3 className="templates-import-export__title">Import / Export Templates</h3>
      
      <div className="templates-import-export__section">
        <h4>Export</h4>
        <p>Download all your custom templates as a JSON file.</p>
        <button
          type="button"
          className="templates-import-export__btn"
          onClick={handleExport}
          disabled={customTemplates.length === 0}
        >
          📥 Export Templates ({customTemplates.length})
        </button>
      </div>

      <div className="templates-import-export__section">
        <h4>Import</h4>
        <p>Paste JSON data to import templates.</p>
        <textarea
          className="templates-import-export__input"
          placeholder="Paste JSON here..."
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
        />
        {importError && (
          <p className="templates-import-export__error">{importError}</p>
        )}
        <button
          type="button"
          className="templates-import-export__btn"
          onClick={handleImport}
          disabled={!importText.trim()}
        >
          📤 Import Templates
        </button>
      </div>

      <button
        type="button"
        className="templates-import-export__close"
        onClick={() => setShowImportExport(false)}
      >
        Close
      </button>
    </div>
  );

  return (
    <div className="templates-overlay" role="dialog" aria-modal="true" aria-labelledby="templates-title">
      <div className="templates-backdrop" onClick={onClose} />
      <div className="templates-panel" ref={panelRef}>
        {/* Header */}
        <div className="templates-panel__header">
          <div className="templates-panel__title-section">
            <h2 id="templates-title" className="templates-panel__title">
              <span className="templates-panel__icon">📝</span>
              AI Prompt Templates
            </h2>
            <p className="templates-panel__subtitle">
              Pre-built prompts for common coding tasks
            </p>
          </div>
          <button
            type="button"
            className="templates-panel__close"
            onClick={onClose}
            aria-label="Close templates"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="templates-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "browse"}
            className={`templates-tab ${activeTab === "browse" ? "templates-tab--active" : ""}`}
            onClick={() => { setActiveTab("browse"); setIsCreating(false); }}
          >
            <span className="templates-tab__icon">📋</span>
            Browse
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "favorites"}
            className={`templates-tab ${activeTab === "favorites" ? "templates-tab--active" : ""}`}
            onClick={() => { setActiveTab("favorites"); setIsCreating(false); }}
          >
            <span className="templates-tab__icon">⭐</span>
            Favorites ({favoriteTemplates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recent"}
            className={`templates-tab ${activeTab === "recent" ? "templates-tab--active" : ""}`}
            onClick={() => { setActiveTab("recent"); setIsCreating(false); }}
          >
            <span className="templates-tab__icon">🕐</span>
            Recent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "create"}
            className={`templates-tab ${activeTab === "create" ? "templates-tab--active" : ""}`}
            onClick={() => { setActiveTab("create"); setIsCreating(true); }}
          >
            <span className="templates-tab__icon">➕</span>
            Create
          </button>
        </div>

        {/* Main Content */}
        <div className="templates-panel__content">
          {showImportExport ? (
            renderImportExport()
          ) : isCreating || activeTab === "create" ? (
            renderCreateForm()
          ) : selectedTemplate ? (
            renderTemplateDetail()
          ) : (
            <div className="templates-browse">
              {/* Search */}
              <div className="templates-search">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="templates-search__input"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="templates-search__clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {activeTab === "browse" && (
                <div className="templates-browse__layout">
                  {/* Categories sidebar */}
                  <div className="templates-browse__sidebar">
                    {renderCategories()}
                    
                    <button
                      type="button"
                      className="templates-import-export-btn"
                      onClick={() => setShowImportExport(true)}
                    >
                      📦 Import/Export
                    </button>
                  </div>

                  {/* Template list */}
                  <div className="templates-browse__main">
                    <div className="templates-browse__header">
                      <h3 className="templates-browse__title">
                        {selectedCategory 
                          ? `${TEMPLATE_CATEGORIES[selectedCategory]?.icon} ${TEMPLATE_CATEGORIES[selectedCategory]?.name}`
                          : "All Templates"
                        }
                      </h3>
                      <span className="templates-browse__count">
                        {templates.length} template{templates.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {renderTemplateList(templates, !selectedCategory)}
                  </div>
                </div>
              )}

              {activeTab === "favorites" && (
                <div className="templates-favorites">
                  <div className="templates-browse__header">
                    <h3 className="templates-browse__title">⭐ Favorite Templates</h3>
                    <span className="templates-browse__count">
                      {favoriteTemplates.length} template{favoriteTemplates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {favoriteTemplates.length === 0 ? (
                    <div className="templates-empty">
                      <span className="templates-empty__icon">⭐</span>
                      <p>No favorites yet</p>
                      <p className="templates-empty__hint">
                        Click the star icon on any template to add it to favorites
                      </p>
                    </div>
                  ) : (
                    renderTemplateList(favoriteTemplates)
                  )}
                </div>
              )}

              {activeTab === "recent" && (
                <div className="templates-recent">
                  <div className="templates-browse__header">
                    <h3 className="templates-browse__title">🕐 Recently Used</h3>
                    <span className="templates-browse__count">
                      {recentTemplates.length} template{recentTemplates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {recentTemplates.length === 0 ? (
                    <div className="templates-empty">
                      <span className="templates-empty__icon">🕐</span>
                      <p>No recent templates</p>
                      <p className="templates-empty__hint">
                        Templates you use will appear here
                      </p>
                    </div>
                  ) : (
                    renderTemplateList(recentTemplates)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PromptTemplatesPanel);

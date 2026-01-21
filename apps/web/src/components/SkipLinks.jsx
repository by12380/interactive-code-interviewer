import { memo } from "react";

/**
 * Skip links for keyboard/screen reader navigation
 * These allow users to skip directly to main content areas
 */
function SkipLinks() {
  return (
    <nav className="skip-links" aria-label="Skip navigation">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#editor-panel" className="skip-link">
        Skip to code editor
      </a>
      <a href="#chat-panel" className="skip-link">
        Skip to AI chat
      </a>
      <a href="#problem-panel" className="skip-link">
        Skip to problem description
      </a>
    </nav>
  );
}

export default memo(SkipLinks);

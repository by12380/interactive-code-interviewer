import { memo, useState, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useFocusMode } from "../contexts/FocusModeContext.jsx";
import { calculateLevel, getLevelProgress } from "../services/gamificationService.js";

function Sidebar({
  user,
  activeScreen,
  onNavigate,
  onOpenInterviewHub,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  problemSelector,
}) {
  const { theme, toggleTheme } = useTheme();
  const { settings: focusSettings } = useFocusMode();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Gamification data
  const gamification = user?.gamification;
  const xp = gamification?.xp || 0;
  const level = useMemo(() => calculateLevel(xp), [xp]);
  const levelProgress = useMemo(() => getLevelProgress(xp), [xp]);
  const streak = gamification?.streak?.current || 0;
  const displayName = user?.username || user?.displayName || "User";

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const toggleUserMenu = useCallback(() => {
    setIsUserMenuOpen(prev => !prev);
  }, []);

  const handleProfileClick = useCallback(() => {
    setIsUserMenuOpen(false);
    onOpenProfile();
  }, [onOpenProfile]);

  const handleLogoutClick = useCallback(() => {
    setIsUserMenuOpen(false);
    onLogout();
  }, [onLogout]);

  const handleNav = useCallback((screen) => {
    onNavigate(screen);
  }, [onNavigate]);

  return (
    <aside 
      className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}
      aria-label="Main navigation"
    >
      {/* Logo/Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo" onClick={() => handleNav("practice")} role="button" tabIndex={0}>
          <span className="sidebar__logo-icon">&#x1F4BB;</span>
          {!isCollapsed && <span className="sidebar__logo-text">AI Practice Hub</span>}
        </div>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="sidebar__toggle-icon">{isCollapsed ? '\u2192' : '\u2190'}</span>
        </button>
      </div>

      <div className="sidebar__content">
        {/* User Section */}
        <div className="sidebar__user-section">
            {user ? (
              <>
                <button
                  type="button"
                  className="sidebar__user-btn"
                  onClick={toggleUserMenu}
                  aria-expanded={isUserMenuOpen}
                  aria-label={`User menu for ${displayName}`}
                >
                  <span className="sidebar__avatar">
                    {displayName.charAt(0).toUpperCase() || "U"}
                  </span>
                  {!isCollapsed && (
                    <div className="sidebar__user-info">
                      <span className="sidebar__username">{displayName}</span>
                      <span className="sidebar__user-level">Level {level}</span>
                    </div>
                  )}
                </button>
                
                {/* User dropdown menu */}
                {isUserMenuOpen && !isCollapsed && (
                  <div className="sidebar__user-menu">
                    <button
                      type="button"
                      className="sidebar__user-menu-item"
                      onClick={handleProfileClick}
                    >
                      <span className="sidebar__menu-icon">&#x1F464;</span>
                      View Profile
                    </button>
                    <button
                      type="button"
                      className="sidebar__user-menu-item sidebar__user-menu-item--danger"
                      onClick={handleLogoutClick}
                    >
                      <span className="sidebar__menu-icon">&#x1F6AA;</span>
                      Sign Out
                    </button>
                  </div>
                )}

                {/* XP Progress Bar */}
                {!isCollapsed && (
                  <button
                    type="button"
                    className="sidebar__xp-section"
                    onClick={() => handleNav("achievements")}
                    aria-label={`${xp} XP, click to view progress`}
                  >
                    <div className="sidebar__xp-header">
                      <span className="sidebar__xp-label">XP Progress</span>
                      <span className="sidebar__xp-value">{xp} XP</span>
                    </div>
                    <div className="sidebar__xp-bar">
                      <div 
                        className="sidebar__xp-fill"
                        style={{ width: `${levelProgress}%` }}
                      />
                    </div>
                  </button>
                )}

                {/* Streak */}
                <button
                  type="button"
                  className={`sidebar__streak ${streak > 0 ? 'sidebar__streak--active' : ''}`}
                  onClick={() => handleNav("achievements")}
                  aria-label={`${streak} day streak`}
                >
                  <span className="sidebar__streak-icon">&#x1F525;</span>
                  {!isCollapsed && (
                    <span className="sidebar__streak-text">
                      {streak > 0 ? `${streak} Day Streak` : 'Start a streak!'}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <div className="sidebar__guest">
                {!isCollapsed && (
                  <p className="sidebar__guest-hint">Sign in to track your progress</p>
                )}
                <button
                  type="button"
                  className="sidebar__login-btn"
                  onClick={onOpenAuth}
                >
                  <span className="sidebar__login-icon">&#x1F511;</span>
                  {!isCollapsed && <span>Sign In</span>}
                </button>
              </div>
            )}
        </div>

        {/* Problem selector - only on practice screen */}
        {!isCollapsed && activeScreen === "practice" && (
          <div className="sidebar__problem-selector">
            <span className="sidebar__section-label">Current Practice Problem</span>
            {problemSelector}
          </div>
        )}

        {/* Navigation Items */}
        <nav className="sidebar__nav">
            <span className="sidebar__section-label">
              {!isCollapsed && 'Navigation'}
            </span>

          <button
            type="button"
            className={`sidebar__nav-item ${activeScreen === "practice" ? "sidebar__nav-item--active" : ""}`}
            onClick={() => handleNav("practice")}
            aria-label="Practice workspace"
            aria-current={activeScreen === "practice" ? "page" : undefined}
          >
            <span className="sidebar__nav-icon">&#x1F4BB;</span>
            {!isCollapsed && <span className="sidebar__nav-text">Practice</span>}
          </button>

          <button
            type="button"
            className="sidebar__nav-item"
            onClick={onOpenInterviewHub}
            aria-label="Open interview session hub"
          >
            <span className="sidebar__nav-icon">&#x1F517;</span>
            {!isCollapsed && <span className="sidebar__nav-text">Interview Hub</span>}
          </button>

          <button
            type="button"
            className={`sidebar__nav-item ${activeScreen === "leaderboard" ? "sidebar__nav-item--active" : ""}`}
            onClick={() => handleNav("leaderboard")}
            aria-label="View leaderboard"
            aria-current={activeScreen === "leaderboard" ? "page" : undefined}
          >
            <span className="sidebar__nav-icon">&#x1F3C6;</span>
            {!isCollapsed && <span className="sidebar__nav-text">Leaderboard</span>}
          </button>

          {user && (
            <button
              type="button"
              className={`sidebar__nav-item ${activeScreen === "achievements" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => handleNav("achievements")}
              aria-label="View achievements"
              aria-current={activeScreen === "achievements" ? "page" : undefined}
            >
              <span className="sidebar__nav-icon">&#x1F3AE;</span>
              {!isCollapsed && <span className="sidebar__nav-text">Achievements</span>}
            </button>
          )}

          {user && (
            <button
              type="button"
              className={`sidebar__nav-item ${activeScreen === "roadmap" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => handleNav("roadmap")}
              aria-label="Open prep roadmap"
              aria-current={activeScreen === "roadmap" ? "page" : undefined}
            >
              <span className="sidebar__nav-icon">&#x1F5FA;&#xFE0F;</span>
              {!isCollapsed && <span className="sidebar__nav-text">Prep Roadmap</span>}
            </button>
          )}

          {/* Focus Mode indicator */}
          {focusSettings.isEnabled && (
            <div className="sidebar__focus-indicator">
              <span className="sidebar__nav-icon">&#x1F3AF;</span>
              {!isCollapsed && (
                <span className="sidebar__focus-text">
                  Focus Mode <span className="sidebar__nav-badge">ON</span>
                </span>
              )}
            </div>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="sidebar__bottom">
            <button
              type="button"
              className="sidebar__nav-item"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className="sidebar__nav-icon">{theme === 'light' ? '\u{1F319}' : '\u2600\uFE0F'}</span>
              {!isCollapsed && (
                <span className="sidebar__nav-text">
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`sidebar__nav-item ${activeScreen === "settings" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => handleNav("settings")}
              aria-label="Settings"
              aria-current={activeScreen === "settings" ? "page" : undefined}
            >
              <span className="sidebar__nav-icon">&#x2699;&#xFE0F;</span>
              {!isCollapsed && <span className="sidebar__nav-text">Settings</span>}
            </button>

            {user && (
              <button
                type="button"
                className="sidebar__nav-item sidebar__user-menu-item--danger"
                onClick={handleLogoutClick}
                aria-label="Sign out"
              >
                <span className="sidebar__nav-icon">&#x1F6AA;</span>
                {!isCollapsed && <span className="sidebar__nav-text">Logout</span>}
              </button>
            )}
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);

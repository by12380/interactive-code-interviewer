import { memo, useState, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { calculateLevel, getLevelProgress } from "../services/gamificationService.js";

function Sidebar({
  user,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  onOpenLeaderboard,
  onStartInterviewSim,
  onOpenGamification,
  onOpenRoadmap,
  onStartTutorial,
  onOpenTranslator,
  onOpenTemplates,
  problemSelector,
}) {
  const { theme, toggleTheme, openSettings } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Gamification data
  const gamification = user?.gamification;
  const xp = gamification?.xp || 0;
  const level = useMemo(() => calculateLevel(xp), [xp]);
  const levelProgress = useMemo(() => getLevelProgress(xp), [xp]);
  const streak = gamification?.streak?.current || 0;

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

  return (
    <aside 
      className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}
      aria-label="Main navigation"
    >
      {/* Logo/Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <span className="sidebar__logo-icon">💻</span>
          {!isCollapsed && <span className="sidebar__logo-text">AI Interviewer</span>}
        </div>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="sidebar__toggle-icon">{isCollapsed ? '→' : '←'}</span>
        </button>
      </div>

      {/* User Section */}
      <div className="sidebar__user-section">
        {user ? (
          <>
            <button
              type="button"
              className="sidebar__user-btn"
              onClick={toggleUserMenu}
              aria-expanded={isUserMenuOpen}
              aria-label={`User menu for ${user.username}`}
            >
              <span className="sidebar__avatar">
                {user.username?.charAt(0).toUpperCase() || "U"}
              </span>
              {!isCollapsed && (
                <div className="sidebar__user-info">
                  <span className="sidebar__username">{user.username}</span>
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
                  <span className="sidebar__menu-icon">👤</span>
                  View Profile
                </button>
                <button
                  type="button"
                  className="sidebar__user-menu-item sidebar__user-menu-item--danger"
                  onClick={handleLogoutClick}
                >
                  <span className="sidebar__menu-icon">🚪</span>
                  Sign Out
                </button>
              </div>
            )}

            {/* XP Progress Bar */}
            {!isCollapsed && (
              <button
                type="button"
                className="sidebar__xp-section"
                onClick={onOpenGamification}
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
              onClick={onOpenGamification}
              aria-label={`${streak} day streak`}
            >
              <span className="sidebar__streak-icon">🔥</span>
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
              <span className="sidebar__login-icon">🔑</span>
              {!isCollapsed && <span>Sign In</span>}
            </button>
          </div>
        )}
      </div>

      {/* Problem Selector */}
      {!isCollapsed && (
        <div className="sidebar__problem-selector">
          <span className="sidebar__section-label">Current Problem</span>
          {problemSelector}
        </div>
      )}

      {/* Navigation Items */}
      <nav className="sidebar__nav">
        <span className="sidebar__section-label">
          {!isCollapsed && 'Quick Actions'}
        </span>
        
        <button
          type="button"
          className="sidebar__nav-item sidebar__nav-item--primary"
          onClick={onStartInterviewSim}
          aria-label="Start mock interview"
        >
          <span className="sidebar__nav-icon">🎯</span>
          {!isCollapsed && <span className="sidebar__nav-text">Mock Interview</span>}
        </button>

        {user && (
          <button
            type="button"
            className="sidebar__nav-item"
            onClick={onOpenRoadmap}
            aria-label="Open prep roadmap"
          >
            <span className="sidebar__nav-icon">🗺️</span>
            {!isCollapsed && <span className="sidebar__nav-text">Prep Roadmap</span>}
          </button>
        )}

        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onOpenLeaderboard}
          aria-label="View leaderboard"
        >
          <span className="sidebar__nav-icon">🏆</span>
          {!isCollapsed && <span className="sidebar__nav-text">Leaderboard</span>}
        </button>

        {user && (
          <button
            type="button"
            className="sidebar__nav-item"
            onClick={onOpenGamification}
            aria-label="View achievements"
          >
            <span className="sidebar__nav-icon">🎮</span>
            {!isCollapsed && <span className="sidebar__nav-text">Achievements</span>}
          </button>
        )}

        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onOpenTranslator}
          aria-label="Code translator"
        >
          <span className="sidebar__nav-icon">🔄</span>
          {!isCollapsed && <span className="sidebar__nav-text">Code Translator</span>}
        </button>

        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onOpenTemplates}
          aria-label="AI Prompt Templates"
        >
          <span className="sidebar__nav-icon">📝</span>
          {!isCollapsed && <span className="sidebar__nav-text">Prompt Templates</span>}
        </button>

        <button
          type="button"
          className="sidebar__nav-item"
          onClick={onStartTutorial}
          aria-label="How it works"
        >
          <span className="sidebar__nav-icon">❓</span>
          {!isCollapsed && <span className="sidebar__nav-text">How It Works</span>}
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="sidebar__bottom">
        <button
          type="button"
          className="sidebar__nav-item"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className="sidebar__nav-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
          {!isCollapsed && (
            <span className="sidebar__nav-text">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </button>

        <button
          type="button"
          className="sidebar__nav-item"
          onClick={openSettings}
          aria-label="Settings"
        >
          <span className="sidebar__nav-icon">⚙️</span>
          {!isCollapsed && <span className="sidebar__nav-text">Settings</span>}
        </button>
      </div>
    </aside>
  );
}

export default memo(Sidebar);

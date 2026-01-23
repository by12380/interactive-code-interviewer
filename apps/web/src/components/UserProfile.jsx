import { memo, useState, useMemo } from "react";
import { formatTime, formatDate } from "../services/userService";
import { 
  getAchievementsWithStatus, 
  calculateLevel, 
  getLevelProgress,
  xpForLevel
} from "../services/gamificationService.js";
import { getReplayByInterviewId } from "../services/codeReplayService.js";

function UserProfile({ 
  user, 
  onClose, 
  problems = [],
  onLogout,
  onOpenReplay, // New prop for opening replay viewer
}) {
  const [activeTab, setActiveTab] = useState("stats");

  const stats = user?.stats || {
    totalInterviews: 0,
    problemsAttempted: [],
    problemsCompleted: [],
    averageScore: 0,
    bestGrade: null,
    totalTimeSpent: 0,
  };

  const gamification = user?.gamification || {};
  const xp = gamification.xp || 0;
  const level = calculateLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const streak = gamification.streak || { current: 0, longest: 0 };

  const achievements = useMemo(
    () => getAchievementsWithStatus(gamification.achievements || []),
    [gamification.achievements]
  );
  const earnedAchievements = achievements.filter(a => a.earned);

  const interviewHistory = user?.interviewHistory || [];
  const personalBests = user?.personalBests || {};

  const problemsWithBests = useMemo(() => {
    return problems.map(problem => ({
      ...problem,
      personalBest: personalBests[problem.id] || null,
      attempted: stats.problemsAttempted.includes(problem.id),
      completed: stats.problemsCompleted.includes(problem.id),
    }));
  }, [problems, personalBests, stats]);

  const gradeColor = (grade) => {
    if (!grade) return "#64748b";
    if (grade.startsWith("A")) return "#22c55e";
    if (grade.startsWith("B")) return "#3b82f6";
    if (grade.startsWith("C")) return "#f59e0b";
    return "#ef4444";
  };

  const difficultyClass = (difficulty) => {
    return `profile__difficulty profile__difficulty--${difficulty?.toLowerCase()}`;
  };

  return (
    <div className="profile-modal">
      <div className="profile-modal__backdrop" onClick={onClose} />
      <div className="profile-modal__content">
        <button 
          className="profile-modal__close" 
          onClick={onClose}
          aria-label="Close profile"
        >
          ×
        </button>

        <div className="profile__header">
          <div className="profile__avatar">
            {user?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="profile__info">
            <h2 className="profile__username">{user?.username || "User"}</h2>
            <p className="profile__email">{user?.email}</p>
            <p className="profile__joined">
              Member since {user?.createdAt ? formatDate(user.createdAt) : "N/A"}
            </p>
          </div>
        </div>

        {/* Level and XP display */}
        <div className="profile__level-section">
          <div className="profile__level-badge">
            <span className="profile__level-number">Lv.{level}</span>
          </div>
          <div className="profile__xp-info">
            <div className="profile__xp-bar">
              <div 
                className="profile__xp-fill"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <span className="profile__xp-text">{xp.toLocaleString()} XP</span>
          </div>
          <div className="profile__streak-badge">
            <span className="profile__streak-icon">🔥</span>
            <span className="profile__streak-value">{streak.current}</span>
          </div>
        </div>

        <div className="profile__tabs">
          <button
            className={`profile__tab ${activeTab === "stats" ? "profile__tab--active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            Statistics
          </button>
          <button
            className={`profile__tab ${activeTab === "achievements" ? "profile__tab--active" : ""}`}
            onClick={() => setActiveTab("achievements")}
          >
            Achievements
          </button>
          <button
            className={`profile__tab ${activeTab === "history" ? "profile__tab--active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
          <button
            className={`profile__tab ${activeTab === "bests" ? "profile__tab--active" : ""}`}
            onClick={() => setActiveTab("bests")}
          >
            Personal Bests
          </button>
        </div>

        <div className="profile__content">
          {activeTab === "stats" && (
            <div className="profile__stats">
              <div className="profile__stat-cards">
                <div className="profile__stat-card">
                  <span className="profile__stat-value">{stats.totalInterviews}</span>
                  <span className="profile__stat-label">Total Interviews</span>
                </div>
                <div className="profile__stat-card">
                  <span className="profile__stat-value">{stats.problemsCompleted.length}</span>
                  <span className="profile__stat-label">Problems Solved</span>
                </div>
                <div className="profile__stat-card">
                  <span className="profile__stat-value">{stats.averageScore || 0}</span>
                  <span className="profile__stat-label">Average Score</span>
                </div>
                <div className="profile__stat-card">
                  <span 
                    className="profile__stat-value" 
                    style={{ color: gradeColor(stats.bestGrade) }}
                  >
                    {stats.bestGrade || "—"}
                  </span>
                  <span className="profile__stat-label">Best Grade</span>
                </div>
              </div>

              <div className="profile__progress-section">
                <h3>Progress Overview</h3>
                <div className="profile__progress-bar">
                  <div 
                    className="profile__progress-fill"
                    style={{ 
                      width: `${problems.length > 0 ? (stats.problemsCompleted.length / problems.length) * 100 : 0}%` 
                    }}
                  />
                </div>
                <p className="profile__progress-text">
                  {stats.problemsCompleted.length} of {problems.length} problems completed
                </p>
              </div>

              <div className="profile__time-section">
                <h3>Time Invested</h3>
                <p className="profile__time-value">
                  {Math.floor(stats.totalTimeSpent / 3600)}h {Math.floor((stats.totalTimeSpent % 3600) / 60)}m
                </p>
                <p className="profile__time-label">Total practice time</p>
              </div>
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="profile__achievements">
              <div className="profile__achievements-summary">
                <span className="profile__achievements-count">
                  {earnedAchievements.length} of {achievements.length} achievements
                </span>
              </div>
              
              {earnedAchievements.length === 0 ? (
                <div className="profile__empty">
                  <p>No achievements yet.</p>
                  <p className="profile__empty-hint">Complete problems to earn achievements!</p>
                </div>
              ) : (
                <div className="profile__achievements-grid">
                  {earnedAchievements.map(achievement => (
                    <div key={achievement.id} className="profile__achievement-card">
                      <span className="profile__achievement-icon">{achievement.icon}</span>
                      <div className="profile__achievement-info">
                        <span className="profile__achievement-name">{achievement.name}</span>
                        <span className="profile__achievement-desc">{achievement.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Locked achievements preview */}
              {achievements.filter(a => !a.earned).length > 0 && (
                <div className="profile__locked-achievements">
                  <h4>Locked Achievements</h4>
                  <div className="profile__locked-grid">
                    {achievements.filter(a => !a.earned).slice(0, 6).map(achievement => (
                      <div key={achievement.id} className="profile__locked-card">
                        <span className="profile__locked-icon">🔒</span>
                        <span className="profile__locked-name">{achievement.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="profile__history">
              {interviewHistory.length === 0 ? (
                <div className="profile__empty">
                  <p>No interview history yet.</p>
                  <p className="profile__empty-hint">Complete an interview to see your results here!</p>
                </div>
              ) : (
                <div className="profile__history-list">
                  {interviewHistory.map((interview) => {
                    const hasReplay = !!getReplayByInterviewId(interview.id);
                    return (
                      <div key={interview.id} className="profile__history-item">
                        <div className="profile__history-main">
                          <span className="profile__history-title">{interview.problemTitle}</span>
                          <span className={difficultyClass(interview.difficulty)}>
                            {interview.difficulty}
                          </span>
                        </div>
                        <div className="profile__history-details">
                          <span className="profile__history-score">
                            Score: <strong>{interview.score}</strong>
                          </span>
                          <span 
                            className="profile__history-grade"
                            style={{ color: gradeColor(interview.grade) }}
                          >
                            {interview.grade}
                          </span>
                          <span className="profile__history-time">
                            {formatTime(interview.timeSpent)}
                          </span>
                          <span className="profile__history-tests">
                            {interview.testsPassed}/{interview.testsTotal} tests
                          </span>
                        </div>
                        <div className="profile__history-actions">
                          <span className="profile__history-date">
                            {formatDate(interview.completedAt)}
                          </span>
                          {hasReplay && onOpenReplay && (
                            <button
                              className="profile__replay-btn"
                              onClick={() => onOpenReplay(interview.id, interview.problemTitle)}
                              title="Watch code replay"
                            >
                              <span className="profile__replay-icon">▶</span>
                              Watch Replay
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "bests" && (
            <div className="profile__bests">
              {problemsWithBests.length === 0 ? (
                <div className="profile__empty">
                  <p>No problems available.</p>
                </div>
              ) : (
                <div className="profile__bests-list">
                  {problemsWithBests.map((problem) => (
                    <div 
                      key={problem.id} 
                      className={`profile__best-item ${problem.completed ? "profile__best-item--completed" : ""}`}
                    >
                      <div className="profile__best-main">
                        <span className="profile__best-title">{problem.title}</span>
                        <span className={difficultyClass(problem.difficulty)}>
                          {problem.difficulty}
                        </span>
                        {problem.completed && (
                          <span className="profile__best-check">✓</span>
                        )}
                      </div>
                      {problem.personalBest ? (
                        <div className="profile__best-details">
                          <span className="profile__best-score">
                            Best: <strong>{problem.personalBest.score}</strong>
                          </span>
                          <span 
                            className="profile__best-grade"
                            style={{ color: gradeColor(problem.personalBest.grade) }}
                          >
                            {problem.personalBest.grade}
                          </span>
                          <span className="profile__best-time">
                            {formatTime(problem.personalBest.time)}
                          </span>
                          <span className="profile__best-date">
                            {formatDate(problem.personalBest.date)}
                          </span>
                        </div>
                      ) : (
                        <div className="profile__best-not-attempted">
                          {problem.attempted ? "Not completed" : "Not attempted"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="profile__footer">
          <button 
            className="profile__logout-btn"
            onClick={onLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(UserProfile);

import { memo, useState, useMemo } from "react";
import { 
  getProblemLeaderboard, 
  getGlobalRankings, 
  formatTime, 
  formatDate,
  getUserRankForProblem,
  getUserGlobalRank
} from "../services/userService";

function Leaderboard({ 
  onClose, 
  problems = [],
  currentUser,
  inline = false
}) {
  const [activeTab, setActiveTab] = useState("global");
  const [selectedProblemId, setSelectedProblemId] = useState(problems[0]?.id || null);

  const globalRankings = useMemo(() => getGlobalRankings(50), []);
  
  const problemLeaderboard = useMemo(() => {
    if (!selectedProblemId) return [];
    return getProblemLeaderboard(selectedProblemId, 50);
  }, [selectedProblemId]);

  const selectedProblem = useMemo(() => {
    return problems.find(p => p.id === selectedProblemId);
  }, [problems, selectedProblemId]);

  const userGlobalRank = useMemo(() => {
    if (!currentUser) return null;
    return getUserGlobalRank(currentUser.id);
  }, [currentUser]);

  const userProblemRank = useMemo(() => {
    if (!currentUser || !selectedProblemId) return null;
    return getUserRankForProblem(selectedProblemId, currentUser.id);
  }, [currentUser, selectedProblemId]);

  const gradeColor = (grade) => {
    if (!grade) return "#64748b";
    if (grade.startsWith("A")) return "#22c55e";
    if (grade.startsWith("B")) return "#3b82f6";
    if (grade.startsWith("C")) return "#f59e0b";
    return "#ef4444";
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const difficultyClass = (difficulty) => {
    return `leaderboard__difficulty leaderboard__difficulty--${difficulty?.toLowerCase()}`;
  };

  const content = (
    <>
      {!inline && (
        <div className="leaderboard__header">
          <h2 className="leaderboard__title">Leaderboard</h2>
          <p className="leaderboard__subtitle">See how you compare with other interviewers</p>
        </div>
      )}

        <div className="leaderboard__tabs">
          <button
            className={`leaderboard__tab ${activeTab === "global" ? "leaderboard__tab--active" : ""}`}
            onClick={() => setActiveTab("global")}
          >
            Global Rankings
          </button>
          <button
            className={`leaderboard__tab ${activeTab === "problem" ? "leaderboard__tab--active" : ""}`}
            onClick={() => setActiveTab("problem")}
          >
            By Problem
          </button>
        </div>

        <div className="leaderboard__content">
          {activeTab === "global" && (
            <div className="leaderboard__global">
              {currentUser && userGlobalRank && (
                <div className="leaderboard__user-rank">
                  <span className="leaderboard__user-rank-label">Your Rank</span>
                  <span className="leaderboard__user-rank-value">
                    {getRankBadge(userGlobalRank)}
                  </span>
                </div>
              )}

              {globalRankings.length === 0 ? (
                <div className="leaderboard__empty">
                  <p>No rankings yet.</p>
                  <p className="leaderboard__empty-hint">
                    Complete interviews to appear on the leaderboard!
                  </p>
                </div>
              ) : (
                <div className="leaderboard__table">
                  <div className="leaderboard__table-header">
                    <span className="leaderboard__col leaderboard__col--rank">Rank</span>
                    <span className="leaderboard__col leaderboard__col--user">User</span>
                    <span className="leaderboard__col leaderboard__col--problems">Problems</span>
                    <span className="leaderboard__col leaderboard__col--avg">Avg Score</span>
                    <span className="leaderboard__col leaderboard__col--total">Total</span>
                  </div>
                  <div className="leaderboard__table-body">
                    {globalRankings.map((entry, index) => (
                      <div 
                        key={entry.userId} 
                        className={`leaderboard__row ${currentUser?.id === entry.userId ? "leaderboard__row--current" : ""}`}
                      >
                        <span className="leaderboard__col leaderboard__col--rank">
                          <span className={`leaderboard__rank-badge ${index < 3 ? "leaderboard__rank-badge--top" : ""}`}>
                            {getRankBadge(index + 1)}
                          </span>
                        </span>
                        <span className="leaderboard__col leaderboard__col--user">
                          <span className="leaderboard__username">{entry.username}</span>
                          {currentUser?.id === entry.userId && (
                            <span className="leaderboard__you-badge">You</span>
                          )}
                        </span>
                        <span className="leaderboard__col leaderboard__col--problems">
                          {entry.problemsSolved}
                        </span>
                        <span className="leaderboard__col leaderboard__col--avg">
                          {entry.avgScore}
                        </span>
                        <span className="leaderboard__col leaderboard__col--total">
                          <strong>{entry.totalScore}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "problem" && (
            <div className="leaderboard__problem">
              <div className="leaderboard__problem-selector">
                <label htmlFor="problem-select">Select Problem</label>
                <select
                  id="problem-select"
                  value={selectedProblemId || ""}
                  onChange={(e) => setSelectedProblemId(e.target.value)}
                >
                  {problems.map(problem => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title} ({problem.difficulty})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProblem && (
                <div className="leaderboard__problem-info">
                  <span className="leaderboard__problem-title">{selectedProblem.title}</span>
                  <span className={difficultyClass(selectedProblem.difficulty)}>
                    {selectedProblem.difficulty}
                  </span>
                  <span className="leaderboard__problem-category">{selectedProblem.category}</span>
                </div>
              )}

              {currentUser && userProblemRank && (
                <div className="leaderboard__user-rank">
                  <span className="leaderboard__user-rank-label">Your Rank</span>
                  <span className="leaderboard__user-rank-value">
                    {getRankBadge(userProblemRank)}
                  </span>
                </div>
              )}

              {problemLeaderboard.length === 0 ? (
                <div className="leaderboard__empty">
                  <p>No submissions for this problem yet.</p>
                  <p className="leaderboard__empty-hint">
                    Be the first to complete it and claim the top spot!
                  </p>
                </div>
              ) : (
                <div className="leaderboard__table">
                  <div className="leaderboard__table-header">
                    <span className="leaderboard__col leaderboard__col--rank">Rank</span>
                    <span className="leaderboard__col leaderboard__col--user">User</span>
                    <span className="leaderboard__col leaderboard__col--score">Score</span>
                    <span className="leaderboard__col leaderboard__col--grade">Grade</span>
                    <span className="leaderboard__col leaderboard__col--time">Time</span>
                  </div>
                  <div className="leaderboard__table-body">
                    {problemLeaderboard.map((entry, index) => (
                      <div 
                        key={entry.userId} 
                        className={`leaderboard__row ${currentUser?.id === entry.userId ? "leaderboard__row--current" : ""}`}
                      >
                        <span className="leaderboard__col leaderboard__col--rank">
                          <span className={`leaderboard__rank-badge ${index < 3 ? "leaderboard__rank-badge--top" : ""}`}>
                            {getRankBadge(index + 1)}
                          </span>
                        </span>
                        <span className="leaderboard__col leaderboard__col--user">
                          <span className="leaderboard__username">{entry.username}</span>
                          {currentUser?.id === entry.userId && (
                            <span className="leaderboard__you-badge">You</span>
                          )}
                        </span>
                        <span className="leaderboard__col leaderboard__col--score">
                          <strong>{entry.score}</strong>
                        </span>
                        <span 
                          className="leaderboard__col leaderboard__col--grade"
                          style={{ color: gradeColor(entry.grade) }}
                        >
                          {entry.grade}
                        </span>
                        <span className="leaderboard__col leaderboard__col--time">
                          {formatTime(entry.time)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      <div className="leaderboard__footer">
        <p>Rankings update when interviews are completed</p>
      </div>
    </>
  );

  if (inline) {
    return <div className="leaderboard-inline">{content}</div>;
  }

  return (
    <div className="leaderboard-modal">
      <div className="leaderboard-modal__backdrop" onClick={onClose} />
      <div className="leaderboard-modal__content">
        <button 
          className="leaderboard-modal__close" 
          onClick={onClose}
          aria-label="Close leaderboard"
        >
          &times;
        </button>
        {content}
      </div>
    </div>
  );
}

export default memo(Leaderboard);

import { useState, useMemo } from "react";
import { getUnlockRequirement } from "../services/gamificationService.js";

export default function ProblemSelector({
  problems,
  currentProblemId,
  onSelectProblem,
  isLocked,
  user
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [hoveredLockedProblem, setHoveredLockedProblem] = useState(null);

  const currentProblem = problems.find(p => p.id === currentProblemId);
  
  const difficulties = ["all", ...new Set(problems.map(p => p.difficulty))];
  const categories = ["all", ...new Set(problems.map(p => p.category))];

  // Get unlocked problems from user gamification
  const unlockedProblems = useMemo(() => {
    return user?.gamification?.unlockedProblems || 
           problems.filter(p => p.difficulty === 'Easy').map(p => p.id);
  }, [user, problems]);

  const problemsCompleted = user?.stats?.problemsCompleted || [];

  const filteredProblems = problems.filter(problem => {
    const matchesDifficulty = filterDifficulty === "all" || problem.difficulty === filterDifficulty;
    const matchesCategory = filterCategory === "all" || problem.category === filterCategory;
    return matchesDifficulty && matchesCategory;
  });

  const isProblemLocked = (problemId) => {
    // If no user, only Easy problems are unlocked
    if (!user) {
      const problem = problems.find(p => p.id === problemId);
      return problem?.difficulty !== 'Easy';
    }
    return !unlockedProblems.includes(problemId);
  };

  const handleSelect = (problemId) => {
    if (isLocked) return;
    
    // Check if problem is locked
    if (isProblemLocked(problemId)) {
      return; // Don't allow selection of locked problems
    }
    
    onSelectProblem(problemId);
    setIsOpen(false);
  };

  const getDifficultyClass = (difficulty) => {
    return `problem-selector__difficulty--${difficulty.toLowerCase()}`;
  };

  return (
    <div className="problem-selector">
      <button
        className="problem-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLocked}
      >
        <span className="problem-selector__current">
          {currentProblem ? (
            <>
              <span className={`problem-selector__dot ${getDifficultyClass(currentProblem.difficulty)}`} />
              {currentProblem.title}
            </>
          ) : (
            "Select Problem"
          )}
        </span>
        <svg
          className={`problem-selector__chevron ${isOpen ? "problem-selector__chevron--open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 5.427a.75.75 0 011.146-.001L8 7.853l2.427-2.427a.75.75 0 111.146 1.001l-3 3a.75.75 0 01-1.146 0l-3-3a.75.75 0 010-1z" />
        </svg>
      </button>

      {isOpen && (
        <div className="problem-selector__dropdown">
          <div className="problem-selector__filters">
            <div className="problem-selector__filter">
              <label>Difficulty:</label>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
              >
                {difficulties.map(d => (
                  <option key={d} value={d}>
                    {d === "all" ? "All Difficulties" : d}
                  </option>
                ))}
              </select>
            </div>
            <div className="problem-selector__filter">
              <label>Category:</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="problem-selector__list">
            {filteredProblems.length === 0 ? (
              <div className="problem-selector__empty">
                No problems match your filters
              </div>
            ) : (
              filteredProblems.map(problem => {
                const isLockedProblem = isProblemLocked(problem.id);
                const isCompleted = problemsCompleted.includes(problem.id);
                const unlockRequirement = isLockedProblem 
                  ? getUnlockRequirement(problem.id, user?.gamification, problemsCompleted)
                  : null;
                
                return (
                  <button
                    key={problem.id}
                    className={`problem-selector__item ${
                      problem.id === currentProblemId ? "problem-selector__item--active" : ""
                    } ${isLockedProblem ? "problem-selector__item--locked" : ""} ${
                      isCompleted ? "problem-selector__item--completed" : ""
                    }`}
                    onClick={() => handleSelect(problem.id)}
                    onMouseEnter={() => isLockedProblem && setHoveredLockedProblem(problem.id)}
                    onMouseLeave={() => setHoveredLockedProblem(null)}
                    disabled={isLockedProblem}
                    aria-disabled={isLockedProblem}
                  >
                    {isLockedProblem ? (
                      <span className="problem-selector__lock-icon" aria-hidden="true">🔒</span>
                    ) : isCompleted ? (
                      <span className="problem-selector__check-icon" aria-hidden="true">✓</span>
                    ) : (
                      <span className={`problem-selector__dot ${getDifficultyClass(problem.difficulty)}`} />
                    )}
                    <span className="problem-selector__item-title">{problem.title}</span>
                    <span className={`problem-selector__item-difficulty ${getDifficultyClass(problem.difficulty)}`}>
                      {problem.difficulty}
                    </span>
                    <span className="problem-selector__item-category">{problem.category}</span>
                    
                    {/* Unlock requirement tooltip */}
                    {isLockedProblem && hoveredLockedProblem === problem.id && unlockRequirement && (
                      <div className="problem-selector__unlock-tooltip">
                        {unlockRequirement}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="problem-selector__backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

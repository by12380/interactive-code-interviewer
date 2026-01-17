import { useState } from "react";

export default function ProblemSelector({
  problems,
  currentProblemId,
  onSelectProblem,
  isLocked
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const currentProblem = problems.find(p => p.id === currentProblemId);
  
  const difficulties = ["all", ...new Set(problems.map(p => p.difficulty))];
  const categories = ["all", ...new Set(problems.map(p => p.category))];

  const filteredProblems = problems.filter(problem => {
    const matchesDifficulty = filterDifficulty === "all" || problem.difficulty === filterDifficulty;
    const matchesCategory = filterCategory === "all" || problem.category === filterCategory;
    return matchesDifficulty && matchesCategory;
  });

  const handleSelect = (problemId) => {
    if (!isLocked) {
      onSelectProblem(problemId);
      setIsOpen(false);
    }
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
              filteredProblems.map(problem => (
                <button
                  key={problem.id}
                  className={`problem-selector__item ${
                    problem.id === currentProblemId ? "problem-selector__item--active" : ""
                  }`}
                  onClick={() => handleSelect(problem.id)}
                >
                  <span className={`problem-selector__dot ${getDifficultyClass(problem.difficulty)}`} />
                  <span className="problem-selector__item-title">{problem.title}</span>
                  <span className={`problem-selector__item-difficulty ${getDifficultyClass(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                  <span className="problem-selector__item-category">{problem.category}</span>
                </button>
              ))
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

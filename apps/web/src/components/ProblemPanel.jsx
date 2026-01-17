import { useState } from "react";

export default function ProblemPanel({
  problem,
  hintsRevealed,
  onRevealHint,
  showSolution,
  onShowSolution,
  isCompleted
}) {
  const [activeTab, setActiveTab] = useState("description");

  if (!problem) {
    return (
      <div className="problem-panel">
        <div className="problem-panel__empty">
          Select a problem to get started
        </div>
      </div>
    );
  }

  const difficultyClass = `problem-panel__difficulty--${problem.difficulty.toLowerCase()}`;

  return (
    <div className="problem-panel">
      <div className="problem-panel__header">
        <h2 className="problem-panel__title">{problem.title}</h2>
        <div className="problem-panel__meta">
          <span className={`problem-panel__difficulty ${difficultyClass}`}>
            {problem.difficulty}
          </span>
          <span className="problem-panel__category">{problem.category}</span>
        </div>
      </div>

      <div className="problem-panel__tabs">
        <button
          className={`problem-panel__tab ${activeTab === "description" ? "problem-panel__tab--active" : ""}`}
          onClick={() => setActiveTab("description")}
        >
          Description
        </button>
        <button
          className={`problem-panel__tab ${activeTab === "examples" ? "problem-panel__tab--active" : ""}`}
          onClick={() => setActiveTab("examples")}
        >
          Examples
        </button>
        <button
          className={`problem-panel__tab ${activeTab === "testcases" ? "problem-panel__tab--active" : ""}`}
          onClick={() => setActiveTab("testcases")}
        >
          Test Cases
        </button>
        <button
          className={`problem-panel__tab ${activeTab === "hints" ? "problem-panel__tab--active" : ""}`}
          onClick={() => setActiveTab("hints")}
        >
          Hints {hintsRevealed > 0 && `(${hintsRevealed}/${problem.hints.length})`}
        </button>
        {isCompleted && (
          <button
            className={`problem-panel__tab ${activeTab === "solution" ? "problem-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("solution")}
          >
            Solution
          </button>
        )}
      </div>

      <div className="problem-panel__content">
        {activeTab === "description" && (
          <div className="problem-panel__description">
            <div className="problem-panel__text">
              {problem.description.split('\n').map((paragraph, index) => (
                <p key={index} dangerouslySetInnerHTML={{ 
                  __html: paragraph
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                }} />
              ))}
            </div>
            
            <div className="problem-panel__constraints">
              <h4>Constraints:</h4>
              <ul>
                {problem.constraints.map((constraint, index) => (
                  <li key={index}>{constraint}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === "examples" && (
          <div className="problem-panel__examples">
            {problem.examples.map((example, index) => (
              <div key={index} className="problem-panel__example">
                <h4>Example {index + 1}:</h4>
                <div className="problem-panel__example-content">
                  <div className="problem-panel__example-row">
                    <span className="problem-panel__label">Input:</span>
                    <code>{example.input}</code>
                  </div>
                  <div className="problem-panel__example-row">
                    <span className="problem-panel__label">Output:</span>
                    <code>{example.output}</code>
                  </div>
                  {example.explanation && (
                    <div className="problem-panel__example-row">
                      <span className="problem-panel__label">Explanation:</span>
                      <span>{example.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "testcases" && (
          <div className="problem-panel__testcases">
            <p className="problem-panel__testcases-info">
              Your solution will be tested against {problem.testCases.length} test cases.
            </p>
            {problem.testCases.map((testCase, index) => (
              <div key={index} className="problem-panel__testcase">
                <div className="problem-panel__testcase-header">
                  <span className="problem-panel__testcase-number">Test Case {index + 1}</span>
                </div>
                <div className="problem-panel__testcase-content">
                  <div className="problem-panel__testcase-row">
                    <span className="problem-panel__label">Input:</span>
                    <code>{JSON.stringify(testCase.input)}</code>
                  </div>
                  <div className="problem-panel__testcase-row">
                    <span className="problem-panel__label">Expected:</span>
                    <code>{JSON.stringify(testCase.expected)}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "hints" && (
          <div className="problem-panel__hints">
            <p className="problem-panel__hints-info">
              Hints can help you when stuck, but using fewer hints gives a better score.
            </p>
            {problem.hints.map((hint, index) => (
              <div key={index} className="problem-panel__hint">
                <div className="problem-panel__hint-header">
                  <span className="problem-panel__hint-number">Hint {index + 1}</span>
                  {index < hintsRevealed ? (
                    <span className="problem-panel__hint-revealed">Revealed</span>
                  ) : index === hintsRevealed ? (
                    <button
                      className="problem-panel__hint-reveal-btn"
                      onClick={() => onRevealHint(index + 1)}
                    >
                      Reveal Hint
                    </button>
                  ) : (
                    <span className="problem-panel__hint-locked">Locked</span>
                  )}
                </div>
                {index < hintsRevealed && (
                  <div className="problem-panel__hint-content">
                    {hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "solution" && isCompleted && (
          <div className="problem-panel__solution">
            {!showSolution ? (
              <div className="problem-panel__solution-prompt">
                <p>Would you like to see the optimal solution?</p>
                <p className="problem-panel__solution-note">
                  Reviewing the solution can help you learn better approaches.
                </p>
                <button
                  className="problem-panel__solution-btn"
                  onClick={onShowSolution}
                >
                  Show Solution
                </button>
              </div>
            ) : (
              <>
                <div className="problem-panel__solution-code">
                  <h4>Optimal Solution:</h4>
                  <pre><code>{problem.solution}</code></pre>
                </div>
                <div className="problem-panel__solution-explanation">
                  <h4>Explanation:</h4>
                  <div dangerouslySetInnerHTML={{
                    __html: problem.solutionExplanation
                      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }} />
                </div>
                <div className="problem-panel__solution-complexity">
                  <span className="problem-panel__label">Optimal Complexity:</span>
                  <code>{problem.optimalComplexity}</code>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

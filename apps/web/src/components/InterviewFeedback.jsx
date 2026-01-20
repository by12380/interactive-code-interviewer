import { useMemo, useState, useCallback } from "react";
import { sendChat } from "../api.js";
import { FEEDBACK_CATEGORIES } from "../data/interviewConfig.js";

export default function InterviewFeedback({
  results,
  interviewer,
  config,
  onFinish,
  onRetry
}) {
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Calculate overall performance metrics
  const metrics = useMemo(() => {
    if (!results) return null;

    const codingProblems = results.codingProblems || [];
    const totalTestsPassed = codingProblems.reduce(
      (sum, p) => sum + (p.testResults?.passed || 0), 0
    );
    const totalTests = codingProblems.reduce(
      (sum, p) => sum + (p.testResults?.total || 0), 0
    );

    const codingScore = totalTests > 0
      ? Math.round((totalTestsPassed / totalTests) * 100)
      : 0;

    const totalTimeSpent = results.totalTime || 0;
    const avgTimePerProblem = codingProblems.length > 0
      ? Math.round(totalTimeSpent / codingProblems.length)
      : 0;

    // Determine grade based on score
    const getGrade = (score) => {
      if (score >= 97) return "A+";
      if (score >= 93) return "A";
      if (score >= 90) return "A-";
      if (score >= 87) return "B+";
      if (score >= 83) return "B";
      if (score >= 80) return "B-";
      if (score >= 77) return "C+";
      if (score >= 73) return "C";
      if (score >= 70) return "C-";
      if (score >= 60) return "D";
      return "F";
    };

    return {
      codingScore,
      grade: getGrade(codingScore),
      totalTimeSpent,
      avgTimePerProblem,
      totalTestsPassed,
      totalTests,
      problemsCompleted: codingProblems.length,
      behavioralCount: results.behavioralResponses?.length || 0,
      hasSystemDesign: !!results.systemDesignNotes
    };
  }, [results]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Generate AI feedback
  const generateAIFeedback = useCallback(async () => {
    if (!results || isGeneratingFeedback) return;

    setIsGeneratingFeedback(true);

    try {
      const summaryContent = `
Interview Summary:
- Total time: ${formatTime(results.totalTime)}
- Coding problems attempted: ${results.codingProblems?.length || 0}
- Tests passed: ${metrics?.totalTestsPassed || 0}/${metrics?.totalTests || 0}
- Behavioral questions: ${results.behavioralResponses?.length || 0}
${results.systemDesignNotes ? `- System design notes provided: Yes` : ''}

Coding Problem Results:
${results.codingProblems?.map((p, i) => `
Problem ${i + 1}: ${p.problemTitle} (${p.difficulty})
- Tests: ${p.testResults?.passed || 0}/${p.testResults?.total || 0} passed
- Time spent: ${formatTime(p.timeSpent)}
`).join('') || 'No problems attempted'}

Please provide constructive feedback on this interview performance, including:
1. Overall assessment
2. Strengths demonstrated
3. Areas for improvement
4. Specific recommendations for practice
`;

      const response = await sendChat({
        messages: [{ role: "user", content: summaryContent }],
        mode: "chat",
        interruptContext: {
          isInterviewFeedback: true,
          interviewerStyle: interviewer?.promptModifier || "professional"
        }
      });

      setAiFeedback(response.reply || "Unable to generate feedback at this time.");
    } catch (error) {
      setAiFeedback("Unable to generate AI feedback. Please try again later.");
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [results, metrics, interviewer, isGeneratingFeedback]);

  if (!results || !metrics) {
    return (
      <div className="interview-feedback">
        <div className="interview-feedback__loading">
          Processing your interview results...
        </div>
      </div>
    );
  }

  return (
    <div className="interview-feedback">
      {/* Header */}
      <div className="interview-feedback__header">
        <h1>Interview Complete!</h1>
        <p>Here's how you did in your {config.name} simulation</p>
      </div>

      {/* Score Overview */}
      <div className="interview-feedback__score-card">
        <div className="score-circle">
          <div className="score-value">{metrics.codingScore}</div>
          <div className="score-label">Overall Score</div>
        </div>
        <div className="grade-badge">
          <span className={`grade grade--${metrics.grade.replace('+', '-plus').replace('-', '-minus')}`}>
            {metrics.grade}
          </span>
        </div>
        <div className="score-summary">
          <div className="summary-item">
            <span className="summary-value">{formatTime(metrics.totalTimeSpent)}</span>
            <span className="summary-label">Total Time</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{metrics.totalTestsPassed}/{metrics.totalTests}</span>
            <span className="summary-label">Tests Passed</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{metrics.problemsCompleted}</span>
            <span className="summary-label">Problems</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="interview-feedback__tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'coding' ? 'active' : ''}`}
          onClick={() => setActiveTab('coding')}
        >
          Coding ({metrics.problemsCompleted})
        </button>
        {metrics.behavioralCount > 0 && (
          <button
            className={`tab ${activeTab === 'behavioral' ? 'active' : ''}`}
            onClick={() => setActiveTab('behavioral')}
          >
            Behavioral ({metrics.behavioralCount})
          </button>
        )}
        {metrics.hasSystemDesign && (
          <button
            className={`tab ${activeTab === 'systemDesign' ? 'active' : ''}`}
            onClick={() => setActiveTab('systemDesign')}
          >
            System Design
          </button>
        )}
        <button
          className={`tab ${activeTab === 'aiFeedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('aiFeedback')}
        >
          AI Feedback
        </button>
      </div>

      {/* Tab Content */}
      <div className="interview-feedback__content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="feedback-section feedback-section--overview">
            <h3>Performance Summary</h3>

            <div className="performance-breakdown">
              {/* Coding Performance */}
              <div className="breakdown-category">
                <h4>Coding Skills</h4>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${metrics.codingScore}%` }}
                  />
                </div>
                <span className="progress-label">{metrics.codingScore}%</span>
              </div>

              {/* Time Management */}
              <div className="breakdown-category">
                <h4>Time Management</h4>
                <p>
                  {metrics.avgTimePerProblem < 20 * 60
                    ? "Excellent pace - solved problems efficiently"
                    : metrics.avgTimePerProblem < 30 * 60
                      ? "Good pace - room for slight improvement"
                      : "Consider practicing for faster problem-solving"}
                </p>
              </div>

              {/* Communication */}
              {metrics.behavioralCount > 0 && (
                <div className="breakdown-category">
                  <h4>Behavioral Questions</h4>
                  <p>Completed {metrics.behavioralCount} behavioral question{metrics.behavioralCount !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="quick-tips">
              <h4>Quick Tips for Improvement</h4>
              <ul>
                {metrics.codingScore < 70 && (
                  <li>Practice more problems on the topics you struggled with</li>
                )}
                {metrics.totalTestsPassed < metrics.totalTests && (
                  <li>Focus on edge cases - some test cases were missed</li>
                )}
                {metrics.avgTimePerProblem > 25 * 60 && (
                  <li>Work on solving problems faster through pattern recognition</li>
                )}
                <li>Review optimal solutions after each practice session</li>
              </ul>
            </div>
          </div>
        )}

        {/* Coding Tab */}
        {activeTab === 'coding' && (
          <div className="feedback-section feedback-section--coding">
            <h3>Coding Problem Details</h3>

            {results.codingProblems?.map((problem, idx) => (
              <div key={idx} className="problem-result">
                <div className="problem-result__header">
                  <h4>{problem.problemTitle}</h4>
                  <span className={`difficulty-badge difficulty-badge--${problem.difficulty?.toLowerCase()}`}>
                    {problem.difficulty}
                  </span>
                </div>

                <div className="problem-result__stats">
                  <div className="stat">
                    <span className="stat-value">
                      {problem.testResults?.passed || 0}/{problem.testResults?.total || 0}
                    </span>
                    <span className="stat-label">Tests Passed</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatTime(problem.timeSpent)}</span>
                    <span className="stat-label">Time Spent</span>
                  </div>
                  <div className="stat">
                    <span className={`stat-value ${
                      problem.testResults?.passed === problem.testResults?.total
                        ? 'success'
                        : problem.testResults?.passed > 0
                          ? 'partial'
                          : 'fail'
                    }`}>
                      {problem.testResults?.passed === problem.testResults?.total
                        ? '✓ Solved'
                        : problem.testResults?.passed > 0
                          ? '◐ Partial'
                          : '✗ Incomplete'}
                    </span>
                    <span className="stat-label">Status</span>
                  </div>
                </div>

                {/* Test Results */}
                {problem.testResults?.results?.length > 0 && (
                  <div className="test-results">
                    <h5>Test Cases</h5>
                    {problem.testResults.results.map((test, testIdx) => (
                      <div
                        key={testIdx}
                        className={`test-case ${test.passed ? 'passed' : 'failed'}`}
                      >
                        <span className="test-icon">{test.passed ? '✓' : '✗'}</span>
                        <div className="test-details">
                          <code>Input: {JSON.stringify(test.input)}</code>
                          <code>Expected: {JSON.stringify(test.expected)}</code>
                          {!test.passed && (
                            <code className="actual">Got: {JSON.stringify(test.actual)}</code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Code Submitted */}
                <details className="code-submitted">
                  <summary>View Submitted Code</summary>
                  <pre>{problem.code}</pre>
                </details>
              </div>
            ))}

            {(!results.codingProblems || results.codingProblems.length === 0) && (
              <p className="no-data">No coding problems were completed.</p>
            )}
          </div>
        )}

        {/* Behavioral Tab */}
        {activeTab === 'behavioral' && (
          <div className="feedback-section feedback-section--behavioral">
            <h3>Behavioral Questions</h3>

            {results.behavioralResponses?.map((response, idx) => (
              <div key={idx} className="behavioral-result">
                <div className="behavioral-result__question">
                  <span className="question-number">Q{idx + 1}</span>
                  <p>{response.question}</p>
                </div>
                <div className="behavioral-result__meta">
                  <span>Time spent: {formatTime(response.timeSpent)}</span>
                </div>
              </div>
            ))}

            {(!results.behavioralResponses || results.behavioralResponses.length === 0) && (
              <p className="no-data">No behavioral questions were completed.</p>
            )}

            {/* Behavioral Tips */}
            <div className="behavioral-tips">
              <h4>Tips for Behavioral Questions</h4>
              <ul>
                <li>Use the STAR method (Situation, Task, Action, Result)</li>
                <li>Prepare 5-7 versatile stories that can answer multiple questions</li>
                <li>Quantify your impact when possible</li>
                <li>Practice speaking your answers out loud</li>
              </ul>
            </div>
          </div>
        )}

        {/* System Design Tab */}
        {activeTab === 'systemDesign' && (
          <div className="feedback-section feedback-section--system-design">
            <h3>System Design Notes</h3>

            {results.systemDesignNotes ? (
              <div className="system-design-notes">
                <pre>{results.systemDesignNotes}</pre>
              </div>
            ) : (
              <p className="no-data">No system design notes were recorded.</p>
            )}

            {/* System Design Tips */}
            <div className="system-design-tips">
              <h4>Key Areas to Cover in System Design</h4>
              <ul>
                <li>Clarify requirements and scope before designing</li>
                <li>Start with high-level architecture, then drill down</li>
                <li>Discuss trade-offs and alternatives</li>
                <li>Address scalability early</li>
                <li>Consider failure scenarios and how to handle them</li>
              </ul>
            </div>
          </div>
        )}

        {/* AI Feedback Tab */}
        {activeTab === 'aiFeedback' && (
          <div className="feedback-section feedback-section--ai">
            <h3>AI-Powered Feedback</h3>

            {!aiFeedback && !isGeneratingFeedback && (
              <div className="generate-feedback">
                <p>Get personalized feedback on your interview performance from our AI interviewer.</p>
                <button
                  className="generate-btn"
                  onClick={generateAIFeedback}
                >
                  Generate Feedback
                </button>
              </div>
            )}

            {isGeneratingFeedback && (
              <div className="generating-feedback">
                <div className="loading-spinner"></div>
                <p>Analyzing your interview performance...</p>
              </div>
            )}

            {aiFeedback && (
              <div className="ai-feedback-content">
                <div className="interviewer-badge">
                  <span className="interviewer-name">{interviewer?.name || 'AI Interviewer'}</span>
                  <span className="interviewer-style">{interviewer?.style || 'Professional'}</span>
                </div>
                <div className="feedback-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {aiFeedback}
                </div>
                <button
                  className="regenerate-btn"
                  onClick={generateAIFeedback}
                  disabled={isGeneratingFeedback}
                >
                  Regenerate Feedback
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="interview-feedback__actions">
        <button className="action-btn action-btn--retry" onClick={onRetry}>
          Try Another Interview
        </button>
        <button className="action-btn action-btn--finish" onClick={onFinish}>
          Return to Main App
        </button>
      </div>

      {/* Video Recording */}
      {results.recordedVideo && results.recordedVideo.length > 0 && (
        <div className="interview-feedback__video">
          <h3>Interview Recording</h3>
          <p>Your interview was recorded. You can download it to review your performance.</p>
          <button
            className="download-video-btn"
            onClick={() => {
              const blob = new Blob(results.recordedVideo, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `interview-${new Date().toISOString().slice(0, 10)}.webm`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            Download Recording
          </button>
        </div>
      )}
    </div>
  );
}

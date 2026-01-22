import { memo, useState, useMemo, useCallback, useEffect } from "react";
import {
  SKILL_CATEGORIES,
  ASSESSMENT_QUESTIONS,
  COMPANY_FOCUS,
  TIME_COMMITMENTS,
  calculateSkillLevels,
  getWeakAreas,
  generateStudyPlan,
  getDailyRecommendations,
  calculateProgress,
  checkMilestones,
  adjustPlanForPerformance
} from "../services/roadmapService.js";

function PrepRoadmap({ 
  user, 
  onClose,
  onUserUpdate,
  onSelectProblem,
  problems
}) {
  // State management
  const [activeView, setActiveView] = useState("overview"); // overview, assessment, plan, recommendations
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedTimeCommitment, setSelectedTimeCommitment] = useState("moderate");
  const [selectedPlanDuration, setSelectedPlanDuration] = useState(30);
  const [celebrationMilestone, setCelebrationMilestone] = useState(null);

  // Get roadmap data from user
  const roadmapData = user?.roadmap || {
    assessmentComplete: false,
    skills: {},
    currentPlan: null,
    preferences: {}
  };

  const skills = roadmapData.skills || {};
  const currentPlan = roadmapData.currentPlan;
  const assessmentComplete = roadmapData.assessmentComplete;

  // Calculate progress if there's an active plan
  const progress = useMemo(() => {
    if (!currentPlan) return null;
    return calculateProgress(currentPlan, user?.stats);
  }, [currentPlan, user?.stats]);

  // Get daily recommendations
  const recommendations = useMemo(() => {
    if (!assessmentComplete || Object.keys(skills).length === 0) return [];
    return getDailyRecommendations({
      skills,
      problemsCompleted: user?.stats?.problemsCompleted || [],
      company: selectedCompany || roadmapData.preferences?.company,
      limit: 3
    });
  }, [skills, assessmentComplete, user?.stats?.problemsCompleted, selectedCompany, roadmapData.preferences?.company]);

  // Weak areas
  const weakAreas = useMemo(() => {
    if (Object.keys(skills).length === 0) return [];
    return getWeakAreas(skills).slice(0, 3);
  }, [skills]);

  // Assessment handlers
  const currentQuestion = ASSESSMENT_QUESTIONS[assessmentStep];
  const totalQuestions = ASSESSMENT_QUESTIONS.length;

  const handleAnswerSelect = useCallback((optionIndex) => {
    const newAnswers = [...assessmentAnswers];
    newAnswers[assessmentStep] = {
      questionId: currentQuestion.id,
      selectedOption: optionIndex
    };
    setAssessmentAnswers(newAnswers);
  }, [assessmentStep, currentQuestion, assessmentAnswers]);

  const handleNextQuestion = useCallback(() => {
    if (assessmentStep < totalQuestions - 1) {
      setAssessmentStep(prev => prev + 1);
    } else {
      // Assessment complete - calculate skills
      const calculatedSkills = calculateSkillLevels(assessmentAnswers);
      
      // Save to user data
      if (onUserUpdate && user) {
        const updatedRoadmap = {
          ...roadmapData,
          assessmentComplete: true,
          skills: calculatedSkills,
          assessmentDate: new Date().toISOString()
        };
        
        const updatedUser = {
          ...user,
          roadmap: updatedRoadmap
        };
        
        // Save to localStorage
        localStorage.setItem('code_interviewer_current_user', JSON.stringify(updatedUser));
        const users = JSON.parse(localStorage.getItem('code_interviewer_users') || '{}');
        if (users[user.id]) {
          users[user.id] = { ...users[user.id], roadmap: updatedRoadmap };
          localStorage.setItem('code_interviewer_users', JSON.stringify(users));
        }
        
        onUserUpdate(updatedUser);
      }
      
      setActiveView("overview");
    }
  }, [assessmentStep, totalQuestions, assessmentAnswers, onUserUpdate, user, roadmapData]);

  const handlePrevQuestion = useCallback(() => {
    if (assessmentStep > 0) {
      setAssessmentStep(prev => prev - 1);
    }
  }, [assessmentStep]);

  // Plan generation
  const handleGeneratePlan = useCallback(() => {
    if (!assessmentComplete || Object.keys(skills).length === 0) {
      setActiveView("assessment");
      return;
    }

    const newPlan = generateStudyPlan({
      skills,
      company: selectedCompany,
      timeCommitment: selectedTimeCommitment,
      planDuration: selectedPlanDuration,
      problemsCompleted: user?.stats?.problemsCompleted || []
    });

    // Activate the plan
    newPlan.activatedAt = new Date().toISOString();

    // Save to user data
    if (onUserUpdate && user) {
      const updatedRoadmap = {
        ...roadmapData,
        currentPlan: newPlan,
        preferences: {
          ...roadmapData.preferences,
          company: selectedCompany,
          timeCommitment: selectedTimeCommitment
        }
      };

      const updatedUser = {
        ...user,
        roadmap: updatedRoadmap
      };

      localStorage.setItem('code_interviewer_current_user', JSON.stringify(updatedUser));
      const users = JSON.parse(localStorage.getItem('code_interviewer_users') || '{}');
      if (users[user.id]) {
        users[user.id] = { ...users[user.id], roadmap: updatedRoadmap };
        localStorage.setItem('code_interviewer_users', JSON.stringify(users));
      }

      onUserUpdate(updatedUser);
    }

    setActiveView("plan");
  }, [assessmentComplete, skills, selectedCompany, selectedTimeCommitment, selectedPlanDuration, user, onUserUpdate, roadmapData]);

  // Mark task complete
  const handleTaskComplete = useCallback((dayIndex, taskIndex) => {
    if (!currentPlan) return;

    const updatedPlan = { ...currentPlan };
    updatedPlan.dailyTasks = [...currentPlan.dailyTasks];
    updatedPlan.dailyTasks[dayIndex] = { ...currentPlan.dailyTasks[dayIndex] };
    updatedPlan.dailyTasks[dayIndex].tasks = [...currentPlan.dailyTasks[dayIndex].tasks];
    updatedPlan.dailyTasks[dayIndex].tasks[taskIndex] = {
      ...currentPlan.dailyTasks[dayIndex].tasks[taskIndex],
      completed: true,
      completedAt: new Date().toISOString()
    };

    // Check if all tasks for the day are complete
    const allTasksComplete = updatedPlan.dailyTasks[dayIndex].tasks.every(t => t.completed);
    if (allTasksComplete) {
      updatedPlan.dailyTasks[dayIndex].completed = true;
    }

    // Check for milestones
    const previousDaysCompleted = currentPlan.dailyTasks.filter(d => d.completed).length;
    const newMilestones = checkMilestones(updatedPlan, previousDaysCompleted);
    if (newMilestones.length > 0) {
      setCelebrationMilestone(newMilestones[0]);
      setTimeout(() => setCelebrationMilestone(null), 5000);
    }

    // Save updated plan
    if (onUserUpdate && user) {
      const updatedRoadmap = {
        ...roadmapData,
        currentPlan: updatedPlan
      };

      const updatedUser = {
        ...user,
        roadmap: updatedRoadmap
      };

      localStorage.setItem('code_interviewer_current_user', JSON.stringify(updatedUser));
      const users = JSON.parse(localStorage.getItem('code_interviewer_users') || '{}');
      if (users[user.id]) {
        users[user.id] = { ...users[user.id], roadmap: updatedRoadmap };
        localStorage.setItem('code_interviewer_users', JSON.stringify(users));
      }

      onUserUpdate(updatedUser);
    }
  }, [currentPlan, user, onUserUpdate, roadmapData]);

  // Reset assessment
  const handleRetakeAssessment = useCallback(() => {
    setAssessmentStep(0);
    setAssessmentAnswers([]);
    setActiveView("assessment");
  }, []);

  // Start problem from recommendation
  const handleStartProblem = useCallback((problemId) => {
    if (onSelectProblem) {
      onSelectProblem(problemId);
      onClose();
    }
  }, [onSelectProblem, onClose]);

  // Get skill category info
  const getSkillInfo = (skillId) => {
    return SKILL_CATEGORIES.find(s => s.id === skillId) || { name: skillId, icon: '📊' };
  };

  return (
    <div className="roadmap-modal">
      <div className="roadmap-modal__backdrop" onClick={onClose} />
      <div className="roadmap-modal__content">
        <button 
          className="roadmap-modal__close" 
          onClick={onClose}
          aria-label="Close roadmap"
        >
          ×
        </button>

        {/* Milestone Celebration */}
        {celebrationMilestone && (
          <div className="roadmap-celebration">
            <span className="roadmap-celebration__icon">{celebrationMilestone.icon}</span>
            <h3 className="roadmap-celebration__title">{celebrationMilestone.name}</h3>
            <p className="roadmap-celebration__message">{celebrationMilestone.message}</p>
          </div>
        )}

        <div className="roadmap__header">
          <h2 className="roadmap__title">Interview Prep Roadmap</h2>
          <p className="roadmap__subtitle">AI-powered personalized study plan</p>
        </div>

        {/* Navigation Tabs */}
        <div className="roadmap__tabs">
          <button
            className={`roadmap__tab ${activeView === "overview" ? "roadmap__tab--active" : ""}`}
            onClick={() => setActiveView("overview")}
          >
            Overview
          </button>
          <button
            className={`roadmap__tab ${activeView === "assessment" ? "roadmap__tab--active" : ""}`}
            onClick={() => setActiveView("assessment")}
          >
            Skill Assessment
          </button>
          <button
            className={`roadmap__tab ${activeView === "plan" ? "roadmap__tab--active" : ""}`}
            onClick={() => setActiveView("plan")}
            disabled={!currentPlan}
          >
            My Plan
          </button>
          <button
            className={`roadmap__tab ${activeView === "recommendations" ? "roadmap__tab--active" : ""}`}
            onClick={() => setActiveView("recommendations")}
          >
            Daily Tasks
          </button>
        </div>

        <div className="roadmap__content">
          {/* ===== OVERVIEW VIEW ===== */}
          {activeView === "overview" && (
            <div className="roadmap__overview">
              {/* Quick Stats */}
              {assessmentComplete && (
                <div className="roadmap__stats-row">
                  <div className="roadmap__stat-card">
                    <span className="roadmap__stat-icon">📊</span>
                    <span className="roadmap__stat-value">{Object.keys(skills).length}</span>
                    <span className="roadmap__stat-label">Skills Assessed</span>
                  </div>
                  <div className="roadmap__stat-card">
                    <span className="roadmap__stat-icon">🎯</span>
                    <span className="roadmap__stat-value">{weakAreas.length}</span>
                    <span className="roadmap__stat-label">Focus Areas</span>
                  </div>
                  <div className="roadmap__stat-card">
                    <span className="roadmap__stat-icon">📅</span>
                    <span className="roadmap__stat-value">{progress?.daysCompleted || 0}</span>
                    <span className="roadmap__stat-label">Days Completed</span>
                  </div>
                  <div className="roadmap__stat-card">
                    <span className="roadmap__stat-icon">🔥</span>
                    <span className="roadmap__stat-value">{progress?.streak || 0}</span>
                    <span className="roadmap__stat-label">Day Streak</span>
                  </div>
                </div>
              )}

              {/* Current Plan Progress */}
              {currentPlan && progress && (
                <div className="roadmap__progress-section">
                  <h3>Current Plan Progress</h3>
                  <div className="roadmap__progress-card">
                    <div className="roadmap__progress-header">
                      <span className="roadmap__progress-label">
                        {currentPlan.planDuration}-Day Plan
                        {currentPlan.company && ` • ${COMPANY_FOCUS[currentPlan.company]?.name}`}
                      </span>
                      <span className="roadmap__progress-percent">{progress.completionRate}%</span>
                    </div>
                    <div className="roadmap__progress-bar">
                      <div 
                        className="roadmap__progress-fill"
                        style={{ width: `${progress.completionRate}%` }}
                      />
                    </div>
                    <div className="roadmap__progress-details">
                      <span>Day {progress.currentDay} of {currentPlan.planDuration}</span>
                      <span>{progress.daysRemaining} days remaining</span>
                    </div>
                    {progress.phase && (
                      <div className="roadmap__current-phase">
                        <span className="roadmap__phase-icon">{progress.phase.icon}</span>
                        <span className="roadmap__phase-name">{progress.phase.name}</span>
                        <span className="roadmap__phase-focus">{progress.phase.focus}</span>
                      </div>
                    )}
                    {progress.nextMilestone && (
                      <div className="roadmap__next-milestone">
                        <span className="roadmap__milestone-icon">{progress.nextMilestone.icon}</span>
                        <span>Next: {progress.nextMilestone.name} (Day {progress.nextMilestone.day})</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Skill Overview */}
              {assessmentComplete && Object.keys(skills).length > 0 && (
                <div className="roadmap__skills-section">
                  <h3>Your Skills</h3>
                  <div className="roadmap__skills-grid">
                    {SKILL_CATEGORIES.slice(0, 8).map(skill => {
                      const skillData = skills[skill.id] || { score: 0, level: 'beginner' };
                      const isWeak = weakAreas.includes(skill.id);
                      return (
                        <div 
                          key={skill.id}
                          className={`roadmap__skill-item ${isWeak ? 'roadmap__skill-item--weak' : ''}`}
                        >
                          <div className="roadmap__skill-header">
                            <span className="roadmap__skill-icon">{skill.icon}</span>
                            <span className="roadmap__skill-name">{skill.name}</span>
                            {isWeak && <span className="roadmap__skill-badge">Focus</span>}
                          </div>
                          <div className="roadmap__skill-bar">
                            <div 
                              className={`roadmap__skill-fill roadmap__skill-fill--${skillData.level}`}
                              style={{ width: `${skillData.score}%` }}
                            />
                          </div>
                          <span className="roadmap__skill-level">{skillData.level}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    className="roadmap__retake-btn"
                    onClick={handleRetakeAssessment}
                  >
                    Retake Assessment
                  </button>
                </div>
              )}

              {/* Get Started / Create Plan */}
              {!assessmentComplete ? (
                <div className="roadmap__cta-section">
                  <div className="roadmap__cta-card">
                    <span className="roadmap__cta-icon">🎯</span>
                    <h3>Start Your Journey</h3>
                    <p>Take a quick skill assessment to get a personalized study plan tailored to your strengths and weaknesses.</p>
                    <button 
                      className="roadmap__cta-btn"
                      onClick={() => setActiveView("assessment")}
                    >
                      Take Skill Assessment
                    </button>
                  </div>
                </div>
              ) : !currentPlan && (
                <div className="roadmap__plan-builder">
                  <h3>Create Your Study Plan</h3>
                  
                  {/* Plan Duration */}
                  <div className="roadmap__option-group">
                    <label className="roadmap__option-label">Plan Duration</label>
                    <div className="roadmap__duration-options">
                      {[30, 60, 90].map(days => (
                        <button
                          key={days}
                          className={`roadmap__duration-btn ${selectedPlanDuration === days ? 'roadmap__duration-btn--active' : ''}`}
                          onClick={() => setSelectedPlanDuration(days)}
                        >
                          <span className="roadmap__duration-days">{days}</span>
                          <span className="roadmap__duration-label">days</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Commitment */}
                  <div className="roadmap__option-group">
                    <label className="roadmap__option-label">Time Commitment</label>
                    <div className="roadmap__time-options">
                      {TIME_COMMITMENTS.map(time => (
                        <button
                          key={time.id}
                          className={`roadmap__time-btn ${selectedTimeCommitment === time.id ? 'roadmap__time-btn--active' : ''}`}
                          onClick={() => setSelectedTimeCommitment(time.id)}
                        >
                          <span className="roadmap__time-label">{time.label}</span>
                          <span className="roadmap__time-problems">{time.problemsPerDay} problems/day</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Company Focus */}
                  <div className="roadmap__option-group">
                    <label className="roadmap__option-label">Company Focus (Optional)</label>
                    <div className="roadmap__company-options">
                      {Object.entries(COMPANY_FOCUS).map(([key, company]) => (
                        <button
                          key={key}
                          className={`roadmap__company-btn ${selectedCompany === key ? 'roadmap__company-btn--active' : ''}`}
                          onClick={() => setSelectedCompany(selectedCompany === key ? null : key)}
                        >
                          <span className="roadmap__company-logo">{company.logo}</span>
                          <span className="roadmap__company-name">{company.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Company Details */}
                  {selectedCompany && (
                    <div className="roadmap__company-details">
                      <h4>{COMPANY_FOCUS[selectedCompany].name} Interview Style</h4>
                      <p>{COMPANY_FOCUS[selectedCompany].description}</p>
                      <div className="roadmap__company-tips">
                        <strong>Tips:</strong>
                        <ul>
                          {COMPANY_FOCUS[selectedCompany].tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <button 
                    className="roadmap__generate-btn"
                    onClick={handleGeneratePlan}
                  >
                    Generate My {selectedPlanDuration}-Day Plan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== ASSESSMENT VIEW ===== */}
          {activeView === "assessment" && (
            <div className="roadmap__assessment">
              <div className="roadmap__assessment-progress">
                <div className="roadmap__assessment-progress-bar">
                  <div 
                    className="roadmap__assessment-progress-fill"
                    style={{ width: `${((assessmentStep + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
                <span className="roadmap__assessment-counter">
                  Question {assessmentStep + 1} of {totalQuestions}
                </span>
              </div>

              {currentQuestion && (
                <div className="roadmap__question-card">
                  <div className="roadmap__question-category">
                    {getSkillInfo(currentQuestion.category).icon} {getSkillInfo(currentQuestion.category).name}
                  </div>
                  <h3 className="roadmap__question-text">{currentQuestion.question}</h3>
                  
                  <div className="roadmap__options">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        className={`roadmap__option ${assessmentAnswers[assessmentStep]?.selectedOption === index ? 'roadmap__option--selected' : ''}`}
                        onClick={() => handleAnswerSelect(index)}
                      >
                        <span className="roadmap__option-letter">{String.fromCharCode(65 + index)}</span>
                        <span className="roadmap__option-text">{option}</span>
                      </button>
                    ))}
                  </div>

                  <div className="roadmap__question-actions">
                    <button 
                      className="roadmap__nav-btn roadmap__nav-btn--prev"
                      onClick={handlePrevQuestion}
                      disabled={assessmentStep === 0}
                    >
                      Previous
                    </button>
                    <button 
                      className="roadmap__nav-btn roadmap__nav-btn--next"
                      onClick={handleNextQuestion}
                      disabled={assessmentAnswers[assessmentStep] === undefined}
                    >
                      {assessmentStep === totalQuestions - 1 ? 'Complete Assessment' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== PLAN VIEW ===== */}
          {activeView === "plan" && currentPlan && (
            <div className="roadmap__plan">
              {/* Plan Header */}
              <div className="roadmap__plan-header">
                <div className="roadmap__plan-info">
                  <h3>{currentPlan.planDuration}-Day Study Plan</h3>
                  {currentPlan.company && (
                    <span className="roadmap__plan-company">
                      {COMPANY_FOCUS[currentPlan.company]?.logo} {COMPANY_FOCUS[currentPlan.company]?.name} Focus
                    </span>
                  )}
                </div>
                <div className="roadmap__plan-meta">
                  <span>Started: {new Date(currentPlan.activatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Phases */}
              <div className="roadmap__phases">
                {currentPlan.phases?.map((phase, index) => {
                  const isActive = progress?.currentDay >= phase.days[0] && progress?.currentDay <= phase.days[1];
                  const isComplete = progress?.currentDay > phase.days[1];
                  return (
                    <div 
                      key={index}
                      className={`roadmap__phase ${isActive ? 'roadmap__phase--active' : ''} ${isComplete ? 'roadmap__phase--complete' : ''}`}
                    >
                      <span className="roadmap__phase-icon">{phase.icon}</span>
                      <span className="roadmap__phase-name">{phase.name}</span>
                      <span className="roadmap__phase-days">Days {phase.days[0]}-{phase.days[1]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Today's Tasks */}
              {progress && currentPlan.dailyTasks[progress.currentDay - 1] && (
                <div className="roadmap__today-section">
                  <h3>Today's Tasks (Day {progress.currentDay})</h3>
                  <div className="roadmap__tasks-list">
                    {currentPlan.dailyTasks[progress.currentDay - 1].tasks.map((task, taskIndex) => (
                      <div 
                        key={task.id}
                        className={`roadmap__task-item ${task.completed ? 'roadmap__task-item--complete' : ''}`}
                      >
                        <button
                          className="roadmap__task-checkbox"
                          onClick={() => handleTaskComplete(progress.currentDay - 1, taskIndex)}
                          disabled={task.completed}
                          aria-label={task.completed ? 'Task completed' : 'Mark task complete'}
                        >
                          {task.completed ? '✓' : ''}
                        </button>
                        <div className="roadmap__task-content">
                          <span className="roadmap__task-type">
                            {task.type === 'problem' ? '💻' : task.type === 'review' ? '📖' : '🎯'}
                          </span>
                          <div className="roadmap__task-info">
                            <span className="roadmap__task-title">
                              {task.type === 'problem' 
                                ? `${task.skillName} Problem (${task.targetDifficulty})`
                                : task.title}
                            </span>
                            <span className="roadmap__task-time">{task.estimatedMinutes} min</span>
                          </div>
                        </div>
                        {task.type === 'problem' && !task.completed && (
                          <button 
                            className="roadmap__task-start"
                            onClick={() => handleStartProblem(problems.find(p => 
                              p.category?.toLowerCase().includes(task.skillArea.split('-')[0])
                            )?.id || problems[0]?.id)}
                          >
                            Start
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Calendar View */}
              <div className="roadmap__calendar-section">
                <h3>This Week</h3>
                <div className="roadmap__week-grid">
                  {currentPlan.dailyTasks.slice(
                    Math.max(0, (progress?.currentDay || 1) - 3),
                    (progress?.currentDay || 1) + 4
                  ).map((day, index) => {
                    const dayNum = Math.max(0, (progress?.currentDay || 1) - 3) + index + 1;
                    const isToday = dayNum === progress?.currentDay;
                    const completedTasks = day.tasks.filter(t => t.completed).length;
                    return (
                      <div 
                        key={dayNum}
                        className={`roadmap__day-card ${isToday ? 'roadmap__day-card--today' : ''} ${day.completed ? 'roadmap__day-card--complete' : ''}`}
                      >
                        <span className="roadmap__day-number">Day {dayNum}</span>
                        <span className="roadmap__day-tasks">
                          {completedTasks}/{day.tasks.length} tasks
                        </span>
                        {day.completed && <span className="roadmap__day-check">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===== RECOMMENDATIONS VIEW ===== */}
          {activeView === "recommendations" && (
            <div className="roadmap__recommendations">
              <h3>Today's Recommended Problems</h3>
              <p className="roadmap__recommendations-subtitle">
                Based on your skill assessment and learning goals
              </p>

              {recommendations.length > 0 ? (
                <div className="roadmap__recommendations-list">
                  {recommendations.map((rec, index) => (
                    <div 
                      key={rec.problem.id}
                      className={`roadmap__recommendation-card roadmap__recommendation-card--${rec.priority}`}
                    >
                      <div className="roadmap__recommendation-rank">#{index + 1}</div>
                      <div className="roadmap__recommendation-content">
                        <div className="roadmap__recommendation-header">
                          <h4 className="roadmap__recommendation-title">{rec.problem.title}</h4>
                          <span className={`roadmap__recommendation-difficulty roadmap__recommendation-difficulty--${rec.problem.difficulty.toLowerCase()}`}>
                            {rec.problem.difficulty}
                          </span>
                        </div>
                        <p className="roadmap__recommendation-reason">{rec.reason}</p>
                        <div className="roadmap__recommendation-meta">
                          <span className="roadmap__recommendation-category">
                            {rec.problem.category}
                          </span>
                          <span className="roadmap__recommendation-time">
                            ~{Math.round((rec.problem.timeLimit || 1800) / 60)} min
                          </span>
                        </div>
                      </div>
                      <button 
                        className="roadmap__recommendation-start"
                        onClick={() => handleStartProblem(rec.problem.id)}
                      >
                        Start Problem
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="roadmap__no-recommendations">
                  <p>Complete the skill assessment to get personalized recommendations!</p>
                  <button 
                    className="roadmap__cta-btn"
                    onClick={() => setActiveView("assessment")}
                  >
                    Take Assessment
                  </button>
                </div>
              )}

              {/* Weak Areas Focus */}
              {weakAreas.length > 0 && (
                <div className="roadmap__weak-areas-section">
                  <h3>Focus Areas</h3>
                  <p>These are the skills you should prioritize:</p>
                  <div className="roadmap__weak-areas-list">
                    {weakAreas.map(skillId => {
                      const skill = getSkillInfo(skillId);
                      const skillData = skills[skillId];
                      return (
                        <div key={skillId} className="roadmap__weak-area-item">
                          <span className="roadmap__weak-area-icon">{skill.icon}</span>
                          <div className="roadmap__weak-area-info">
                            <span className="roadmap__weak-area-name">{skill.name}</span>
                            <div className="roadmap__weak-area-bar">
                              <div 
                                className="roadmap__weak-area-fill"
                                style={{ width: `${skillData?.score || 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="roadmap__weak-area-score">{skillData?.score || 0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PrepRoadmap);

import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
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
} from "../services/roadmapService.js";
import {
  calculateLevel,
  getLevelProgress,
} from "../services/gamificationService.js";
import {
  getCurrentUser,
  logout as logoutUser,
  ensureLocalUser,
} from "../services/userService.js";
import GamificationPanel from "../components/GamificationPanel.jsx";
import UserProfile from "../components/UserProfile.jsx";
import { PROBLEMS, getProblemById } from "../data/problems.js";
import { listUserSavedCode } from "../api.js";

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const ONBOARDING_QUESTIONS = [
  {
    id: "experience",
    question: "What's your current experience level with coding?",
    icon: "🎓",
    options: [
      { label: "Just getting started", value: "beginner", icon: "🌱" },
      { label: "I know the basics", value: "elementary", icon: "📗" },
      { label: "Comfortable with most concepts", value: "intermediate", icon: "💻" },
      { label: "Advanced — I want to sharpen my edge", value: "advanced", icon: "🚀" },
    ],
  },
  {
    id: "goal",
    question: "What brings you here today?",
    icon: "🎯",
    options: [
      { label: "Preparing for coding interviews", value: "interviews", icon: "🤝" },
      { label: "Improving general problem-solving skills", value: "skills", icon: "🧠" },
      { label: "Learning data structures & algorithms", value: "dsa", icon: "📚" },
      { label: "Competitive programming practice", value: "competitive", icon: "🏆" },
    ],
  },
  {
    id: "weakArea",
    question: "Which area do you find most challenging?",
    icon: "🔍",
    options: [
      { label: "Arrays, Strings & Hashing", value: "arrays-hashing", icon: "📊" },
      { label: "Trees & Graphs", value: "trees-graphs", icon: "🌳" },
      { label: "Dynamic Programming", value: "dynamic-programming", icon: "🧮" },
      { label: "I'm not sure yet", value: "unknown", icon: "🤔" },
    ],
  },
  {
    id: "pace",
    question: "How much time can you dedicate daily?",
    icon: "⏱️",
    options: [
      { label: "15–30 minutes", value: "light", icon: "☕" },
      { label: "30–60 minutes", value: "moderate", icon: "💪" },
      { label: "1–2 hours", value: "intensive", icon: "🔥" },
      { label: "2+ hours — all in", value: "full-time", icon: "⚡" },
    ],
  },
];

export default function PracticeDashboard() {
  const navigate = useNavigate();
  const { user: authUser, logOut: firebaseLogOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState(() => {
    const local = getCurrentUser();
    if (local) return local;
    if (authUser) return ensureLocalUser(authUser);
    return null;
  });

  useEffect(() => {
    if (!user && authUser) {
      setUser(ensureLocalUser(authUser));
    }
  }, [authUser, user]);

  const effectiveUser = user || (authUser ? {
    id: authUser.uid,
    username: authUser.displayName || authUser.email?.split("@")[0] || "User",
    email: authUser.email,
  } : null);

  const [showAchievements, setShowAchievements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const roadmapData = user?.roadmap || {};
  const hasCompletedOnboarding = roadmapData.assessmentComplete || roadmapData.onboardingComplete;

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(!hasCompletedOnboarding);

  // Assessment state (skill quiz after onboarding)
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(roadmapData.assessmentComplete || false);

  // Dashboard filter
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeDifficulty, setActiveDifficulty] = useState("all");

  // Saved code (resume) entries
  const [savedEntries, setSavedEntries] = useState([]);

  // Gamification data
  const gamification = user?.gamification || {};
  const xp = gamification.xp || 0;
  const level = useMemo(() => calculateLevel(xp), [xp]);
  const levelProgress = useMemo(() => getLevelProgress(xp), [xp]);
  const streak = gamification?.streak?.current || 0;
  const skills = roadmapData.skills || {};

  // Recommendations
  const recommendations = useMemo(() => {
    if (!assessmentComplete || Object.keys(skills).length === 0) return [];
    return getDailyRecommendations({
      skills,
      problemsCompleted: user?.stats?.problemsCompleted || [],
      limit: 6,
    });
  }, [skills, assessmentComplete, user?.stats?.problemsCompleted]);

  // Weak areas
  const weakAreas = useMemo(() => {
    if (Object.keys(skills).length === 0) return [];
    return getWeakAreas(skills).slice(0, 3);
  }, [skills]);

  // Problem stats
  const problemsCompleted = user?.stats?.problemsCompleted || [];
  const totalProblems = PROBLEMS.length;
  const completedCount = problemsCompleted.length;

  // Filter problems
  const filteredProblems = useMemo(() => {
    return PROBLEMS.filter((p) => {
      const matchesCat = activeCategory === "all" || p.category === activeCategory;
      const matchesDiff = activeDifficulty === "all" || p.difficulty === activeDifficulty;
      return matchesCat && matchesDiff;
    });
  }, [activeCategory, activeDifficulty]);

  const categories = useMemo(() => [...new Set(PROBLEMS.map((p) => p.category))], []);
  const difficulties = ["Easy", "Medium", "Hard"];

  // Fetch saved code entries so we can show "Resume" cards
  useEffect(() => {
    const userId = effectiveUser?.id || authUser?.uid;
    if (!userId) return;

    let cancelled = false;
    listUserSavedCode({ userId })
      .then((items) => {
        if (cancelled) return;
        // Resolve each entry to its problem metadata
        const resolved = items
          .map((entry) => {
            const problem = getProblemById(entry.problemId);
            if (!problem) return null;
            return { ...entry, problem };
          })
          .filter(Boolean);
        setSavedEntries(resolved);
      })
      .catch(() => {
        // Silently ignore — user just won't see resume cards
      });

    return () => { cancelled = true; };
  }, [effectiveUser, authUser]);

  // Handlers
  const handleOnboardingAnswer = useCallback((questionId, value) => {
    setOnboardingAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleOnboardingNext = useCallback(() => {
    if (onboardingStep < ONBOARDING_QUESTIONS.length - 1) {
      setOnboardingStep((s) => s + 1);
    } else {
      setShowOnboarding(false);
      setShowAssessment(true);
    }
  }, [onboardingStep]);

  const handleOnboardingBack = useCallback(() => {
    if (onboardingStep > 0) setOnboardingStep((s) => s - 1);
  }, [onboardingStep]);

  const handleAssessmentAnswer = useCallback((optionIndex) => {
    const q = ASSESSMENT_QUESTIONS[assessmentStep];
    setAssessmentAnswers((prev) => {
      const next = [...prev];
      next[assessmentStep] = { questionId: q.id, selectedOption: optionIndex };
      return next;
    });
  }, [assessmentStep]);

  const handleAssessmentNext = useCallback(() => {
    if (assessmentStep < ASSESSMENT_QUESTIONS.length - 1) {
      setAssessmentStep((s) => s + 1);
    } else {
      const calculatedSkills = calculateSkillLevels(assessmentAnswers);
      const plan = generateStudyPlan({
        skills: calculatedSkills,
        timeCommitment: onboardingAnswers.pace || "moderate",
        planDuration: 30,
        problemsCompleted: user?.stats?.problemsCompleted || [],
      });

      const updatedRoadmap = {
        ...roadmapData,
        assessmentComplete: true,
        onboardingComplete: true,
        skills: calculatedSkills,
        currentPlan: plan,
        onboardingAnswers,
        assessmentDate: new Date().toISOString(),
      };

      const baseUser = user || (authUser ? ensureLocalUser(authUser) : null);
      const updatedUser = { ...baseUser, roadmap: updatedRoadmap };
      localStorage.setItem("code_interviewer_current_user", JSON.stringify(updatedUser));
      const users = JSON.parse(localStorage.getItem("code_interviewer_users") || "{}");
      if (updatedUser.id && users[updatedUser.id]) {
        users[updatedUser.id] = { ...users[updatedUser.id], roadmap: updatedRoadmap };
        localStorage.setItem("code_interviewer_users", JSON.stringify(users));
      }

      setUser(updatedUser);
      setShowAssessment(false);
      setAssessmentComplete(true);
    }
  }, [assessmentStep, assessmentAnswers, onboardingAnswers, user, roadmapData]);

  const handleAssessmentBack = useCallback(() => {
    if (assessmentStep > 0) setAssessmentStep((s) => s - 1);
  }, [assessmentStep]);

  const handleStartProblem = useCallback((problemId) => {
    navigate(`/practice/solve/${problemId}`);
  }, [navigate]);

  const handleRetakeAssessment = useCallback(() => {
    setOnboardingStep(0);
    setOnboardingAnswers({});
    setAssessmentStep(0);
    setAssessmentAnswers([]);
    setShowOnboarding(true);
    setShowAssessment(false);
    setAssessmentComplete(false);
  }, []);

  const handleLogout = useCallback(async () => {
    logoutUser();
    setUser(null);
    await firebaseLogOut();
    navigate("/", { replace: true });
  }, [firebaseLogOut, navigate]);

  const handleUserUpdate = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  const currentOnboardingQ = ONBOARDING_QUESTIONS[onboardingStep];
  const currentAssessmentQ = ASSESSMENT_QUESTIONS[assessmentStep];
  const canProceedOnboarding = onboardingAnswers[currentOnboardingQ?.id] !== undefined;
  const canProceedAssessment = assessmentAnswers[assessmentStep] !== undefined;
  const getSkillInfo = (id) => SKILL_CATEGORIES.find((s) => s.id === id) || { name: id, icon: "📊" };

  // ── RENDER: Onboarding Questionnaire ──
  if (showOnboarding) {
    const progress = ((onboardingStep + 1) / ONBOARDING_QUESTIONS.length) * 100;
    return (
      <div className="practice-dash">
        <div className="practice-dash__blob practice-dash__blob--1" />
        <div className="practice-dash__blob practice-dash__blob--2" />
        <header className="practice-dash__header">
          <div className="practice-dash__brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
            <span className="practice-dash__logo-icon">&#x1F4BB;</span>
            <span className="practice-dash__logo-text">CodePractice</span>
          </div>
        </header>

        <main className="practice-dash__onboarding">
          <div className="onboarding">
            <div className="onboarding__progress">
              <div className="onboarding__progress-bar">
                <div className="onboarding__progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="onboarding__step-counter">
                {onboardingStep + 1} / {ONBOARDING_QUESTIONS.length}
              </span>
            </div>

            <div className="onboarding__card" key={currentOnboardingQ.id}>
              <span className="onboarding__icon">{currentOnboardingQ.icon}</span>
              <h2 className="onboarding__question">{currentOnboardingQ.question}</h2>

              <div className="onboarding__options">
                {currentOnboardingQ.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`onboarding__option ${onboardingAnswers[currentOnboardingQ.id] === opt.value ? "onboarding__option--selected" : ""}`}
                    onClick={() => handleOnboardingAnswer(currentOnboardingQ.id, opt.value)}
                  >
                    <span className="onboarding__option-icon">{opt.icon}</span>
                    <span className="onboarding__option-label">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="onboarding__actions">
                <button
                  type="button"
                  className="onboarding__btn onboarding__btn--back"
                  onClick={handleOnboardingBack}
                  disabled={onboardingStep === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="onboarding__btn onboarding__btn--next"
                  onClick={handleOnboardingNext}
                  disabled={!canProceedOnboarding}
                >
                  {onboardingStep === ONBOARDING_QUESTIONS.length - 1 ? "Continue to Skill Check" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── RENDER: Skill Assessment Quiz ──
  if (showAssessment) {
    const assessProgress = ((assessmentStep + 1) / ASSESSMENT_QUESTIONS.length) * 100;
    const skillInfo = getSkillInfo(currentAssessmentQ?.category);
    return (
      <div className="practice-dash">
        <div className="practice-dash__blob practice-dash__blob--1" />
        <div className="practice-dash__blob practice-dash__blob--2" />
        <header className="practice-dash__header">
          <div className="practice-dash__brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
            <span className="practice-dash__logo-icon">&#x1F4BB;</span>
            <span className="practice-dash__logo-text">CodePractice</span>
          </div>
        </header>

        <main className="practice-dash__onboarding">
          <div className="onboarding">
            <div className="onboarding__progress">
              <div className="onboarding__progress-bar">
                <div className="onboarding__progress-fill" style={{ width: `${assessProgress}%` }} />
              </div>
              <span className="onboarding__step-counter">
                Skill Check &mdash; {assessmentStep + 1} / {ASSESSMENT_QUESTIONS.length}
              </span>
            </div>

            <div className="onboarding__card" key={currentAssessmentQ.id}>
              <div className="onboarding__category-badge">
                {skillInfo.icon} {skillInfo.name}
              </div>
              <h2 className="onboarding__question">{currentAssessmentQ.question}</h2>

              <div className="onboarding__options">
                {currentAssessmentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`onboarding__option onboarding__option--quiz ${assessmentAnswers[assessmentStep]?.selectedOption === idx ? "onboarding__option--selected" : ""}`}
                    onClick={() => handleAssessmentAnswer(idx)}
                  >
                    <span className="onboarding__option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="onboarding__option-label">{opt}</span>
                  </button>
                ))}
              </div>

              <div className="onboarding__actions">
                <button
                  type="button"
                  className="onboarding__btn onboarding__btn--back"
                  onClick={handleAssessmentBack}
                  disabled={assessmentStep === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="onboarding__btn onboarding__btn--next"
                  onClick={handleAssessmentNext}
                  disabled={!canProceedAssessment}
                >
                  {assessmentStep === ASSESSMENT_QUESTIONS.length - 1 ? "Generate My Roadmap" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── RENDER: Practice Dashboard (Roadmap + Problem Selection) ──
  return (
    <div className="practice-dash">
      <div className="practice-dash__blob practice-dash__blob--1" />
      <div className="practice-dash__blob practice-dash__blob--2" />

      {/* Header */}
      <header className="practice-dash__header">
        <div className="practice-dash__brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
          <span className="practice-dash__logo-icon">&#x1F4BB;</span>
          <span className="practice-dash__logo-text">CodePractice</span>
        </div>

        <div className="practice-dash__header-actions">
          <button
            type="button"
            className="practice-dash__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
          </button>

          <button
            type="button"
            className="practice-dash__header-btn"
            onClick={() => setShowAchievements(true)}
          >
            <span className="practice-dash__header-btn-icon">&#x1F3C6;</span>
            <span className="practice-dash__header-btn-text">Achievements</span>
          </button>

          {effectiveUser && (
            <button
              type="button"
              className="practice-dash__avatar-btn"
              onClick={() => setShowProfile(true)}
              aria-label="View profile"
            >
              <span className="practice-dash__avatar">
                {(effectiveUser.username || effectiveUser.email || "U").charAt(0).toUpperCase()}
              </span>
              <div className="practice-dash__avatar-info">
                <span className="practice-dash__avatar-name">
                  {effectiveUser.username || effectiveUser.email}
                </span>
                <span className="practice-dash__avatar-level">Level {level}</span>
              </div>
            </button>
          )}
        </div>
      </header>

      <main className="practice-dash__main">
        {/* Hero Stats Row */}
        <section className="practice-dash__hero">
          <div className="practice-dash__hero-text">
            <h1 className="practice-dash__title">
              {effectiveUser ? `Welcome back, ${(effectiveUser.username || effectiveUser.email || "").split("@")[0]}` : "Your Practice Hub"}
            </h1>
            <p className="practice-dash__subtitle">
              {assessmentComplete
                ? "Here's your personalized roadmap. Pick a problem and start coding."
                : "Complete the skill assessment to unlock your personalized roadmap."}
            </p>
          </div>

          <div className="practice-dash__stats-row">
            <div className="practice-dash__stat">
              <span className="practice-dash__stat-icon">&#x1F525;</span>
              <span className="practice-dash__stat-value">{streak}</span>
              <span className="practice-dash__stat-label">Day Streak</span>
            </div>
            <div className="practice-dash__stat">
              <span className="practice-dash__stat-icon">&#x2B50;</span>
              <span className="practice-dash__stat-value">{xp.toLocaleString()}</span>
              <span className="practice-dash__stat-label">XP Earned</span>
            </div>
            <div className="practice-dash__stat">
              <span className="practice-dash__stat-icon">&#x2705;</span>
              <span className="practice-dash__stat-value">{completedCount}/{totalProblems}</span>
              <span className="practice-dash__stat-label">Solved</span>
            </div>
            <div className="practice-dash__stat">
              <span className="practice-dash__stat-icon">&#x1F4C8;</span>
              <span className="practice-dash__stat-value">Lv.{level}</span>
              <span className="practice-dash__stat-label">
                <div className="practice-dash__level-bar">
                  <div className="practice-dash__level-fill" style={{ width: `${levelProgress}%` }} />
                </div>
              </span>
            </div>
          </div>
        </section>

        {/* Skills Snapshot (if assessment done) */}
        {assessmentComplete && Object.keys(skills).length > 0 && (
          <section className="practice-dash__skills">
            <div className="practice-dash__section-header">
              <h2>Your Skill Map</h2>
              <button
                type="button"
                className="practice-dash__text-btn"
                onClick={handleRetakeAssessment}
              >
                Retake Assessment
              </button>
            </div>
            <div className="practice-dash__skills-grid">
              {SKILL_CATEGORIES.slice(0, 8).map((skill) => {
                const data = skills[skill.id] || { score: 0, level: "beginner" };
                const isWeak = weakAreas.includes(skill.id);
                return (
                  <div
                    key={skill.id}
                    className={`practice-dash__skill-card ${isWeak ? "practice-dash__skill-card--weak" : ""}`}
                  >
                    <div className="practice-dash__skill-top">
                      <span className="practice-dash__skill-icon">{skill.icon}</span>
                      <span className="practice-dash__skill-name">{skill.name}</span>
                    </div>
                    <div className="practice-dash__skill-bar">
                      <div
                        className={`practice-dash__skill-fill practice-dash__skill-fill--${data.level}`}
                        style={{ width: `${data.score}%` }}
                      />
                    </div>
                    <div className="practice-dash__skill-meta">
                      <span className="practice-dash__skill-level">{data.level}</span>
                      {isWeak && <span className="practice-dash__skill-focus">Focus Area</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recommended For You */}
        {recommendations.length > 0 && (
          <section className="practice-dash__recommended">
            <div className="practice-dash__section-header">
              <h2>Recommended For You</h2>
            </div>
            <div className="practice-dash__recs-grid">
              {recommendations.map((rec, i) => {
                const isCompleted = problemsCompleted.includes(rec.problem.id);
                return (
                  <button
                    key={rec.problem.id}
                    type="button"
                    className={`practice-dash__rec-card practice-dash__rec-card--${rec.priority}`}
                    onClick={() => handleStartProblem(rec.problem.id)}
                  >
                    <div className="practice-dash__rec-rank">#{i + 1}</div>
                    <div className="practice-dash__rec-body">
                      <div className="practice-dash__rec-title-row">
                        <h3 className="practice-dash__rec-title">{rec.problem.title}</h3>
                        <span className={`practice-dash__rec-diff practice-dash__rec-diff--${rec.problem.difficulty.toLowerCase()}`}>
                          {rec.problem.difficulty}
                        </span>
                      </div>
                      <p className="practice-dash__rec-reason">{rec.reason}</p>
                      <div className="practice-dash__rec-meta">
                        <span>{rec.problem.category}</span>
                        <span>~{Math.round((rec.problem.timeLimit || 1800) / 60)} min</span>
                        {isCompleted && <span className="practice-dash__rec-solved">Solved</span>}
                      </div>
                    </div>
                    <span className="practice-dash__rec-arrow">&rarr;</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Resume Where You Left Off */}
        {savedEntries.length > 0 && (
          <section className="practice-dash__resume">
            <div className="practice-dash__section-header">
              <h2>Resume Where You Left Off</h2>
            </div>
            <div className="practice-dash__resume-grid">
              {savedEntries.map((entry) => {
                const isCompleted = problemsCompleted.includes(entry.problemId);
                const savedDate = new Date(entry.savedAt);
                const timeAgo = getTimeAgo(savedDate);
                return (
                  <button
                    key={entry.problemId}
                    type="button"
                    className="practice-dash__resume-card"
                    onClick={() => handleStartProblem(entry.problemId)}
                  >
                    <div className="practice-dash__resume-icon-col">
                      <span className="practice-dash__resume-icon">&#x1F4DD;</span>
                    </div>
                    <div className="practice-dash__resume-body">
                      <div className="practice-dash__resume-title-row">
                        <h3 className="practice-dash__resume-title">{entry.problem.title}</h3>
                        <span className={`practice-dash__resume-diff practice-dash__resume-diff--${entry.problem.difficulty.toLowerCase()}`}>
                          {entry.problem.difficulty}
                        </span>
                        {isCompleted && <span className="practice-dash__resume-solved">Solved</span>}
                      </div>
                      <div className="practice-dash__resume-meta">
                        <span className="practice-dash__resume-cat">{entry.problem.category}</span>
                        <span className="practice-dash__resume-time">Saved {timeAgo}</span>
                      </div>
                    </div>
                    <span className="practice-dash__resume-arrow">Resume &rarr;</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* All Problems */}
        <section className="practice-dash__problems">
          <div className="practice-dash__section-header">
            <h2>All Problems</h2>
          </div>

          <div className="practice-dash__filters">
            <div className="practice-dash__filter-group">
              <button
                type="button"
                className={`practice-dash__filter-chip ${activeCategory === "all" ? "practice-dash__filter-chip--active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                All Topics
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`practice-dash__filter-chip ${activeCategory === cat ? "practice-dash__filter-chip--active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="practice-dash__filter-group">
              <button
                type="button"
                className={`practice-dash__filter-chip ${activeDifficulty === "all" ? "practice-dash__filter-chip--active" : ""}`}
                onClick={() => setActiveDifficulty("all")}
              >
                All Levels
              </button>
              {difficulties.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`practice-dash__filter-chip practice-dash__filter-chip--${d.toLowerCase()} ${activeDifficulty === d ? "practice-dash__filter-chip--active" : ""}`}
                  onClick={() => setActiveDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="practice-dash__problem-grid">
            {filteredProblems.map((problem) => {
              const isCompleted = problemsCompleted.includes(problem.id);
              return (
                <button
                  key={problem.id}
                  type="button"
                  className={`practice-dash__problem-card ${isCompleted ? "practice-dash__problem-card--solved" : ""}`}
                  onClick={() => handleStartProblem(problem.id)}
                >
                  <div className="practice-dash__problem-top">
                    <span className={`practice-dash__problem-diff practice-dash__problem-diff--${problem.difficulty.toLowerCase()}`}>
                      {problem.difficulty}
                    </span>
                    {isCompleted && <span className="practice-dash__problem-check">&#x2713;</span>}
                  </div>
                  <h3 className="practice-dash__problem-title">{problem.title}</h3>
                  <span className="practice-dash__problem-cat">{problem.category}</span>
                  <span className="practice-dash__problem-cta">
                    {isCompleted ? "Solve Again" : "Start Solving"} &rarr;
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Achievements Modal */}
      {showAchievements && user && (
        <div className="practice-dash__modal-overlay" onClick={() => setShowAchievements(false)}>
          <div className="practice-dash__modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="practice-dash__modal-close"
              onClick={() => setShowAchievements(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <GamificationPanel
              inline
              user={user}
              onUserUpdate={handleUserUpdate}
            />
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && user && (
        <UserProfile
          user={user}
          onClose={() => setShowProfile(false)}
          problems={PROBLEMS}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  COMPANY_FOCUS,
  SKILLS,
  defaultQuizAnswers,
  evaluateRoadmapMilestones,
  generatePersonalizedPlan,
  getDailyProblemRecommendations,
  getSkillLabel,
  normalizeRoadmapState,
  scoreQuizAnswers,
  toLocalDayKey,
  toggleTaskCompletion
} from "./roadmap.js";

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(x)))}%`;
}

export default function RoadmapPanel({
  roadmap,
  problems,
  solvedByProblemId,
  onSelectProblem,
  onUpdateRoadmap,
  onToast
}) {
  const normalized = useMemo(() => normalizeRoadmapState(roadmap), [roadmap]);
  const todayKey = useMemo(() => toLocalDayKey(Date.now()), []);

  const [draftCompany, setDraftCompany] = useState(normalized.settings.targetCompany);
  const [draftPlanDays, setDraftPlanDays] = useState(normalized.settings.planDays);
  const [draftMinutes, setDraftMinutes] = useState(normalized.settings.minutesPerDay);

  const [quizAnswers, setQuizAnswers] = useState(() => {
    const base = defaultQuizAnswers();
    const merged = { ...base, ...(normalized.quiz.answers || {}) };
    return merged;
  });

  const plan = normalized.plan.days || [];
  const todayPlan = todayKey ? plan.find((d) => d.dayKey === todayKey) : null;

  const totals = useMemo(() => {
    let totalTasks = 0;
    for (const d of plan) totalTasks += (d.tasks || []).length;
    const completed = Object.keys(normalized.progress.completedTaskIds || {}).length;
    return { totalTasks, completed, percent: totalTasks > 0 ? (completed / totalTasks) * 100 : 0 };
  }, [plan, normalized.progress.completedTaskIds]);

  const recommendations = useMemo(() => {
    return getDailyProblemRecommendations({
      state: normalized,
      problems,
      solvedByProblemId,
      limit: 3
    });
  }, [normalized, problems, solvedByProblemId]);

  const canGenerate = Boolean(Array.isArray(problems) && problems.length > 0);

  const handleGenerate = () => {
    if (!canGenerate) return;
    onUpdateRoadmap?.((prev) => {
      const p = normalizeRoadmapState(prev);
      const next = generatePersonalizedPlan({
        prevState: {
          ...p,
          settings: {
            ...p.settings,
            targetCompany: String(draftCompany || "General"),
            planDays: Number(draftPlanDays) || 30,
            minutesPerDay: Number(draftMinutes) || 60
          }
        },
        problems,
        solvedByProblemId,
        nowTs: Date.now()
      });
      const { nextState, unlocked } = evaluateRoadmapMilestones({ prevState: p, nextState: next, nowTs: Date.now() });
      for (const m of unlocked) {
        onToast?.("success", m.name, m.description);
      }
      return nextState;
    });
    onToast?.("success", "Roadmap updated", `Generated a ${draftPlanDays}-day plan (${draftMinutes} min/day).`);
  };

  const handleSubmitQuiz = () => {
    onUpdateRoadmap?.((prev) => {
      const p = normalizeRoadmapState(prev);
      const scores = scoreQuizAnswers(quizAnswers);
      const next = {
        ...p,
        quiz: {
          completedAt: Date.now(),
          answers: { ...quizAnswers },
          scores
        }
      };
      const { nextState, unlocked } = evaluateRoadmapMilestones({ prevState: p, nextState: next, nowTs: Date.now() });
      for (const m of unlocked) {
        onToast?.("success", m.name, m.description);
      }
      return nextState;
    });
    onToast?.("success", "Assessment saved", "Your roadmap will prioritize weaker areas.");
  };

  const handleToggleTask = (taskId, checked) => {
    onUpdateRoadmap?.((prev) => {
      const p = normalizeRoadmapState(prev);
      const next = toggleTaskCompletion({ prevState: p, taskId, completed: checked, nowTs: Date.now() });
      const { nextState, unlocked } = evaluateRoadmapMilestones({ prevState: p, nextState: next, nowTs: Date.now() });
      for (const m of unlocked) {
        onToast?.("success", m.name, m.description);
      }
      return nextState;
    });
  };

  return (
    <section className="panel panel--roadmap">
      <div className="panel__header panel__header--roadmap">
        <div className="roadmap__title">
          <span>Roadmap</span>
          <span className="roadmap__badge">{COMPANY_FOCUS[normalized.settings.targetCompany]?.label || "General"}</span>
        </div>
        <div className="roadmap__progress" title="Roadmap task completion">
          <div className="roadmap__progress-label">
            {totals.completed}/{totals.totalTasks} tasks ({pct(totals.percent)})
          </div>
          <div className="roadmap__bar" aria-hidden="true">
            <div className="roadmap__bar-fill" style={{ width: pct(totals.percent) }} />
          </div>
        </div>
      </div>

      <div className="roadmap">
        <div className="roadmap__section">
          <div className="roadmap__section-title">Plan settings</div>
          <div className="roadmap__settings">
            <label className="roadmap__field">
              <span className="roadmap__label">Company</span>
              <select value={draftCompany} onChange={(e) => setDraftCompany(e.target.value)} aria-label="Target company">
                {Object.keys(COMPANY_FOCUS).map((k) => (
                  <option key={k} value={k}>
                    {COMPANY_FOCUS[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="roadmap__field">
              <span className="roadmap__label">Plan length</span>
              <select
                value={draftPlanDays}
                onChange={(e) => setDraftPlanDays(Number(e.target.value))}
                aria-label="Plan length"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <label className="roadmap__field">
              <span className="roadmap__label">Time/day</span>
              <select
                value={draftMinutes}
                onChange={(e) => setDraftMinutes(Number(e.target.value))}
                aria-label="Minutes per day"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </label>
          </div>

          <div className="roadmap__actions">
            <button type="button" className="roadmap__btn" onClick={handleGenerate} disabled={!canGenerate}>
              Generate / refresh plan
            </button>
          </div>
        </div>

        <div className="roadmap__section">
          <div className="roadmap__section-title">Skill assessment</div>
          <div className="roadmap__muted">
            Rate each area from 1 (weak) to 5 (strong). This drives personalization.
          </div>

          <div className="roadmap__quiz">
            {SKILLS.map((s) => (
              <label key={s.id} className="roadmap__quiz-row">
                <span className="roadmap__quiz-skill">{s.label}</span>
                <select
                  value={quizAnswers[s.id] ?? 3}
                  onChange={(e) =>
                    setQuizAnswers((prev) => ({
                      ...prev,
                      [s.id]: Number(e.target.value)
                    }))
                  }
                  aria-label={`Skill rating: ${s.label}`}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
            ))}
          </div>

          <div className="roadmap__actions">
            <button type="button" className="roadmap__btn roadmap__btn--ghost" onClick={handleSubmitQuiz}>
              Save assessment
            </button>
            {normalized.quiz.completedAt ? (
              <div className="roadmap__muted">Last saved: {new Date(normalized.quiz.completedAt).toLocaleString()}</div>
            ) : (
              <div className="roadmap__muted">Not saved yet.</div>
            )}
          </div>
        </div>

        <div className="roadmap__section">
          <div className="roadmap__section-title">Today</div>
          {!todayPlan ? (
            <div className="roadmap__muted">
              No tasks scheduled for today yet. Generate a plan to get daily tasks.
            </div>
          ) : (
            <div className="roadmap__tasks">
              {(todayPlan.tasks || []).map((t) => {
                const checked = Boolean(normalized.progress.completedTaskIds?.[t.id]);
                return (
                  <label key={t.id} className={`roadmap__task ${checked ? "is-done" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleToggleTask(t.id, e.target.checked)}
                      aria-label={`Mark complete: ${t.title}`}
                    />
                    <div className="roadmap__task-main">
                      <div className="roadmap__task-title">{t.title}</div>
                      <div className="roadmap__task-meta">
                        {t.minutes ? `${t.minutes} min` : null}
                        {t.skillId ? ` · ${getSkillLabel(t.skillId)}` : null}
                      </div>
                    </div>
                    {t.problemId ? (
                      <button
                        type="button"
                        className="roadmap__task-link"
                        onClick={() => onSelectProblem?.(t.problemId)}
                        aria-label={`Open problem: ${t.problemId}`}
                        title="Open this problem"
                      >
                        Open
                      </button>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="roadmap__section">
          <div className="roadmap__section-title">Daily recommendations</div>
          <div className="roadmap__recs">
            {recommendations.length === 0 ? (
              <div className="roadmap__muted">No recommendations yet.</div>
            ) : (
              recommendations.map((r) => (
                <button
                  key={r.problemId}
                  type="button"
                  className="roadmap__rec"
                  onClick={() => onSelectProblem?.(r.problemId)}
                  aria-label={`Open recommended problem: ${r.title}`}
                >
                  <div className="roadmap__rec-title">{r.title}</div>
                  <div className="roadmap__rec-meta">
                    {r.skillId ? `Focus: ${getSkillLabel(r.skillId)}` : "Focus: mixed"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="roadmap__section">
          <div className="roadmap__section-title">Milestones</div>
          <div className="roadmap__milestones">
            {Object.values(normalized.progress.milestones || {}).length === 0 ? (
              <div className="roadmap__muted">No milestones yet. Save the assessment and complete tasks.</div>
            ) : (
              Object.values(normalized.progress.milestones || {})
                .sort((a, b) => Number(b?.unlockedAt || 0) - Number(a?.unlockedAt || 0))
                .slice(0, 6)
                .map((m) => (
                  <div key={m.id} className="roadmap__milestone">
                    <div className="roadmap__milestone-name">{m.name}</div>
                    <div className="roadmap__milestone-desc">{m.description}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


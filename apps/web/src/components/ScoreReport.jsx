import { memo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function ScoreReport({
  isVisible,
  totalScore,
  grade,
  timeSummary,
  efficiencySummary,
  hintsSummary,
  testsSummary,
  breakdown,
  history,
  onToggleDetails,
  isDetailsVisible,
  aiFeedback,
  detailedAnalysis,
  mode = "practice"
}) {
  const isPractice = mode === "practice";
  if (!isVisible) {
    return null;
  }

  const pieData = breakdown.map((item) => ({
    name: item.label,
    value: item.weight
  }));
  const pieColors = ["#6366f1", "#22c55e", "#f59e0b", "#38bdf8"];

  return (
    <section className="panel panel--report">
      <div className="panel__header">{isPractice ? "Practice Summary" : "Interview Performance Report"}</div>
      <div className="report">
        <div className="report__summary">
          <div className="report__score">
            <span>Overall Score</span>
            <strong>
              {totalScore}/100 <span className="report__grade">[{grade}]</span>
            </strong>
          </div>
          <p className="report__note">{aiFeedback}</p>
        </div>

        <div className="report__cards">
          <article className="report__card">
            <h3>Time Taken</h3>
            <p className="report__meta">
              {formatTime(timeSummary.takenSeconds)} /{" "}
              {formatTime(timeSummary.limitSeconds)}
            </p>
            <p className="report__scoreline">{timeSummary.score}/100</p>
            <p className="report__hint">{timeSummary.note}</p>
          </article>
          <article className="report__card">
            <h3>Code Efficiency</h3>
            <p className="report__meta">{efficiencySummary.label}</p>
            <p className="report__scoreline">{efficiencySummary.score}/100</p>
            <p className="report__hint">{efficiencySummary.note}</p>
          </article>
          <article className="report__card">
            <h3>Hints Used</h3>
            <p className="report__meta">{hintsSummary.count} total</p>
            <p className="report__scoreline">{hintsSummary.score}/100</p>
            <p className="report__hint">{hintsSummary.note}</p>
          </article>
          <article className="report__card">
            <h3>Test Cases</h3>
            <p className="report__meta">{testsSummary.passed} / 5 passed</p>
            <p className="report__scoreline">{testsSummary.score}/100</p>
            <p className="report__hint">{testsSummary.note}</p>
          </article>
        </div>

        <div className="report__charts">
          <div className="report__chart">
            <h4>Score Breakdown</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdown}>
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {breakdown.map((entry, index) => (
                    <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="report__chart">
            <h4>Time Performance</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <XAxis dataKey="session" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="report__chart">
            <h4>Score Distribution</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="report__actions">
          <button type="button" onClick={onToggleDetails}>
            {isDetailsVisible ? "Hide Detailed Analysis" : "View Detailed Analysis"}
          </button>
          <button type="button" className="report__secondary">
            Try Another Problem
          </button>
        </div>

        {isDetailsVisible && (
          <div className="report__details">
            <div>
              <h4>Code Review</h4>
              <ul>
                {detailedAnalysis.review.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Performance Comparison</h4>
              <p>Your time: {detailedAnalysis.comparison.userTime}</p>
              <p>Average time: {detailedAnalysis.comparison.avgTime}</p>
              <p>Top 10% time: {detailedAnalysis.comparison.topTime}</p>
            </div>
            <div>
              <h4>Historical Performance</h4>
              <ul>
                {detailedAnalysis.history.map((item) => (
                  <li key={item.problem}>
                    {item.problem}: {item.score}/100
                  </li>
                ))}
              </ul>
              <p className="report__average">
                Average score: {detailedAnalysis.average}/100
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(ScoreReport);

// Polling-based code sync service.
// Candidate side: pushes code every PUSH_INTERVAL_MS.
// Interviewer side: polls code every POLL_INTERVAL_MS.

import { pushCode, pullCode } from "./sessionService.js";

const PUSH_INTERVAL_MS = 2000;
const POLL_INTERVAL_MS = 2000;

// ─── Candidate push loop ────────────────────────────────────────────

export function createCodePusher({ sessionId, candidateId, questionId, getCode }) {
  let lastPushed = "";
  let timer = null;
  let stopped = false;

  const push = async () => {
    if (stopped) return;
    const code = typeof getCode === "function" ? getCode() : "";
    if (code === lastPushed) return;
    lastPushed = code;
    try {
      await pushCode(sessionId, candidateId, { code, questionId });
    } catch {
      // swallow – next cycle will retry
    }
  };

  const start = () => {
    if (timer) return;
    stopped = false;
    timer = setInterval(push, PUSH_INTERVAL_MS);
    push(); // immediate first push
  };

  const stop = () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const updateQuestion = (qid) => {
    questionId = qid;
    lastPushed = ""; // force re-push on question change
  };

  return { start, stop, updateQuestion };
}

// ─── Interviewer poll loop ──────────────────────────────────────────

export function createCodePoller({ sessionId, candidateId, questionId, onCode }) {
  let timer = null;
  let stopped = false;
  let currentQuestionId = questionId;
  let currentCandidateId = candidateId;

  const poll = async () => {
    if (stopped) return;
    try {
      const data = await pullCode(sessionId, currentCandidateId, currentQuestionId);
      if (data && typeof onCode === "function") {
        onCode(data);
      }
    } catch {
      // swallow
    }
  };

  const start = () => {
    if (timer) return;
    stopped = false;
    timer = setInterval(poll, POLL_INTERVAL_MS);
    poll();
  };

  const stop = () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const switchCandidate = (cid) => {
    currentCandidateId = cid;
  };

  const switchQuestion = (qid) => {
    currentQuestionId = qid;
  };

  return { start, stop, switchCandidate, switchQuestion };
}

import { readLocalStorageJson, writeLocalStorageJson } from "./storage.js";

export function userKey(userId, suffix) {
  const id = userId ? String(userId) : "guest";
  return `ici.user.${id}.${suffix}`;
}

export function loadUserJson(userId, suffix, fallback) {
  return readLocalStorageJson(userKey(userId, suffix), fallback);
}

export function saveUserJson(userId, suffix, value) {
  return writeLocalStorageJson(userKey(userId, suffix), value);
}

export function loadUserState(userId) {
  const codeByProblemId = loadUserJson(userId, "codeByProblemId", {});
  const solvedByProblemId = loadUserJson(userId, "solvedByProblemId", {});
  const testRunByProblemId = loadUserJson(userId, "testRunByProblemId", {});
  const attemptStartedAtByProblemId = loadUserJson(userId, "attemptStartedAtByProblemId", {});
  const bestTimeSecondsByProblemId = loadUserJson(userId, "bestTimeSecondsByProblemId", {});
  const approachNotesByProblemId = loadUserJson(userId, "approachNotesByProblemId", {});
  const multiPracticeSession = loadUserJson(userId, "multiPracticeSession", null);
  const history = loadUserJson(userId, "history", []);
  const replayIndex = loadUserJson(userId, "replayIndex", []);

  return {
    codeByProblemId: codeByProblemId && typeof codeByProblemId === "object" ? codeByProblemId : {},
    solvedByProblemId:
      solvedByProblemId && typeof solvedByProblemId === "object" ? solvedByProblemId : {},
    testRunByProblemId:
      testRunByProblemId && typeof testRunByProblemId === "object" ? testRunByProblemId : {},
    attemptStartedAtByProblemId:
      attemptStartedAtByProblemId && typeof attemptStartedAtByProblemId === "object"
        ? attemptStartedAtByProblemId
        : {},
    bestTimeSecondsByProblemId:
      bestTimeSecondsByProblemId && typeof bestTimeSecondsByProblemId === "object"
        ? bestTimeSecondsByProblemId
        : {},
    approachNotesByProblemId:
      approachNotesByProblemId && typeof approachNotesByProblemId === "object"
        ? approachNotesByProblemId
        : {},
    multiPracticeSession: multiPracticeSession && typeof multiPracticeSession === "object" ? multiPracticeSession : null,
    history: Array.isArray(history) ? history : [],
    replayIndex: Array.isArray(replayIndex) ? replayIndex : []
  };
}


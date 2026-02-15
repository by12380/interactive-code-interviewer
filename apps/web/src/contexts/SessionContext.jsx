// SessionContext – shared state for an active interview session.
// Used by both the Candidate view and Interviewer live-monitor.

import { createContext, useContext, useReducer, useCallback } from "react";

const SessionContext = createContext(null);

const initialState = {
  session: null,        // { id, title, status, shareCode, settings, questionIds, createdBy }
  questions: [],        // resolved question objects
  candidates: [],       // [{ id, userId, displayName, status }]
  currentQuestionId: null,
  selectedCandidateId: null,
  candidateCode: {},    // { [candidateId]: { code, lastUpdatedAt } }
  evaluations: {},      // { [candidateId]: evaluation }
  comparison: null,     // comparative ranking
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, session: action.payload };
    case "SET_QUESTIONS":
      return { ...state, questions: action.payload };
    case "SET_CANDIDATES":
      return { ...state, candidates: action.payload };
    case "ADD_CANDIDATE":
      return {
        ...state,
        candidates: state.candidates.some((c) => c.id === action.payload.id)
          ? state.candidates
          : [...state.candidates, action.payload],
      };
    case "SET_CURRENT_QUESTION":
      return { ...state, currentQuestionId: action.payload };
    case "SELECT_CANDIDATE":
      return { ...state, selectedCandidateId: action.payload };
    case "UPDATE_CANDIDATE_CODE":
      return {
        ...state,
        candidateCode: {
          ...state.candidateCode,
          [action.payload.candidateId]: {
            code: action.payload.code,
            lastUpdatedAt: action.payload.lastUpdatedAt || Date.now(),
          },
        },
      };
    case "SET_EVALUATION":
      return {
        ...state,
        evaluations: {
          ...state.evaluations,
          [action.payload.candidateId]: action.payload.evaluation,
        },
      };
    case "SET_COMPARISON":
      return { ...state, comparison: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setSession = useCallback((s) => dispatch({ type: "SET_SESSION", payload: s }), []);
  const setQuestions = useCallback((q) => dispatch({ type: "SET_QUESTIONS", payload: q }), []);
  const setCandidates = useCallback((c) => dispatch({ type: "SET_CANDIDATES", payload: c }), []);
  const addCandidate = useCallback((c) => dispatch({ type: "ADD_CANDIDATE", payload: c }), []);
  const setCurrentQuestion = useCallback((id) => dispatch({ type: "SET_CURRENT_QUESTION", payload: id }), []);
  const selectCandidate = useCallback((id) => dispatch({ type: "SELECT_CANDIDATE", payload: id }), []);
  const updateCandidateCode = useCallback((candidateId, code, lastUpdatedAt) =>
    dispatch({ type: "UPDATE_CANDIDATE_CODE", payload: { candidateId, code, lastUpdatedAt } }), []);
  const setEvaluation = useCallback((candidateId, evaluation) =>
    dispatch({ type: "SET_EVALUATION", payload: { candidateId, evaluation } }), []);
  const setComparison = useCallback((c) => dispatch({ type: "SET_COMPARISON", payload: c }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <SessionContext.Provider
      value={{
        ...state,
        setSession,
        setQuestions,
        setCandidates,
        addCandidate,
        setCurrentQuestion,
        selectCandidate,
        updateCandidateCode,
        setEvaluation,
        setComparison,
        reset,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

export default SessionContext;

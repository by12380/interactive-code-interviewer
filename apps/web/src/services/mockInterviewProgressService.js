import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

function getProgressRef(uid) {
  return doc(db, "users", uid, "mockInterviewProgress", "current");
}

function toSerializable(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function loadMockInterviewProgress(uid) {
  if (!uid) return null;

  const snap = await getDoc(getProgressRef(uid));
  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function saveMockInterviewProgress(uid, payload) {
  if (!uid) {
    throw new Error("User is required to save mock interview progress.");
  }

  const data = toSerializable(payload);
  await setDoc(
    getProgressRef(uid),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

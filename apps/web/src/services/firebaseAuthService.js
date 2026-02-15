// Firebase Authentication service – wraps Firebase Auth with role management.
// Roles are stored in Firestore users/{uid} document.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

// ─── Helpers ────────────────────────────────────────────────────────

async function ensureUserDoc(uid, { displayName, email, role }) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName || "",
      email: email || "",
      role: role || "candidate",
      createdAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data();
}

// ─── Public API ─────────────────────────────────────────────────────

export async function firebaseSignUp({ email, password, displayName, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  const userData = await ensureUserDoc(cred.user.uid, { displayName, email, role });
  return { uid: cred.user.uid, email, displayName, ...userData };
}

export async function firebaseLogin({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const ref = doc(db, "users", cred.user.uid);
  const snap = await getDoc(ref);
  const userData = snap.exists() ? snap.data() : {};
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: cred.user.displayName || userData.displayName || "",
    ...userData,
  };
}

export async function firebaseLogout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || data.displayName || "",
        role: data.role || "candidate",
        ...data,
      });
    } catch {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        role: "candidate",
      });
    }
  });
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateUserRole(uid, role) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { role }, { merge: true });
}

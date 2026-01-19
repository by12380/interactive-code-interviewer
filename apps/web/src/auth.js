import { randomId, readLocalStorageJson, readLocalStorageString, writeLocalStorageJson, writeLocalStorageString } from "./storage.js";

const USERS_KEY = "ici.auth.users";
const CURRENT_USER_ID_KEY = "ici.auth.currentUserId";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  const u = String(username || "").trim();
  return u || "User";
}

async function sha256Base64(input) {
  const text = String(input ?? "");
  if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) {
    return null;
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  const bin = String.fromCharCode(...arr);
  return btoa(bin);
}

export async function hashPassword(password) {
  const hashed = await sha256Base64(password);
  // Fallback for environments without SubtleCrypto.
  return hashed ?? `plain:${String(password ?? "")}`;
}

export function loadUsers() {
  const parsed = readLocalStorageJson(USERS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveUsers(users) {
  writeLocalStorageJson(USERS_KEY, Array.isArray(users) ? users : []);
}

export function getCurrentUserId() {
  const id = readLocalStorageString(CURRENT_USER_ID_KEY, null);
  return id ? String(id) : null;
}

export function setCurrentUserId(userId) {
  writeLocalStorageString(CURRENT_USER_ID_KEY, userId || null);
}

export function getUserById(userId) {
  const id = userId ? String(userId) : "";
  if (!id) return null;
  return loadUsers().find((u) => u && u.id === id) || null;
}

export async function signUp({ email, username, password }) {
  const nextEmail = normalizeEmail(email);
  const nextUsername = normalizeUsername(username);
  const nextPassword = String(password || "");
  if (!nextEmail || !nextPassword) {
    return { ok: false, error: "Email and password are required." };
  }

  const users = loadUsers();
  const exists = users.some((u) => normalizeEmail(u?.email) === nextEmail);
  if (exists) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(nextPassword);
  const user = {
    id: randomId("user"),
    email: nextEmail,
    username: nextUsername,
    passwordHash,
    createdAt: Date.now()
  };

  saveUsers([...users, user]);
  setCurrentUserId(user.id);
  return { ok: true, user };
}

export async function logIn({ email, password }) {
  const nextEmail = normalizeEmail(email);
  const nextPassword = String(password || "");
  if (!nextEmail || !nextPassword) {
    return { ok: false, error: "Email and password are required." };
  }

  const users = loadUsers();
  const user = users.find((u) => normalizeEmail(u?.email) === nextEmail) || null;
  if (!user) {
    return { ok: false, error: "Invalid email or password." };
  }

  const passwordHash = await hashPassword(nextPassword);
  if (String(user.passwordHash || "") !== String(passwordHash)) {
    return { ok: false, error: "Invalid email or password." };
  }

  setCurrentUserId(user.id);
  return { ok: true, user };
}

export function logOut() {
  setCurrentUserId(null);
}


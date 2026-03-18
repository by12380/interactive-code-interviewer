// Firebase configuration for the API server.
// Tries Admin SDK (needs service account), falls back to Client SDK with
// email/password auth so Firestore works without any manual setup.
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20";
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET || "ai-interviewer-app-6ce20.firebasestorage.app";

let adminDb;
let adminAuth;
let adminStorage;
let usingAdmin = false;

async function init() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // ── Path 1: Admin SDK (if credentials are available) ──────────────
  if (rawJson || keyPath) {
    try {
      const admin = (await import("firebase-admin")).default;
      if (!admin.apps.length) {
        let credential;
        if (rawJson) {
          credential = admin.credential.cert(JSON.parse(rawJson));
        } else {
          const sa = JSON.parse(fs.readFileSync(keyPath, "utf8"));
          credential = admin.credential.cert(sa);
        }
        admin.initializeApp({ projectId, storageBucket, credential });
      }
      adminDb = admin.firestore();
      adminAuth = admin.auth();
      adminStorage = admin.storage().bucket(storageBucket);
      usingAdmin = true;
      console.log("Firebase: using Admin SDK (service account).");
      return;
    } catch (err) {
      console.warn("Firebase: Admin SDK init failed:", err.message);
    }
  }

  // ── Path 2: Client SDK + email/password auth ──────────────────────
  const { initializeApp } = await import("firebase/app");
  const firestore = await import("firebase/firestore");
  const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC6-DxTHKbdLzo70CwX3ieKn_dF6Mpyd_4",
    authDomain: "ai-interviewer-app-6ce20.firebaseapp.com",
    projectId,
    storageBucket,
    messagingSenderId: "487765501995",
    appId: "1:487765501995:web:2739ffc99144bcc2f5e26e",
  };

  const app = initializeApp(firebaseConfig, "api-server");
  const clientDb = firestore.getFirestore(app);

  const serverEmail = process.env.FIREBASE_SERVER_EMAIL || "server-api@ai-interviewer.internal";
  const serverPass = process.env.FIREBASE_SERVER_PASSWORD || "server-api-internal-2024";
  try {
    await signInWithEmailAndPassword(getAuth(app), serverEmail, serverPass);
    console.log("Firebase: authenticated as server account.");
  } catch (err) {
    console.warn("Firebase: server auth failed:", err.message);
    console.warn("  Firestore may return PERMISSION_DENIED.");
  }

  // Wrap Client SDK behind the same interface the rest of server.js expects
  adminDb = _wrapClientDb(clientDb, firestore);
  adminAuth = null;
  adminStorage = null;
  usingAdmin = false;
  console.log("Firebase: using Client SDK.");
}

// ── Client SDK wrapper ──────────────────────────────────────────────
// Makes the Client SDK Firestore object behave like the Admin SDK so
// the compatibility helpers in server.js work unchanged.
function _wrapClientDb(clientDb, fs) {
  return {
    collection(path) {
      const ref = fs.collection(clientDb, path);
      return _wrapCollectionRef(ref, fs, clientDb);
    },
    doc(path) {
      const ref = fs.doc(clientDb, path);
      return _wrapDocRef(ref, fs, clientDb);
    },
  };
}

function _wrapDocRef(ref, fs, clientDb) {
  return {
    _ref: ref,
    id: ref.id,
    async get() {
      const snap = await fs.getDoc(ref);
      return _wrapDocSnap(snap);
    },
    async set(data, options) {
      return fs.setDoc(ref, data, options || {});
    },
    async update(data) {
      return fs.updateDoc(ref, data);
    },
    async delete() {
      return fs.deleteDoc(ref);
    },
    collection(subPath) {
      const sub = fs.collection(clientDb, ref.path + "/" + subPath);
      return _wrapCollectionRef(sub, fs, clientDb);
    },
  };
}

function _wrapCollectionRef(ref, fs, clientDb) {
  return {
    _ref: ref,
    async add(data) {
      const docRef = await fs.addDoc(ref, data);
      return _wrapDocRef(docRef, fs, clientDb);
    },
    async get() {
      const snap = await fs.getDocs(ref);
      return _wrapQuerySnap(snap);
    },
    doc(id) {
      const d = fs.doc(ref, id);
      return _wrapDocRef(d, fs, clientDb);
    },
    where(field, op, value) {
      const q = fs.query(ref, fs.where(field, op, value));
      return _wrapQueryRef(q, fs, clientDb);
    },
    orderBy(field, dir) {
      const q = fs.query(ref, fs.orderBy(field, dir));
      return _wrapQueryRef(q, fs, clientDb);
    },
    limit(n) {
      const q = fs.query(ref, fs.limit(n));
      return _wrapQueryRef(q, fs, clientDb);
    },
  };
}

function _wrapQueryRef(q, fs, clientDb) {
  return {
    _ref: q,
    async get() {
      const snap = await fs.getDocs(q);
      return _wrapQuerySnap(snap);
    },
    where(field, op, value) {
      const next = fs.query(q, fs.where(field, op, value));
      return _wrapQueryRef(next, fs, clientDb);
    },
    orderBy(field, dir) {
      const next = fs.query(q, fs.orderBy(field, dir));
      return _wrapQueryRef(next, fs, clientDb);
    },
    limit(n) {
      const next = fs.query(q, fs.limit(n));
      return _wrapQueryRef(next, fs, clientDb);
    },
  };
}

function _wrapDocSnap(snap) {
  const _exists = snap.exists();
  return {
    exists() { return _exists; },
    id: snap.id,
    data() { return snap.data(); },
    ref: snap.ref,
  };
}

function _wrapQuerySnap(snap) {
  const wrappedDocs = snap.docs.map(_wrapDocSnap);
  return {
    empty: snap.empty,
    size: snap.size,
    docs: wrappedDocs,
    forEach(cb) { wrappedDocs.forEach(cb); },
  };
}

await init();

export { adminDb, adminAuth, adminStorage, usingAdmin };
export default { adminDb, adminAuth, adminStorage };

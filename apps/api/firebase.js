// Firebase Admin SDK configuration for the API server.
// Uses a service account key file pointed to by GOOGLE_APPLICATION_CREDENTIALS,
// or falls back to project ID for environments where default credentials exist.
import fs from "node:fs";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20";
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "ai-interviewer-app-6ce20.firebasestorage.app";

function resolveCredential() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawServiceAccount) {
    return admin.credential.cert(JSON.parse(rawServiceAccount));
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    return admin.credential.cert(serviceAccount);
  }

  try {
    return admin.credential.applicationDefault();
  } catch {
    return undefined;
  }
}

if (!admin.apps.length) {
  const credential = resolveCredential();
  const config = { projectId, storageBucket };
  if (credential) config.credential = credential;

  try {
    admin.initializeApp(config);
  } catch {
    // Already initialised (hot-reload in dev)
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage().bucket(storageBucket);

export default admin;

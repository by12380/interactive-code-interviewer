// Firebase Admin SDK configuration for the API server.
// Uses a service account key file pointed to by GOOGLE_APPLICATION_CREDENTIALS,
// or falls back to project ID for environments where default credentials exist.
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20";

if (!admin.apps.length) {
  // If a service account key path is provided, use it.
  // Otherwise init with just the project ID (works in Cloud Run / App Engine / emulators).
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : admin.credential.applicationDefault().catch
      ? undefined
      : undefined;

  const config = { projectId };
  if (credential) config.credential = credential;

  try {
    admin.initializeApp(config);
  } catch {
    // Already initialised (hot-reload in dev)
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;

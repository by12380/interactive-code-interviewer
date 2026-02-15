// Firebase client-side configuration
// Replace with your own Firebase project config before deploying.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC6-DxTHKbdLzo70CwX3ieKn_dF6Mpyd_4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-interviewer-app-6ce20.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-interviewer-app-6ce20.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "487765501995",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:487765501995:web:2739ffc99144bcc2f5e26e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators in development if VITE_USE_EMULATORS is set
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch {
    // already connected
  }
}

export default app;

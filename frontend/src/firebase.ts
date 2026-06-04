import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

function isConfigured(): boolean {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

export const firebaseConfigured = isConfigured();

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  auth = getAuth(app);
}

export { app, auth };

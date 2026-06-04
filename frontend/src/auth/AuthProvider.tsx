import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import { auth, firebaseConfigured } from "../firebase";
import { sleep } from "../utils/authErrors";

type AuthContextValue = {
  firebaseUser: User | null;
  idToken: string | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      idToken,
      loading,
      signUp: async (email, password) => {
        if (!auth) throw new Error("Firebase is not configured.");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
          await sendEmailVerification(cred.user);
        }
        // Keep demo flow simple: require verified email before login.
        await signOut(auth);
      },
      signIn: async (email, password) => {
        if (!auth) throw new Error("Firebase is not configured.");
        await signInWithEmailAndPassword(auth, email, password);
        const u = auth.currentUser;
        if (u) {
          await u.reload();
          if (!u.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email before logging in.");
          }
        }
      },
      signInWithGoogle: async () => {
        if (!auth) throw new Error("Firebase is not configured.");
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        const u = auth.currentUser;
        if (u) {
          await u.reload();
          const domainsRaw = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string) || "";
          const domains = domainsRaw
            .split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean);
          if (domains.length && u.email) {
            const domain = u.email.split("@")[1]?.toLowerCase();
            if (!domain || !domains.includes(domain)) {
              await signOut(auth);
              throw new Error(`Only school email domains are allowed (${domains.join(", ")}).`);
            }
          }
          if (!u.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email before logging in.");
          }
        }
      },
      logout: async () => {
        if (!auth) throw new Error("Firebase is not configured.");
        await signOut(auth);
      },
      getFreshToken: async () => {
        if (!auth?.currentUser) throw new Error("Not authenticated");
        await sleep(200);
        return auth.currentUser.getIdToken(true);
      },
    }),
    [firebaseUser, idToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import BrandMark from "../components/ui/BrandMark";
import GoogleLogo from "../components/ui/GoogleLogo";
import { IconBell } from "../components/ui/StatIcons";

function IconKanban({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C7D2FE" strokeWidth={2} aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="7" width="5" height="13" rx="1" />
      <rect x="17" y="5" width="5" height="15" rx="1" />
    </svg>
  );
}

function IconUsers({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C7D2FE" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconInfo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

const FEATURES = [
  { icon: <IconKanban />, label: "Kanban task boards" },
  { icon: <IconBell size={14} />, label: "Due date reminders" },
  { icon: <IconUsers />, label: "Role-based access" },
];

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="authPage">
      <div className="authCard">
        <aside className="authBrand">
          <div className="authBrandTop">
            <BrandMark size={36} variant="glass" />
            <div className="authBrandName">
              BMS <span>TMS</span>
            </div>
          </div>

          <div className="authBrandMiddle">
            <h1 className="authHeadline">Manage school tasks, seamlessly.</h1>
            <p className="authTagline">
              Assign work, track progress, and keep your team aligned in one place.
            </p>
            <ul className="authFeatures">
              {FEATURES.map((f) => (
                <li key={f.label} className="authFeaturePill">
                  <span className="authFeatureIcon">{f.icon}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="authFormPanel">
          <h2 className="authFormTitle">Welcome back</h2>
          <p className="authFormSubtitle">Login using your school email</p>

          <button
            type="button"
            className="authGoogleBtn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signInWithGoogle();
              } catch (e: any) {
                setError(e?.message || "Google sign-in failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <GoogleLogo />
            {busy ? "Opening Google..." : "Continue with Google"}
          </button>

          <div className="authDivider">
            <span>or use email</span>
          </div>

          <div className="authField">
            <label className="authLabel" htmlFor="login-email">
              School Email
            </label>
            <input
              id="login-email"
              className="authInput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.com"
              autoComplete="email"
            />
          </div>

          <div className="authField">
            <label className="authLabel" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="authInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="authError">{error}</p> : null}

          <button
            type="button"
            className="authSubmitBtn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signIn(email.trim(), password);
              } catch (e: any) {
                setError(e?.message || "Login failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing in..." : "Login"}
          </button>

          <div className="authInfoNote">
            <IconInfo />
            <p>
              If you are a new teacher, ask admin to set your role and department before your first login.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

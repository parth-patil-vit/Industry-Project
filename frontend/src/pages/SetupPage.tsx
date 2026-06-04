import React from "react";

export default function SetupPage() {
  return (
    <div className="appShell">
      <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="brand" style={{ fontSize: 24, marginBottom: 6 }}>
          BMS <span>TMS</span>
        </div>
        <div className="muted" style={{ marginBottom: 16 }}>
          Firebase is not configured yet, so the app cannot load.
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Create `frontend/.env`</div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: 13,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
{`VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=http://localhost:5000`}
          </pre>

          <div style={{ marginTop: 14, fontWeight: 700, marginBottom: 10 }}>Also start the backend</div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: 13,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
{`# backend/.env
FIREBASE_ADMIN_CREDENTIALS_PATH=C:\\path\\to\\service-account.json

# then run:
python backend/app.py`}
          </pre>

          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Get these values from the Firebase Console under Project settings. After saving `.env`, restart
            the frontend dev server.
          </div>
        </div>
      </div>
    </div>
  );
}

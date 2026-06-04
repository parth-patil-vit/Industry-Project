import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import SetupPage from "./pages/SetupPage";
import { firebaseConfigured } from "./firebase";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        {firebaseConfigured ? (
          <AuthProvider>
            <App />
          </AuthProvider>
        ) : (
          <SetupPage />
        )}
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);


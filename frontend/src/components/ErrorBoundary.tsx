import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="appShell">
          <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
            <div className="brand" style={{ fontSize: 24, marginBottom: 6 }}>
              BMS <span>TMS</span>
            </div>
            <div style={{ border: "1px solid #fecaca", borderRadius: 18, padding: 16, background: "#fff" }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#b91c1c" }}>Something went wrong</div>
              <div className="muted" style={{ marginBottom: 12 }}>
                The app hit a runtime error while loading.
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  fontSize: 13,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {this.state.error.message}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

"use client";

// Only triggers if the root layout itself throws — deliberately self-contained (its own
// <html>/<body>, inline styles, no design-system imports) since whatever broke the layout could
// plausibly break anything that depends on it too.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F4F1EA", color: "#211F1A" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#5C584D", marginBottom: 20 }}>
              The app hit an unexpected error. Nothing about your data was changed.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#1B1A17",
                color: "#EDE9DF",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

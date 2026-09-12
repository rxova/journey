"use client";

import { journey } from "../journey";

export const Setup2fa = () => {
  const snapshot = journey.useSnapshot();

  return (
    <div className="step">
      <h3>Setup Two-Factor Authentication</h3>
      <p>You don&apos;t have 2FA configured. Scan the QR code with your authenticator app.</p>
      {snapshot.context.qrCode ? (
        <div
          style={{
            padding: "1rem",
            background: "#1a1a1a",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#4ade80",
            marginBottom: "0.75rem",
            wordBreak: "break-all"
          }}
        >
          {snapshot.context.qrCode}
        </div>
      ) : (
        <div className="loading">Generating QR code...</div>
      )}
      <div className="actions">
        <button onClick={() => void journey.send("setup2fa", { code: "" })}>
          I&apos;ve scanned it — continue
        </button>
      </div>
    </div>
  );
};

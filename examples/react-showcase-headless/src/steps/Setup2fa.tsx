"use client";

import React from "react";
import { mockApi } from "../api";
import { useJourneySnapshot, useJourneyApi } from "../machine";

export const Setup2fa = () => {
  const snapshot = useJourneySnapshot();
  const api = useJourneyApi();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let canceled = false;
    mockApi.generateQrCode().then((result) => {
      if (!canceled) {
        api.updateContext((ctx) => ({ ...ctx, qrCode: result.qrCode }));
      }
    });
    return () => {
      canceled = true;
    };
  }, [api]);

  const handleContinue = async () => {
    setLoading(true);
    await api.goToStepById("verifyCode");
    setLoading(false);
  };

  return (
    <div className="step">
      <h3>Setup Two-Factor Authentication</h3>
      <p>Scan the QR code with your authenticator app.</p>
      {snapshot.context.qrCode ? (
        <div
          style={{
            padding: "1rem",
            background: "#1a1a1a",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#c084fc",
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
        <button className="secondary" onClick={() => void api.goToPreviousStep()}>
          Back
        </button>
        <button onClick={() => void handleContinue()} disabled={loading}>
          I&apos;ve scanned it
        </button>
      </div>
    </div>
  );
};

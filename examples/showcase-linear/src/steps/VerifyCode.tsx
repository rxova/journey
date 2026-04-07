"use client";

import React from "react";
import { mockApi } from "../api";
import { journey } from "../journey";

export const VerifyCode = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  const [loading, setLoading] = React.useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const result = await mockApi.verifyCode(snapshot.context.verificationCode);
      if (result.success) {
        await api.goToNextStep();
      } else {
        const nextAttempts = snapshot.context.attempts + 1;
        await api.updateContext((ctx) => ({
          ...ctx,
          error:
            nextAttempts >= 3
              ? "Too many failed attempts. Account blocked."
              : "Invalid code. Try 123456.",
          attempts: nextAttempts
        }));

        if (nextAttempts >= 3) {
          await api.goToNextStep();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step">
      <h3>Verify Code</h3>
      <p>
        Enter the 6-digit code from your authenticator app. Use <strong>123456</strong>.
      </p>
      <label className="field">
        Verification Code
        <input
          type="text"
          value={snapshot.context.verificationCode}
          onChange={(e) => {
            const verificationCode = e.target.value;
            void api.updateContext((ctx) => ({
              ...ctx,
              verificationCode,
              error: null
            }));
          }}
          placeholder="123456"
          maxLength={6}
        />
      </label>
      {snapshot.context.error && <div className="error">{snapshot.context.error}</div>}
      <div className="step-info">
        <span>Attempts: {snapshot.context.attempts}</span>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => void api.goToPreviousStep()}>
          Back
        </button>
        <button onClick={() => void handleVerify()} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { journey, mockApi } from "../journey";

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
        await api.updateContext((ctx) => ({
          ...ctx,
          error: "Invalid code. Try 123456.",
          attempts: ctx.attempts + 1
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step">
      <h3>Verify Code</h3>
      <p>Enter the 6-digit code from your authenticator app.</p>
      <label className="field">
        Verification Code
        <input
          type="text"
          value={snapshot.context.verificationCode}
          onChange={(e) =>
            void api.updateContext((ctx) => ({
              ...ctx,
              verificationCode: e.target.value,
              error: null
            }))
          }
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

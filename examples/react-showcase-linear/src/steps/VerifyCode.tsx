"use client";

import React from "react";
import { useWizard } from "@rxova/journey-react";
import { mockApi } from "../api";
import type { LoginContext } from "../context";

export const VerifyCode = (props: { id?: string }) => {
  void props;
  const { context, updateContext, goToNextStep, goToPreviousStep } = useWizard<LoginContext>();
  const [loading, setLoading] = React.useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const result = await mockApi.verifyCode(context.verificationCode);
      if (result.success) {
        await goToNextStep();
      } else {
        const nextAttempts = context.attempts + 1;
        await updateContext((ctx) => ({
          ...ctx,
          error:
            nextAttempts >= 3
              ? "Too many failed attempts. Account blocked."
              : "Invalid code. Try 123456.",
          attempts: nextAttempts
        }));

        if (nextAttempts >= 3) {
          await goToNextStep();
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
          value={context.verificationCode}
          onChange={(e) => {
            const verificationCode = e.target.value;
            void updateContext((ctx) => ({
              ...ctx,
              verificationCode,
              error: null
            }));
          }}
          placeholder="123456"
          maxLength={6}
        />
      </label>
      {context.error && <div className="error">{context.error}</div>}
      <div className="step-info">
        <span>Attempts: {context.attempts}</span>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => void goToPreviousStep()}>
          Back
        </button>
        <button onClick={() => void handleVerify()} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
};

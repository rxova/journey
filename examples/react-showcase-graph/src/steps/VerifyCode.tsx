"use client";

import React from "react";
import { journey } from "../journey";
import { mockApi } from "../api";

export const VerifyCode = () => {
  const snapshot = journey.useSnapshot();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isLoading = snapshot.currentStep?.async.isLoading ?? false;
  const isBusy = isLoading || isSubmitting;

  const handleVerify = async () => {
    if (isBusy) {
      return;
    }

    setIsSubmitting(true);
    try {
      journey.updateContext((ctx) => ({ ...ctx, error: null }));
      const result = await mockApi.verifyCode(code);
      if (!result.success) {
        journey.updateContext((context) => ({
          ...context,
          attempts: context.attempts + 1,
          error: context.attempts + 1 >= 3 ? "Too many failed attempts." : "Invalid code."
        }));
      }
      await journey.send(result.success ? "verifyCodeSuccess" : "verifyCodeFailure", { code });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="step">
      <h3>Verify Setup Code</h3>
      <p>Enter the 6-digit code from your authenticator app to complete setup.</p>
      <p>
        <strong>Hint:</strong> the valid demo code is <code>123456</code>.
      </p>
      <label className="field">
        Verification Code
        <input
          type="text"
          value={code}
          disabled={isBusy}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          maxLength={6}
        />
      </label>
      {snapshot.context.error && <div className="error">{snapshot.context.error}</div>}
      <div className="step-info">
        <span>Attempts: {snapshot.context.attempts}</span>
      </div>
      <div className="actions">
        <button onClick={() => void handleVerify()} disabled={isBusy} aria-busy={isBusy}>
          {isBusy ? (
            <span className="button-content">
              <span className="button-spinner" aria-hidden="true" />
              Verifying...
            </span>
          ) : (
            "Verify"
          )}
        </button>
      </div>
    </div>
  );
};

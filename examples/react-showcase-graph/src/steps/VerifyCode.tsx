"use client";

import React from "react";
import { journey } from "../journey";
import { mockApi } from "../api";

export const VerifyCode = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isLoading = snapshot.async.isLoading;
  const isBusy = isLoading || isSubmitting;

  const handleVerify = async () => {
    if (isBusy) {
      return;
    }

    setIsSubmitting(true);
    try {
      api.updateContext((ctx) => ({ ...ctx, error: null }));
      const result = await mockApi.verifyCode(code);
      await api.send({
        type: result.success ? "verifyCodeSuccess" : "verifyCodeFailure",
        payload: { code }
      });
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

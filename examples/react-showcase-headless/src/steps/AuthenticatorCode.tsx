"use client";

import React from "react";
import { mockApi } from "../api";
import { useJourneySnapshot, useJourneyApi } from "../machine";

export const AuthenticatorCode = () => {
  const snapshot = useJourneySnapshot();
  const api = useJourneyApi();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleVerify = async () => {
    setLoading(true);
    api.updateContext((ctx) => ({ ...ctx, attempts: ctx.attempts + 1 }));

    const result = await mockApi.verifyCode(code);
    if (result.success) {
      await api.goToStepById("loggedIn");
    } else if (snapshot.context.attempts >= 2) {
      api.updateContext((ctx) => ({ ...ctx, error: "Too many attempts." }));
      await api.goToStepById("blocked");
    } else {
      api.updateContext((ctx) => ({ ...ctx, error: "Invalid code. Try 123456." }));
    }
    setLoading(false);
  };

  return (
    <div className="step">
      <h3>Authenticator Verification</h3>
      <p>Open your authenticator app and enter the current code.</p>
      <label className="field">
        Authenticator Code
        <input
          type="text"
          value={code}
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
        <button onClick={() => void handleVerify()} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
        <button className="secondary" onClick={() => void api.goToStepById("emailCode")}>
          Switch to Email
        </button>
      </div>
    </div>
  );
};

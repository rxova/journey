"use client";

import React from "react";
import { mockApi } from "../api";
import { journey } from "../journey";

export const Login = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await mockApi.login(snapshot.context.username, snapshot.context.password);
      if (result.success) {
        const qrResult = await mockApi.generateQrCode();
        await api.updateContext((ctx) => ({ ...ctx, qrCode: qrResult.qrCode, error: null }));
        await api.goToNextStep();
      } else {
        await api.updateContext((ctx) => ({ ...ctx, error: "Login failed" }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step">
      <h3>Login</h3>
      <p>Enter your credentials to sign in.</p>
      <label className="field">
        Username
        <input
          type="text"
          value={snapshot.context.username}
          onChange={(e) => {
            const username = e.target.value;
            void api.updateContext((ctx) => ({ ...ctx, username }));
          }}
          placeholder="alice"
        />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          value={snapshot.context.password}
          onChange={(e) => {
            const password = e.target.value;
            void api.updateContext((ctx) => ({ ...ctx, password }));
          }}
          placeholder="password"
        />
      </label>
      <p className="hint">Hint: any password will work.</p>
      {snapshot.context.error && <div className="error">{snapshot.context.error}</div>}
      <div className="actions">
        <button onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
};

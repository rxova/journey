"use client";

import React from "react";
import { useJourneySnapshot, useJourneyApi, mockApi } from "../machine";
import type { StepId } from "../machine";

export const Login = () => {
  const snapshot = useJourneySnapshot();
  const api = useJourneyApi();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = snapshot.context;
    setLoading(true);

    try {
      const result = await mockApi.login(username, password);
      if (!result.success) {
        api.updateContext((ctx) => ({ ...ctx, error: "Login failed." }));
        return;
      }

      api.updateContext((ctx) => ({ ...ctx, twoFactorMethod: result.method, error: null }));

      let target: StepId;
      switch (result.method) {
        case "no_2fa":
          target = "setup2fa";
          break;
        case "email":
          target = "emailCode";
          break;
        case "authenticator":
          target = "authenticatorCode";
          break;
      }

      await api.goToStepById(target);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step">
      <h3>Sign In (Headless)</h3>
      <p>All navigation is manual via goToStepById. No transitions defined.</p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          Username
          <input
            type="text"
            value={snapshot.context.username}
            onChange={(e) => api.updateContext((ctx) => ({ ...ctx, username: e.target.value }))}
            placeholder="alice"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={snapshot.context.password}
            onChange={(e) => api.updateContext((ctx) => ({ ...ctx, password: e.target.value }))}
            placeholder="password (use 'blocked' to fail)"
          />
        </label>
        {snapshot.context.error && <div className="error">{snapshot.context.error}</div>}
        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
};

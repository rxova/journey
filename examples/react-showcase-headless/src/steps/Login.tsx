"use client";

import React from "react";
import { mockApi } from "../api";
import { useJourneySnapshot, useJourneyApi } from "../machine";
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

      await api.updateContext((ctx) => ({
        ...ctx,
        twoFactorMethod: result.method,
        error: null,
        password: ""
      }));

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
            placeholder="password (use 'blocked' to fail)"
          />
        </label>
        <p className="hint">Hint: any password will work except "blocked".</p>
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

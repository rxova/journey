"use client";

import React from "react";
import { mockApi } from "../api";
import { loginJourney } from "../journey";

export const Login = () => {
  const snapshot = loginJourney.useSnapshot();
  const context = snapshot.context;
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await mockApi.login(context.username, context.password);
      if (result.success) {
        const qrResult = await mockApi.generateQrCode();
        loginJourney.updateContext((ctx) => ({ ...ctx, qrCode: qrResult.qrCode, error: null }));
        await loginJourney.navigate.goToNextStep();
      } else {
        loginJourney.updateContext((ctx) => ({ ...ctx, error: "Login failed" }));
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
          value={context.username}
          onChange={(e) => {
            const username = e.target.value;
            loginJourney.updateContext((ctx) => ({ ...ctx, username }));
          }}
          placeholder="alice"
        />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          value={context.password}
          onChange={(e) => {
            const password = e.target.value;
            loginJourney.updateContext((ctx) => ({ ...ctx, password }));
          }}
          placeholder="password"
        />
      </label>
      <p className="hint">Hint: any password will work.</p>
      {context.error && <div className="error">{context.error}</div>}
      <div className="actions">
        <button onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
};

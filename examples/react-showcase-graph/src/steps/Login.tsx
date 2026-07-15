"use client";

import React from "react";
import { journey } from "../journey";
import { mockApi } from "../api";

export const Login = () => {
  const snapshot = journey.useSnapshot();
  const api = journey.useApi();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isLoading = snapshot.currentStep?.async.isLoading ?? false;
  const isBusy = isLoading || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) {
      return;
    }

    const { username, password } = snapshot.context;

    setIsSubmitting(true);
    try {
      const result = await mockApi.login(username, password);
      if (!result.success) {
        await api.updateContext((ctx) => ({
          ...ctx,
          error: "Login failed. Try a different password."
        }));
        return;
      }

      let qrCode = snapshot.context.qrCode;
      if (result.method === "no_2fa") {
        const qrResult = await mockApi.generateQrCode();
        qrCode = qrResult.qrCode;
      } else if (result.method === "email") {
        await mockApi.sendEmailCode();
        qrCode = null;
      } else {
        qrCode = null;
      }

      await api.updateContext((ctx) => ({
        ...ctx,
        twoFactorMethod: result.method,
        qrCode,
        error: null
      }));

      await api.send("submitLogin", { username, password });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="step">
      <h3>Sign In</h3>
      <p>
        Enter your credentials. The 2FA method is determined by username length: 3-letter = no_2fa,
        4-letter = email, 5-letter = authenticator.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          Username
          <input
            type="text"
            value={snapshot.context.username}
            disabled={isBusy}
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
            disabled={isBusy}
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
          <button type="submit" disabled={isBusy} aria-busy={isBusy}>
            {isBusy ? (
              <span className="button-content">
                <span className="button-spinner" aria-hidden="true" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={isBusy}
            onClick={() => void api.controls.terminate()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

"use client";

import React from "react";
import { useWizard } from "@rxova/journey-react";
import type { LoginContext } from "../context";

export const LoggedIn = (props: { id?: string }) => {
  void props;
  const { context, status, resetJourney } = useWizard<LoginContext>();
  const isBlocked = context.attempts >= 3;
  void status;

  return (
    <div className="step">
      <div className="success-message">
        {isBlocked ? (
          <>
            <h3 style={{ color: "#f87171" }}>Account Blocked</h3>
            <p>{context.error ?? "Too many failed verification attempts."}</p>
            <p style={{ marginTop: "0.5rem" }}>Attempts used: {context.attempts}</p>
            <p style={{ marginTop: "0.5rem", color: "#888" }}>Journey closed automatically.</p>
          </>
        ) : (
          <>
            <h3>Welcome, {context.username || "User"}!</h3>
            <p>You have successfully authenticated.</p>
          </>
        )}
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => void resetJourney()}>
          Start Over
        </button>
      </div>
    </div>
  );
};

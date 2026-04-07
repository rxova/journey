"use client";

import React from "react";
import { journey } from "../journey";

export const LoggedIn = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  const isBlocked = snapshot.context.attempts >= 3;

  React.useEffect(() => {
    if (isBlocked && snapshot.status === "running") {
      void api.terminateJourney();
    }
  }, [api, isBlocked, snapshot.status]);

  return (
    <div className="step">
      <div className="success-message">
        {isBlocked ? (
          <>
            <h3 style={{ color: "#f87171" }}>Account Blocked</h3>
            <p>{snapshot.context.error ?? "Too many failed verification attempts."}</p>
            <p style={{ marginTop: "0.5rem" }}>Attempts used: {snapshot.context.attempts}</p>
            <p style={{ marginTop: "0.5rem", color: "#888" }}>Journey closed automatically.</p>
          </>
        ) : (
          <>
            <h3>Welcome, {snapshot.context.username || "User"}!</h3>
            <p>You have successfully authenticated.</p>
          </>
        )}
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => api.resetJourney()}>
          Start Over
        </button>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { useJourneySnapshot, useJourneyApi } from "../machine";

export const Blocked = () => {
  const snapshot = useJourneySnapshot();
  const api = useJourneyApi();

  React.useEffect(() => {
    api.terminateJourney();
  }, [api]);

  return (
    <div className="step">
      <div className="success-message">
        <h3 style={{ color: "#f87171" }}>Account Blocked</h3>
        <p>{snapshot.context.error ?? "Too many failed verification attempts."}</p>
        <p style={{ marginTop: "0.5rem" }}>Attempts used: {snapshot.context.attempts}</p>
        <p style={{ marginTop: "0.5rem", color: "#888" }}>Journey closed automatically.</p>
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => api.resetJourney()}>
          Try Again
        </button>
      </div>
    </div>
  );
};

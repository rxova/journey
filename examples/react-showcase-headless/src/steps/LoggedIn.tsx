"use client";

import React from "react";
import { useJourneySnapshot, useJourneyApi } from "../machine";

export const LoggedIn = () => {
  const snapshot = useJourneySnapshot();
  const api = useJourneyApi();

  React.useEffect(() => {
    api.completeJourney();
  }, [api]);

  return (
    <div className="step">
      <div className="success-message">
        <h3>Welcome, {snapshot.context.username || "User"}!</h3>
        <p>
          Authenticated via <strong>{snapshot.context.twoFactorMethod ?? "unknown"}</strong>.
        </p>
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => api.resetJourney()}>
          Start Over
        </button>
      </div>
    </div>
  );
};

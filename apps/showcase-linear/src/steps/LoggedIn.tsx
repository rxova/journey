"use client";

import { journey } from "../journey";

export const LoggedIn = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();

  return (
    <div className="step">
      <div className="success-message">
        <h3>Welcome, {snapshot.context.username || "User"}!</h3>
        <p>You have successfully authenticated.</p>
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => api.resetJourney()}>
          Start Over
        </button>
        <button onClick={() => void api.completeJourney()}>Complete Journey</button>
      </div>
    </div>
  );
};

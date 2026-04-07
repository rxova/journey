"use client";

import { journey } from "../journey";

export const LoggedIn = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();

  // React alternative to onEnter/onLeave on the step definition.
  // Useful when the callback needs access to component state or React context.
  journey.useJourneyStepLifecycle("loggedIn", {
    onLeave: ({ context }) => {
      console.log("[journey] loggedIn: leaving session for", context.username);
    }
  });

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

"use client";

import React from "react";
import { journey } from "../journey";

export const LoggedIn = () => {
  const snapshot = journey.useSnapshot();
  const controls = journey.useControls();

  // React alternative to onEnter/onLeave on the step definition.
  // Useful when the callback needs access to component state or React context.
  journey.useSubscribeEvent("stepLeave", ({ from, snapshot }) => {
    if (from !== "loggedIn") return;
    console.log("[journey] loggedIn: leaving session for", snapshot.context.username);
  });

  React.useEffect(() => {
    controls.complete();
  }, [controls]);

  return (
    <div className="step">
      <div className="success-message">
        <h3>Welcome, {snapshot.context.username || "User"}!</h3>
        <p>
          Authenticated via <strong>{snapshot.context.twoFactorMethod ?? "unknown"}</strong>.
        </p>
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => controls.restart()}>
          Start Over
        </button>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { journey } from "../journey";

export const LoggedIn = () => {
  const snapshot = journey.useSnapshot();
  const { controls } = journey;

  // Enter and leave, without definition hooks: StepRenderer keys the active
  // view by step id, so this component mounts exactly when the step is entered
  // and unmounts exactly when it is left. Unlike a hook running inside the
  // machine, an effect can reach component state and React context.
  React.useEffect(() => {
    console.log(
      "[journey] loggedIn: authenticated as",
      journey.machine.getSnapshot().context.username
    );
    return () => {
      console.log(
        "[journey] loggedIn: leaving session for",
        journey.machine.getSnapshot().context.username
      );
    };
  }, []);

  // useEventEffect is the other half: it observes the machine's own events
  // rather than this component's lifetime, so it sees moves between any steps.
  journey.useEventEffect("stepLeave", ({ from }) => {
    if (from !== "loggedIn") return;
    console.log("[journey] loggedIn: stepLeave fired");
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

"use client";

import React from "react";
import { loginJourney } from "../journey";

export const LoggedIn = () => {
  const snapshot = loginJourney.useSnapshot();
  const controls = loginJourney.useControls();
  const context = snapshot.context;
  const status = snapshot.status;
  const isSettled = !snapshot.transition.pending;
  const isBlocked = context.attempts >= 3;

  // Entering this step closes the journey: terminated when the account is
  // blocked, completed otherwise. (Completed machines keep their last step,
  // so this screen stays rendered.) Lifecycle verbs are rejected while the
  // entry transition is still settling, so the effect waits for
  // `transition.pending` to clear and re-runs on that snapshot change.
  React.useEffect(() => {
    if (status !== "running" || !isSettled) {
      return;
    }
    if (isBlocked) {
      controls.terminate();
    } else {
      controls.complete();
    }
  }, [status, isSettled, isBlocked, controls]);

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
        <button className="secondary" onClick={() => controls.restart()}>
          Start Over
        </button>
      </div>
    </div>
  );
};

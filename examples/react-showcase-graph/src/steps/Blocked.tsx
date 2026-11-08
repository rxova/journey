"use client";

import React from "react";
import { journey } from "../journey";

export const Blocked = () => {
  const snapshot = journey.useSnapshot();
  const { controls } = journey;

  // Mounting is entering this step — see the note in LoggedIn.tsx.
  React.useEffect(() => {
    const { attempts } = journey.machine.getSnapshot().context;
    console.warn("[journey] blocked: account locked after", attempts, "failed attempts");
  }, []);

  React.useEffect(() => {
    controls.terminate();
  }, [controls]);

  return (
    <div className="step">
      <div className="success-message">
        <h3 style={{ color: "#f87171" }}>Account Blocked</h3>
        <p>{snapshot.context.error ?? "Too many failed verification attempts."}</p>
        <p style={{ marginTop: "0.5rem" }}>Attempts used: {snapshot.context.attempts}</p>
        <p style={{ marginTop: "0.5rem", color: "#888" }}>Journey closed automatically.</p>
      </div>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="secondary" onClick={() => controls.restart()}>
          Try Again
        </button>
      </div>
    </div>
  );
};

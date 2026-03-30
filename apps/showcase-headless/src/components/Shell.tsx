"use client";

import React from "react";
import { useJourneySnapshot, useJourneyComputed, useJourneyEvent, useJourneyApi } from "../machine";
import type { StepId } from "../machine";

const EventLog = () => {
  const [events, setEvents] = React.useState<string[]>([]);

  useJourneyEvent((event) => {
    setEvents((prev) => [...prev.slice(-29), `${new Date().toLocaleTimeString()} ${event.type}`]);
  });

  return (
    <div className="event-log">
      {events.length === 0 && <div className="event-log-entry">Waiting for events...</div>}
      {events.map((entry, i) => (
        <div key={i} className="event-log-entry">
          {entry}
        </div>
      ))}
    </div>
  );
};

const TimelineDisplay = () => {
  const snapshot = useJourneySnapshot();
  return (
    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
      Timeline: {snapshot.history.timeline.join(" → ")}
    </div>
  );
};

const QuickNav = () => {
  const api = useJourneyApi();
  const steps: StepId[] = [
    "login",
    "setup2fa",
    "verifyCode",
    "emailCode",
    "authenticatorCode",
    "loggedIn",
    "blocked"
  ];

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>
        Quick nav (goToStepById):
      </div>
      <div className="actions" style={{ marginTop: "0.25rem" }}>
        {steps.map((id) => (
          <button
            key={id}
            className="secondary"
            style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
            onClick={() => void api.goToStepById(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="actions" style={{ marginTop: "0.5rem" }}>
        <button
          className="secondary"
          style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
          onClick={() => void api.goToPreviousStep()}
        >
          goToPreviousStep
        </button>
        <button
          className="secondary"
          style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
          onClick={() => void api.goToLastVisitedStep()}
        >
          goToLastVisitedStep
        </button>
        <button
          className="secondary"
          style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
          onClick={() => api.resetJourney()}
        >
          resetJourney
        </button>
      </div>
    </div>
  );
};

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const snapshot = useJourneySnapshot();
  const computed = useJourneyComputed();

  return (
    <div className="layout">
      <header className="hero">
        <h1>
          Showcase: Headless Mode <span className="badge badge-headless">HEADLESS</span>
        </h1>
        <p>
          No transitions defined. All navigation uses goToStepById. React integration via
          useSyncExternalStore.
        </p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step: {snapshot.currentStepId} (visited {computed.visitedStepCount} steps)
          </span>
        </div>

        <TimelineDisplay />
        <QuickNav />
        {children}
      </div>

      <div className="card">
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Event Log</h3>
        <EventLog />
      </div>

      <div className="card">
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Snapshot</h3>
        <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
    </div>
  );
};

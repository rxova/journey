"use client";

import React from "react";

import { loginJourney } from "../journey";

const EventLog = () => {
  const [events, setEvents] = React.useState<string[]>([]);

  const log = (entry: string) =>
    setEvents((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${entry}`]);

  loginJourney.useSubscribeEvent("stepEnter", ({ to }) => log(`stepEnter → ${to}`));
  loginJourney.useSubscribeEvent("statusChange", ({ current }) => {
    // A restart resets the journey; start the log fresh with it.
    if (current === "running") {
      setEvents([]);
      return;
    }
    log(`statusChange → ${current}`);
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

const ProgressBar = () => {
  const snapshot = loginJourney.useSnapshot();
  const index = snapshot.currentStep?.index ?? 0;
  const stepCount = snapshot.steps.totalSteps;
  const pct = stepCount > 1 ? (index / (stepCount - 1)) * 100 : 0;

  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Shell = ({ children }: { children?: React.ReactNode }) => {
  const snapshot = loginJourney.useSnapshot();
  const currentStep = snapshot.currentStep;

  return (
    <div className="layout">
      <header className="hero">
        <h1>
          React Showcase: Linear Mode <span className="badge badge-linear">LINEAR</span>
        </h1>
        <p>
          Each step is a view in the Provider&apos;s typed views record; each advances with
          goToNextStep.
        </p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step {(currentStep?.index ?? 0) + 1} of {snapshot.steps.totalSteps}
            {currentStep?.isFirstStep && " (first)"}
            {currentStep?.isLastStep && " (last)"}
          </span>
        </div>

        <ProgressBar />
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

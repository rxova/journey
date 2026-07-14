"use client";

import React from "react";
import { useWizard } from "@rxova/journey-react";
import { useJourneyEvent } from "@rxova/journey-react/headless";

import type { LoginContext } from "../context";

const EventLog = () => {
  const { machine, status, snapshot } = useWizard<LoginContext>();
  const [events, setEvents] = React.useState<string[]>([]);

  useJourneyEvent(machine, (event) => {
    setEvents((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${event.type}`]);
  });

  React.useEffect(() => {
    if (status === "idled" && snapshot.history.timeline.length === 1) {
      setEvents([]);
    }
  }, [snapshot.history.timeline.length, status]);

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
  const { activeStepIndex, stepCount } = useWizard<LoginContext>();
  const pct = stepCount > 1 ? (activeStepIndex / (stepCount - 1)) * 100 : 0;

  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Shell = ({ children }: { children?: React.ReactNode }) => {
  const { snapshot, status, activeStepIndex, stepCount, isFirstStep, isLastStep } =
    useWizard<LoginContext>();

  return (
    <div className="layout">
      <header className="hero">
        <h1>
          React Showcase: Linear Mode <span className="badge badge-linear">LINEAR</span>
        </h1>
        <p>Steps are just components inside &lt;Wizard/&gt;; each advances with goToNextStep.</p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${status}`}>{status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step {activeStepIndex + 1} of {stepCount}
            {isFirstStep && " (first)"}
            {isLastStep && " (last)"}
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

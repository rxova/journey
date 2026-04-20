"use client";

import React from "react";
import { journey } from "../journey";
const EventLog = () => {
  const [events, setEvents] = React.useState<string[]>([]);
  const snapshot = journey.useJourneySnapshot();

  journey.useJourneyEvent((event) => {
    setEvents((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${event.type}`]);
  });

  React.useEffect(() => {
    if (snapshot.status === "idled" && snapshot.history.timeline.length === 1) {
      setEvents([]);
    }
  }, [snapshot.history.timeline.length, snapshot.status]);

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
  const computed = journey.useJourneyComputed();
  const length = computed.mode === "linear" ? computed.journeyLength : 1;
  const pct = length > 1 ? (computed.activeStepIndex / (length - 1)) * 100 : 0;

  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const snapshot = journey.useJourneySnapshot();
  const computed = journey.useJourneyComputed();

  return (
    <div className="layout">
      <header className="hero">
        <h1>
          React Showcase: Linear Mode <span className="badge badge-linear">LINEAR</span>
        </h1>
        <p>
          React linear Vite example for the no_2fa happy path. Each step advances with goToNextStep.
        </p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step {computed.activeStepIndex + 1} of{" "}
            {computed.mode === "linear" ? computed.stepCount : "?"}
            {computed.mode === "linear" && computed.isFirstStep && " (first)"}
            {computed.mode === "linear" && computed.isLastStep && " (last)"}
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

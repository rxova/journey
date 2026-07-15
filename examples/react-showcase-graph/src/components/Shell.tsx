"use client";

import React from "react";
import type { ExecutionPathsApi } from "@rxova/journey-core/execution-paths";
import { journey } from "../journey";

const EventLog = () => {
  const [events, setEvents] = React.useState<string[]>([]);
  const append = React.useCallback((event: string) => {
    setEvents((previous) => [
      ...previous.slice(-29),
      `${new Date().toLocaleTimeString()} ${event}`
    ]);
  }, []);

  journey.useEvent("stepEnter", ({ to }) => append(`stepEnter -> ${to}`));
  journey.useEvent("stepLeave", ({ from }) => append(`stepLeave -> ${from}`));
  journey.useEvent("statusChange", ({ current }) => append(`statusChange -> ${current}`));
  journey.useEvent("navigationBlocked", ({ reason }) => append(`navigationBlocked -> ${reason}`));

  return (
    <div className="event-log">
      {events.length === 0 && <div className="event-log-entry">Waiting for events...</div>}
      {events.map((entry, index) => (
        <div key={`${entry}-${index}`} className="event-log-entry">
          {entry}
        </div>
      ))}
    </div>
  );
};

const StepMetaDisplay = () => {
  const metadata = journey.useSnapshot().currentStep?.metadata;

  if (!metadata) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
      <span style={{ fontSize: "1.5rem" }}>{metadata.icon}</span>
      <span style={{ fontSize: "0.85rem", color: "#888" }}>{metadata.label}</span>
    </div>
  );
};

const ExecutionPathsViewer = () => {
  const snapshot = journey.useSnapshot();
  const machine = journey.useMachine();
  const paths = machine.plugins["execution-paths"] as ExecutionPathsApi;
  const allPaths = [paths.getCurrentPath(), ...paths.getCompletedPaths()];

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Execution Paths</h3>
      <div className="paths-summary">
        <span>Recorded runs: {allPaths.length}</span>
        <span>Current status: {snapshot.status}</span>
      </div>
      <div className="paths-grid">
        {allPaths.map((steps, index) => (
          <div className="path-card" key={`${steps.join(">")}-${index}`}>
            <div className="path-card-header">
              <span className="path-index">
                {index === 0 ? "Current run" : `Completed run ${index}`}
              </span>
            </div>
            <div className="path-steps">
              {steps.map((stepId, stepIndex) => (
                <React.Fragment key={`${stepId}-${stepIndex}`}>
                  {stepIndex > 0 && <span className="path-arrow">-&gt;</span>}
                  <span className="path-token">{stepId}</span>
                </React.Fragment>
              ))}
              {steps.length === 0 && <span className="path-empty">No steps yet</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TimelineDisplay = () => {
  const timeline = journey.useSelector((snapshot) => snapshot.history.timeline);

  return (
    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
      Timeline: {timeline.join(" -> ")}
    </div>
  );
};

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const snapshot = journey.useSnapshot();

  return (
    <div className="layout">
      <header className="hero">
        <h1>
          React Showcase: Graph Mode <span className="badge badge-graph">GRAPH</span>
        </h1>
        <p>
          React graph Vite example with explicit branching, typed events, and the execution-paths
          plugin.
        </p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step: {snapshot.currentStep?.id ?? "none"} (visited {snapshot.steps.visitedStepCount}{" "}
            steps)
          </span>
        </div>

        <StepMetaDisplay />
        <TimelineDisplay />
        {children}
      </div>

      <div className="card">
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Event Log</h3>
        <EventLog />
      </div>

      <ExecutionPathsViewer />

      <div className="card">
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Snapshot</h3>
        <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
    </div>
  );
};

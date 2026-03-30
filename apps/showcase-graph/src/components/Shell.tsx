"use client";

import React from "react";
import type { JourneyExecutionPathsResult, JourneyFullEventType } from "@rxova/journey-core";
import { journey } from "../journey";
import type { EventMap, StepId } from "../journey";

type ExecutionPathsResult = JourneyExecutionPathsResult<StepId, JourneyFullEventType<EventMap>>;
type ExecutionPath = ExecutionPathsResult["paths"][number];

const formatTermination = (termination: ExecutionPath["terminated"]) => {
  switch (termination) {
    case "final":
      return "final";
    case "cycle":
      return "cycle";
    case "depth":
      return "depth";
    case "limit":
      return "limit";
  }
};

const pathMatchesCurrentFlow = (
  path: ExecutionPath,
  timeline: readonly StepId[],
  matchedEventTypes: readonly string[]
) => {
  if (path.steps.length < timeline.length || path.events.length < matchedEventTypes.length) {
    return false;
  }

  return (
    timeline.every((stepId, index) => path.steps[index] === stepId) &&
    matchedEventTypes.every((eventType, index) => path.events[index] === eventType)
  );
};

const pathHasExactCurrentPrefix = (
  path: ExecutionPath,
  timeline: readonly StepId[],
  matchedEventTypes: readonly string[]
) => path.steps.length === timeline.length && path.events.length === matchedEventTypes.length;

const EventLog = () => {
  const [events, setEvents] = React.useState<string[]>([]);

  journey.useJourneyEvent((event) => {
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

const StepMetaDisplay = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  const meta = api.getStepMeta(snapshot.currentStepId) as
    | { label: string; icon: string }
    | undefined;

  if (!meta) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
      <span style={{ fontSize: "1.5rem" }}>{meta.icon}</span>
      <span style={{ fontSize: "0.85rem", color: "#888" }}>{meta.label}</span>
    </div>
  );
};

const ExecutionPathsViewer = () => {
  const snapshot = journey.useJourneySnapshot();
  const timeline = snapshot.history.timeline;
  const [pathsResult, setPathsResult] = React.useState<ExecutionPathsResult | null>(null);
  const [matchedEventTypes, setMatchedEventTypes] = React.useState<string[]>([]);

  journey.useJourneyEvent((event) => {
    if (event.type === "journey.start") {
      setMatchedEventTypes([]);
      return;
    }

    if (event.type === "transition.success") {
      setMatchedEventTypes((previous) => [...previous, event.eventType]);
    }
  });

  React.useEffect(() => {
    if (snapshot.status === "idled" && snapshot.history.timeline.length === 1) {
      setMatchedEventTypes([]);
    }
  }, [snapshot.history.timeline.length, snapshot.status]);

  React.useEffect(() => {
    if ("getExecutionPaths" in journey.machine) {
      const fn = (journey.machine as { getExecutionPaths: (opts?: unknown) => unknown })
        .getExecutionPaths;
      setPathsResult(fn({ maxPaths: 30, maxDepth: 20 }) as ExecutionPathsResult);
    }
  }, []);

  if (!pathsResult) return null;

  const matchingPaths = pathsResult.paths.filter((path) =>
    pathMatchesCurrentFlow(path, timeline, matchedEventTypes)
  );

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Execution Paths</h3>
      <p className="paths-help">
        Highlighted paths match the current flow prefix using the visited step timeline and the
        successful transition events emitted so far.
      </p>
      <div className="paths-summary">
        <span>
          Matching now: {matchingPaths.length} / {pathsResult.paths.length}
        </span>
        <span>Truncated: {pathsResult.truncated ? "yes" : "no"}</span>
        <span>Cycles: {pathsResult.cyclesDetected ? "yes" : "no"}</span>
      </div>
      <div className="paths-scroll">
        <div className="paths-grid">
          {matchingPaths.length === 0 && (
            <div className="path-empty-state">No execution paths match the current flow.</div>
          )}
          {matchingPaths.map((path, index) => {
            const isExact = pathHasExactCurrentPrefix(path, timeline, matchedEventTypes);

            return (
              <div
                key={`${path.steps.join(">")}::${path.events.join(">")}::${index}`}
                className={["path-card", "path-card-matched", isExact ? "path-card-exact" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="path-card-header">
                  <span className="path-index">Path {index + 1}</span>
                  <span className="path-termination">{formatTermination(path.terminated)}</span>
                </div>

                <div className="path-badges">
                  <span className="path-badge path-badge-match">valid now</span>
                  {isExact && <span className="path-badge path-badge-exact">exact prefix</span>}
                </div>

                <div className="path-steps">
                  {path.steps.map((stepId, stepIndex) => (
                    <React.Fragment key={`${stepId}-${stepIndex}`}>
                      {stepIndex > 0 && <span className="path-arrow">→</span>}
                      <span
                        className={
                          stepIndex < timeline.length && timeline[stepIndex] === stepId
                            ? "path-token path-token-active"
                            : "path-token"
                        }
                      >
                        {stepId}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                <div className="path-events">
                  {path.events.length === 0 ? (
                    <span className="path-empty">No events yet</span>
                  ) : (
                    path.events.map((eventType, eventIndex) => (
                      <span
                        key={`${eventType}-${eventIndex}`}
                        className={
                          eventIndex < matchedEventTypes.length &&
                          matchedEventTypes[eventIndex] === eventType
                            ? "path-event path-event-active"
                            : "path-event"
                        }
                      >
                        {eventType}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TimelineDisplay = () => {
  const timeline = journey.useJourneySelector((s) => s.history.timeline);

  return (
    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
      Timeline: {timeline.join(" → ")}
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
          Showcase: Graph Mode <span className="badge badge-graph">GRAPH</span>
        </h1>
        <p>
          Full branching flow with async guards, effects, custom events, and the execution paths
          plugin.
        </p>
      </header>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step: {snapshot.currentStepId} (visited {computed.visitedStepCount} steps)
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

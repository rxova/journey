import React from "react";
import ReactDOM from "react-dom/client";
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import {
  pluginStorageKey,
  pluginTitles,
  type PluginContext,
  type PluginDemoKind,
  type PluginStepId
} from "../fixtures/plugin-fixtures";
import { createLogStore, createStoragePreview, formatJson } from "../fixtures/support";
import type { AnyJourneyMachine, EventPayloadOf, SnapshotOf } from "@rxova/journey-react";
import type { JourneySubscriptionEvent } from "@rxova/journey-core";
import "../styles/demo.css";

// Machine-argument bridges over React's own primitives — all a caller-owned
// core machine needs (the headless hook package is gone by design).
const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange),
    [machine]
  );
  const getSnapshot = React.useCallback(
    () => machine.getSnapshot() as SnapshotOf<TMachine>,
    [machine]
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const useJourneyEvent = <
  TMachine extends AnyJourneyMachine,
  TEvent extends JourneySubscriptionEvent
>(
  machine: TMachine,
  event: TEvent,
  listener: (payload: EventPayloadOf<TMachine, TEvent>) => void
): void => {
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;
  React.useEffect(
    () =>
      machine.subscriptions.subscribeEvent(event, (payload) =>
        listenerRef.current(payload as EventPayloadOf<TMachine, TEvent>)
      ),
    [machine, event]
  );
};

type PluginEvent = { type: "next" };
type AnalyticsEvent = { name: string; payload: unknown };

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: PluginContext;
  stepId: PluginStepId;
  events: PluginEvent;
  meta: { label: string };
}>();

const demoDefinition = build({
  initial: "profile",
  context: { name: "", email: "", notes: "" },
  steps: [
    createStep("profile", {
      metadata: { label: "Profile" },
      on: { next: [to("review")] }
    }),
    createStep("review", {
      metadata: { label: "Review" },
      on: { next: [to("done")] }
    }),
    createStep("done", { metadata: { label: "Done" } })
  ]
});

const useLogStore = <T,>(store: ReturnType<typeof createLogStore<T>>) =>
  React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

const makeApp = (kind: PluginDemoKind) => {
  const analyticsStore = createLogStore<AnalyticsEvent>();
  const storageKey = pluginStorageKey("react", kind);
  const machine = createGraphJourney(demoDefinition, {
    autoStart: true,
    plugins: [
      createAnalyticsPlugin({
        track: (event) => analyticsStore.push({ name: event.name, payload: event.payload })
      }),
      createAutosavePlugin({
        storage: window.localStorage,
        key: storageKey,
        debounceMs: 250
      }),
      createDiagnosticsPlugin(),
      createExecutionPathsPlugin(),
      createPersistencePlugin({
        storage: window.localStorage,
        key: storageKey
      }),
      createReplayPlugin({ maxEntries: 60 })
    ] as const
  });

  const Controls = () => {
    const snapshot = useJourneySnapshot(machine);
    return (
      <>
        <label className="field">
          Name
          <input
            value={snapshot.context.name}
            onChange={(event) =>
              machine.context.update((context) => ({ ...context, name: event.target.value }))
            }
          />
        </label>
        <label className="field">
          Email
          <input
            value={snapshot.context.email}
            onChange={(event) =>
              machine.context.update((context) => ({ ...context, email: event.target.value }))
            }
          />
        </label>
        <label className="field">
          Notes
          <textarea
            value={snapshot.context.notes}
            onChange={(event) =>
              machine.context.update((context) => ({ ...context, notes: event.target.value }))
            }
          />
        </label>
        <div className="actions">
          <button onClick={() => machine.controls.start()}>Start</button>
          <button onClick={() => void machine.send("next")}>Next</button>
          <button className="secondary" onClick={() => void machine.navigate.goToPreviousStep()}>
            Previous
          </button>
          <button className="secondary" onClick={() => machine.controls.restart()}>
            Restart
          </button>
          {kind === "analytics" && (
            <button
              className="secondary"
              onClick={() =>
                machine.plugins.analytics.trackAnalyticsEvent("manual_marker", {
                  stepId: snapshot.currentStep?.id
                })
              }
            >
              Track marker
            </button>
          )}
          {kind === "autosave" && (
            <>
              <button
                className="secondary"
                onClick={() => void machine.plugins.autosave.flushAutosave()}
              >
                Flush
              </button>
              <button
                className="secondary"
                onClick={() => machine.plugins.autosave.clearAutosave()}
              >
                Clear draft
              </button>
            </>
          )}
          {kind === "replay" && (
            <button
              className="secondary"
              onClick={() => machine.plugins.replay.clearReplaySession()}
            >
              Clear replay
            </button>
          )}
        </div>
      </>
    );
  };

  const PluginPanel = () => {
    const logs = useLogStore(analyticsStore);

    switch (kind) {
      case "analytics":
        return (
          <div className="log-list">
            {logs.map((entry, index) => (
              <div className="log-item" key={`${entry.name}-${index}`}>
                <strong>{entry.name}</strong>
                <pre className="json">{formatJson(entry.payload)}</pre>
              </div>
            ))}
          </div>
        );
      case "autosave":
        return (
          <div className="stack">
            <pre className="json">{formatJson(machine.plugins.autosave.getAutosaveState())}</pre>
            <pre className="json">
              {createStoragePreview(storageKey) || "No draft persisted yet."}
            </pre>
          </div>
        );
      case "persistence":
        return (
          <div className="stack">
            <p className="muted">Edit the context, move to another step, then reload.</p>
            <pre className="json">
              {createStoragePreview(storageKey) || "No persisted snapshot yet."}
            </pre>
          </div>
        );
      case "replay":
        return (
          <div className="stack">
            <pre className="json">{formatJson(machine.plugins.replay.getReplaySession())}</pre>
            <pre className="json">
              {machine.plugins.replay.exportReplaySession({ pretty: true })}
            </pre>
          </div>
        );
      case "diagnostics": {
        const diagnostics = machine.plugins.diagnostics.getDiagnostics();
        return (
          <div className="stack">
            <div className="log-list">
              {diagnostics.issues.map((issue, index) => (
                <div className="issue-item" key={`${issue.code}-${index}`}>
                  <strong
                    className={issue.severity === "error" ? "severity-error" : "severity-warning"}
                  >
                    {issue.code}
                  </strong>{" "}
                  <span className="muted">{issue.stepId ?? "structural"}</span>
                </div>
              ))}
            </div>
            <pre className="json">{formatJson(diagnostics.summary)}</pre>
          </div>
        );
      }
      case "execution-paths": {
        const paths = [
          machine.plugins["execution-paths"].getCurrentPath(),
          ...machine.plugins["execution-paths"].getCompletedPaths()
        ];
        return (
          <div className="path-list">
            {paths.map((path, index) => (
              <div className="path-item" key={index}>
                <strong>{index === 0 ? "Current run" : `Completed ${index}`}</strong>
                <div className="muted">{path.join(" -> ") || "(empty)"}</div>
              </div>
            ))}
          </div>
        );
      }
    }
  };

  const App = () => {
    const snapshot = useJourneySnapshot(machine);
    const eventLogs = useLogStore(analyticsStore);

    useJourneyEvent(machine, "stepEnter", (event) => {
      if (kind !== "analytics" && kind !== "autosave") {
        analyticsStore.push({ name: "stepEnter", payload: event });
      }
    });

    return (
      <div className="app-shell">
        <header className="hero">
          <div className="hero-meta">
            <span className="badge badge-react">React</span>
            <span className="badge badge-plugin">Plugin</span>
          </div>
          <h1>{`React ${pluginTitles[kind]}`}</h1>
          <p>Typed Core machine consumed through the machine-argument headless React hooks.</p>
        </header>
        <div className="split">
          <div className="stack">
            <section className="card">
              <h2>Controls</h2>
              <div className="status-row">
                <span className={`status-pill status-${snapshot.status}`}>{snapshot.status}</span>
                <span className="token">step: {snapshot.currentStep?.id ?? "none"}</span>
                <span className="token">visited: {snapshot.history.timeline.join(" -> ")}</span>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Controls />
              </div>
            </section>
            <section className="card">
              <h2>Plugin output</h2>
              <PluginPanel />
            </section>
          </div>
          <div className="stack">
            <section className="card">
              <h2>Snapshot</h2>
              <pre className="json">{formatJson(snapshot)}</pre>
            </section>
            <section className="card">
              <h2>Observed events</h2>
              <div className="log-list">
                {eventLogs.map((entry, index) => (
                  <div className="log-item" key={`${entry.name}-${index}`}>
                    {entry.name}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return App;
};

export const mountReactPluginDemo = (kind: PluginDemoKind, element: HTMLElement) => {
  const root = ReactDOM.createRoot(element);
  const App = makeApp(kind);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

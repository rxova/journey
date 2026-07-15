/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import React from "react";
import ReactDOM from "react-dom/client";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import {
  useJourneyEvent as useEventOf,
  useJourneySnapshot as useSnapshotOf
} from "@rxova/journey-react/headless";

// Minimal runtime adapter: the machine is created with core and consumed with
// the headless machine-argument hooks (the old runtime-object API is gone).
const createJourney = (definition, options) => {
  const machine = Array.isArray(definition.steps)
    ? createLinearJourney(definition, { ...options, autoStart: true })
    : createGraphJourney(definition, { ...options, autoStart: true });
  const api = Object.assign(
    machine,
    {
      startJourney: () => machine.controls.start(),
      resetJourney: () => machine.controls.restart(),
      updateContext: (updater) => machine.context.update(updater),
      goToNextStep: () => machine.navigate.goToNextStep(),
      goToPreviousStep: () => machine.navigate.goToPreviousStep()
    },
    ...Object.values(machine.plugins)
  );

  return {
    machine: api,
    useJourneySnapshot: () => useSnapshotOf(machine),
    useJourneyApi: () => api,
    useJourneyEvent: (listener) => useEventOf(machine, listener)
  };
};
type JourneyRuntime = ReturnType<typeof createJourney>["machine"];
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import {
  pluginDefinition,
  pluginStorageKey,
  pluginTitles,
  structureDefinition,
  type PluginContext,
  type PluginDemoKind
} from "../fixtures/plugin-fixtures";
import { createLogStore, createStoragePreview, formatJson } from "../fixtures/support";
import "../styles/demo.css";

type AnalyticsEvent = { name: string; payload: unknown };

const createRuntime = (kind: PluginDemoKind) => {
  const analyticsStore = createLogStore<AnalyticsEvent>();
  const storageKey = pluginStorageKey("react", kind);

  const runtime =
    kind === "diagnostics"
      ? createJourney(structureDefinition, {
          plugins: [createDiagnosticsPlugin()] as const
        })
      : kind === "execution-paths"
        ? createJourney(structureDefinition, {
            plugins: [createExecutionPathsPlugin()] as const
          })
        : kind === "analytics"
          ? createJourney(pluginDefinition, {
              plugins: [
                createAnalyticsPlugin({
                  machineId: "react-plugin-analytics",
                  includeStepMeta: true,
                  track: (event) =>
                    analyticsStore.push({ name: event.name, payload: event.payload })
                })
              ] as const
            })
          : kind === "autosave"
            ? createJourney(pluginDefinition, {
                plugins: [
                  createAutosavePlugin({
                    storage: window.localStorage,
                    key: storageKey,
                    debounceMs: 250
                  })
                ] as const
              })
            : kind === "persistence"
              ? createJourney(pluginDefinition, {
                  plugins: [
                    createPersistencePlugin({
                      storage: window.localStorage,
                      key: storageKey
                    })
                  ] as const
                })
              : createJourney(pluginDefinition, {
                  plugins: [createReplayPlugin({ maxEntries: 60 })] as const
                });

  return { runtime, analyticsStore, storageKey };
};

const useLogStore = <T,>(store: ReturnType<typeof createLogStore<T>>) =>
  React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

const pluginViews = {
  profile: () => null,
  review: () => null,
  done: () => null
};

const structureViews = {
  start: () => null,
  address: () => null,
  review: () => null,
  blocked: () => null,
  done: () => null,
  orphan: () => null
};

const makeApp = (kind: PluginDemoKind) => {
  const { runtime, analyticsStore, storageKey } = createRuntime(kind);

  const title = `React ${pluginTitles[kind]}`;
  const isStructural = kind === "diagnostics" || kind === "execution-paths";

  const Controls = () => {
    const snapshot = runtime.useJourneySnapshot();
    const api = runtime.useJourneyApi();

    if (isStructural) {
      return (
        <div className="actions">
          <button onClick={() => void api.startJourney()}>Start</button>
          <button className="secondary" onClick={() => api.resetJourney()}>
            Reset
          </button>
        </div>
      );
    }

    return (
      <>
        <label className="field">
          Name
          <input
            value={(snapshot.context as PluginContext).name}
            onChange={(event) =>
              void api.updateContext((context) => ({
                ...context,
                name: event.target.value
              }))
            }
          />
        </label>
        <label className="field">
          Email
          <input
            value={(snapshot.context as PluginContext).email}
            onChange={(event) =>
              void api.updateContext((context) => ({
                ...context,
                email: event.target.value
              }))
            }
          />
        </label>
        <label className="field">
          Notes
          <textarea
            value={(snapshot.context as PluginContext).notes}
            onChange={(event) =>
              void api.updateContext((context) => ({
                ...context,
                notes: event.target.value
              }))
            }
          />
        </label>
        <div className="actions">
          <button onClick={() => void api.startJourney()}>Start</button>
          <button onClick={() => void api.goToNextStep()}>Next</button>
          <button className="secondary" onClick={() => void api.goToPreviousStep()}>
            Previous
          </button>
          <button className="secondary" onClick={() => api.resetJourney()}>
            Reset
          </button>
          {kind === "analytics" && (
            <button
              className="secondary"
              onClick={() =>
                (
                  runtime.machine as JourneyRuntime & {
                    trackAnalyticsEvent: (name: string, payload?: Record<string, unknown>) => void;
                  }
                ).trackAnalyticsEvent("manual_marker", {
                  stepId: snapshot.currentStep?.id
                })
              }
            >
              Track Marker
            </button>
          )}
          {kind === "autosave" && (
            <>
              <button
                className="secondary"
                onClick={() =>
                  void (
                    runtime.machine as JourneyRuntime & { flushAutosave: () => Promise<void> }
                  ).flushAutosave()
                }
              >
                Flush
              </button>
              <button
                className="secondary"
                onClick={() =>
                  (
                    runtime.machine as JourneyRuntime & { clearAutosave: () => void }
                  ).clearAutosave()
                }
              >
                Clear Draft
              </button>
            </>
          )}
          {kind === "replay" && (
            <button
              className="secondary"
              onClick={() =>
                (
                  runtime.machine as JourneyRuntime & { clearReplaySession: () => void }
                ).clearReplaySession()
              }
            >
              Clear Replay
            </button>
          )}
        </div>
      </>
    );
  };

  const PluginPanel = () => {
    const snapshot = runtime.useJourneySnapshot();
    const logs = useLogStore(analyticsStore);

    if (kind === "analytics") {
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
    }

    if (kind === "autosave") {
      const state = (
        runtime.machine as JourneyRuntime & {
          getAutosaveState: () => unknown;
        }
      ).getAutosaveState();

      return (
        <div className="stack">
          <pre className="json">{formatJson(state)}</pre>
          <pre className="json">
            {createStoragePreview(storageKey) || "No draft persisted yet."}
          </pre>
        </div>
      );
    }

    if (kind === "persistence") {
      return (
        <div className="stack">
          <p className="muted">
            Storage hydrates on reload. Edit the context, move to another step, then reload this
            example.
          </p>
          <pre className="json">
            {createStoragePreview(storageKey) || "No persisted snapshot yet."}
          </pre>
        </div>
      );
    }

    if (kind === "replay") {
      const replayMachine = runtime.machine as JourneyRuntime & {
        getReplaySession: () => unknown;
        exportReplaySession: (options?: { pretty?: boolean }) => string;
      };

      return (
        <div className="stack">
          <pre className="json">{formatJson(replayMachine.getReplaySession())}</pre>
          <pre className="json">{replayMachine.exportReplaySession({ pretty: true })}</pre>
        </div>
      );
    }

    if (kind === "diagnostics") {
      const diagnosticsMachine = runtime.machine as JourneyRuntime & {
        getDiagnostics: (options?: { requireExplicitCompletion?: boolean }) => {
          issues: Array<{ code: string; severity: "warning" | "error"; stepId?: string }>;
          summary: unknown;
        };
      };

      const diagnostics = diagnosticsMachine.getDiagnostics({ requireExplicitCompletion: true });

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

    const pathsMachine = runtime.machine as JourneyRuntime & {
      getCurrentPath: () => readonly string[];
      getCompletedPaths: () => readonly (readonly string[])[];
    };
    const paths = [pathsMachine.getCurrentPath(), ...pathsMachine.getCompletedPaths()];

    return (
      <div className="stack">
        <div className="status-row">
          <span className="token">paths: {paths.length}</span>
        </div>
        <div className="path-list">
          {paths.map((path, index) => (
            <div className="path-item" key={index}>
              <strong>{index === 0 ? "Current run" : `Completed ${index}`}</strong>
              <div className="muted">{path.join(" -> ") || "(empty)"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const App = () => {
    const snapshot = runtime.useJourneySnapshot();
    const eventLogs = useLogStore(analyticsStore);

    runtime.useJourneyEvent((event) => {
      if (kind !== "analytics" && kind !== "autosave") {
        analyticsStore.push({ name: event.type, payload: event });
      }
    });

    React.useLayoutEffect(() => {
      if (runtime.machine.getSnapshot().status === "idle") {
        void runtime.machine.startJourney();
      }
    }, []);

    return (
      <>
        <div className="app-shell">
          <header className="hero">
            <div className="hero-meta">
              <span className="badge badge-react">React</span>
              <span className="badge badge-plugin">Plugin</span>
            </div>
            <h1>{title}</h1>
            <p>
              Prefixed runnable Vite example for the {pluginTitles[kind].toLowerCase()} using
              `createJourney()`.
            </p>
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
                <h2>Plugin Output</h2>
                <PluginPanel />
              </section>
            </div>

            <div className="stack">
              <section className="card">
                <h2>Snapshot</h2>
                <pre className="json">{formatJson(snapshot)}</pre>
              </section>
              <section className="card">
                <h2>Observed Events</h2>
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
      </>
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

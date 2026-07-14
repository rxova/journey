import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { createAnalyticsPlugin, type AnalyticsApi } from "@rxova/journey-core/analytics";
import { createAutosavePlugin, type AutosaveApi } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin, type DiagnosticsApi } from "@rxova/journey-core/diagnostics";
import {
  createExecutionPathsPlugin,
  type ExecutionPathsApi
} from "@rxova/journey-core/execution-paths";
import { createPersistencePlugin, type PersistenceApi } from "@rxova/journey-core/persistence";
import { createReplayPlugin, type ReplayApi } from "@rxova/journey-core/replay";
import type {
  GraphJourneyMachine,
  JourneySnapshot,
  JourneySubscriptionEvent,
  LinearJourneyMachine
} from "@rxova/journey-core";
import "../styles/demo.css";
import {
  pluginDefinition,
  pluginStorageKey,
  pluginTitles,
  structureDefinition,
  type PluginContext,
  type PluginDemoKind,
  type PluginStepId,
  type StructureEvent,
  type StructureStepId
} from "../fixtures/plugin-fixtures";
import { createLogStore, createStoragePreview, formatJson } from "../fixtures/support";

type LinearDemoMachine = LinearJourneyMachine<PluginContext, PluginStepId>;
type StructureDemoMachine = GraphJourneyMachine<
  Record<string, never>,
  StructureStepId,
  StructureEvent
>;
type DemoMachine = LinearDemoMachine | StructureDemoMachine;

const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "stepEnter",
  "stepLeave",
  "statusChange",
  "contextChange",
  "navigationBlocked",
  "error"
];

const isStructureDemo = (kind: PluginDemoKind) =>
  kind === "diagnostics" || kind === "execution-paths";

export const mountCorePluginDemo = (kind: PluginDemoKind, root: HTMLElement) => {
  const eventStore = createLogStore<{ name: string; payload: unknown }>();
  const storageKey = pluginStorageKey("core", kind);

  const machine: DemoMachine = (
    kind === "diagnostics"
      ? createGraphJourney(structureDefinition, {
          autoStart: true,
          plugins: [createDiagnosticsPlugin()] as const
        })
      : kind === "execution-paths"
        ? createGraphJourney(structureDefinition, {
            autoStart: true,
            plugins: [createExecutionPathsPlugin()] as const
          })
        : kind === "analytics"
          ? createLinearJourney(pluginDefinition, {
              autoStart: true,
              plugins: [
                createAnalyticsPlugin({
                  track: (event) => eventStore.push({ name: event.name, payload: event.payload })
                })
              ] as const
            })
          : kind === "autosave"
            ? createLinearJourney(pluginDefinition, {
                autoStart: true,
                plugins: [
                  createAutosavePlugin({
                    storage: window.localStorage,
                    key: storageKey,
                    debounceMs: 250
                  })
                ] as const
              })
            : kind === "persistence"
              ? createLinearJourney(pluginDefinition, {
                  autoStart: true,
                  plugins: [
                    createPersistencePlugin({ storage: window.localStorage, key: storageKey })
                  ] as const
                })
              : createLinearJourney(pluginDefinition, {
                  autoStart: true,
                  plugins: [createReplayPlugin({ maxEntries: 60 })] as const
                })
  ) as DemoMachine;

  const pluginApi = machine.plugins as Partial<{
    analytics: AnalyticsApi;
    autosave: AutosaveApi;
    diagnostics: DiagnosticsApi;
    "execution-paths": ExecutionPathsApi;
    persistence: PersistenceApi;
    replay: ReplayApi;
  }>;

  if (kind !== "analytics") {
    for (const eventName of OBSERVED_EVENTS) {
      machine.subscriptions.subscribeEvent(eventName, () => {
        eventStore.push({ name: eventName, payload: null });
      });
    }
  }

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const field = target.dataset.field as keyof PluginContext | undefined;
    if (!field) {
      return;
    }

    (machine as LinearDemoMachine).context.update((context) => ({
      ...context,
      [field]: target.value
    }));
  });

  const renderPluginPanel = () => {
    if (kind === "analytics") {
      return eventStore
        .getSnapshot()
        .map(
          (entry) =>
            `<div class="log-item"><strong>${entry.name}</strong><pre class="json">${formatJson(entry.payload)}</pre></div>`
        )
        .join("");
    }

    if (kind === "autosave") {
      const autosave = pluginApi.autosave as AutosaveApi;
      return `<pre class="json">${formatJson(autosave.getAutosaveState())}</pre><pre class="json">${
        createStoragePreview(storageKey) || "No draft persisted yet."
      }</pre>`;
    }

    if (kind === "persistence") {
      const persistence = pluginApi.persistence as PersistenceApi;
      return `<pre class="json">${formatJson(persistence.inspectPersistedState())}</pre><pre class="json">${
        createStoragePreview(storageKey) || "No persisted snapshot yet."
      }</pre>`;
    }

    if (kind === "replay") {
      const replay = pluginApi.replay as ReplayApi;
      return `<pre class="json">${replay.exportReplaySession({ pretty: true })}</pre>`;
    }

    if (kind === "diagnostics") {
      const diagnostics = (pluginApi.diagnostics as DiagnosticsApi).getDiagnostics();
      return `<div class="log-list">${diagnostics.issues
        .map(
          (issue) =>
            `<div class="issue-item"><strong class="severity-${issue.severity}">${issue.code}</strong> ${
              issue.stepId ?? issue.from ?? "structural"
            }</div>`
        )
        .join("")}</div><pre class="json">${formatJson(diagnostics.summary)}</pre>`;
    }

    const paths = pluginApi["execution-paths"] as ExecutionPathsApi;
    const renderPath = (steps: readonly string[], label: string) =>
      `<div class="path-item"><strong>${label}</strong><div class="muted">${steps.join(" -> ") || "(empty)"}</div></div>`;
    return `<div class="path-list">${[
      renderPath(paths.getCurrentPath(), "Current run"),
      ...paths
        .getCompletedPaths()
        .map((steps, index) => renderPath(steps, `Finished run ${index + 1}`))
    ].join("")}</div>`;
  };

  const render = () => {
    const snapshot = machine.getSnapshot() as JourneySnapshot;
    const context = snapshot.context as PluginContext;
    const statefulControls = isStructureDemo(kind)
      ? ""
      : `<label class="field">Name<input data-field="name" value="${context.name}" /></label>
         <label class="field">Email<input data-field="email" value="${context.email}" /></label>
         <label class="field">Notes<textarea data-field="notes">${context.notes}</textarea></label>`;

    const structureButtons = isStructureDemo(kind)
      ? `<button data-action="send-next">Send next</button>
         <button class="secondary" data-action="send-reject">Send reject</button>`
      : `<button data-action="next">Next</button>`;

    root.innerHTML = `
      <div class="app-shell">
        <header class="hero">
          <div class="hero-meta">
            <span class="badge badge-core">Core</span>
            <span class="badge badge-plugin">Plugin</span>
          </div>
          <h1>Core ${pluginTitles[kind]}</h1>
          <p>Runnable Vite example for the ${pluginTitles[kind].toLowerCase()} on the rewritten core.</p>
        </header>
        <div class="split">
          <div class="stack">
            <section class="card">
              <h2>Controls</h2>
              <div class="status-row">
                <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
                <span class="token">step: ${snapshot.currentStep?.id ?? "—"}</span>
                <span class="token">timeline: ${snapshot.history.timeline.join(" -> ")}</span>
                ${
                  snapshot.type === "graph"
                    ? `<span class="token">events: ${snapshot.availableEvents.join(", ") || "none"}</span>`
                    : ""
                }
              </div>
              <div style="margin-top: 1rem">${statefulControls}</div>
              <div class="actions">
                ${structureButtons}
                <button class="secondary" data-action="previous">Previous</button>
                <button class="secondary" data-action="reset">Reset</button>
                ${
                  kind === "analytics"
                    ? `<button class="secondary" data-action="marker">Track Marker</button>`
                    : ""
                }
                ${
                  kind === "autosave"
                    ? `<button class="secondary" data-action="flush">Flush</button><button class="secondary" data-action="clear-draft">Clear Draft</button>`
                    : ""
                }
                ${
                  kind === "replay"
                    ? `<button class="secondary" data-action="clear-replay">Clear Replay</button>`
                    : ""
                }
              </div>
            </section>
            <section class="card">
              <h2>Plugin Output</h2>
              <div class="stack">${renderPluginPanel()}</div>
            </section>
          </div>
          <div class="stack">
            <section class="card">
              <h2>Snapshot</h2>
              <pre class="json">${formatJson(snapshot)}</pre>
            </section>
            <section class="card">
              <h2>Observed Events</h2>
              <div class="log-list">${eventStore
                .getSnapshot()
                .map((entry) => `<div class="log-item">${entry.name}</div>`)
                .join("")}</div>
            </section>
          </div>
        </div>
      </div>
    `;
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    void (async () => {
      if (action === "next") await (machine as LinearDemoMachine).navigate.goToNextStep();
      if (action === "send-next") await (machine as StructureDemoMachine).send("next");
      if (action === "send-reject") await (machine as StructureDemoMachine).send("reject");
      if (action === "previous") await machine.navigate.goToPreviousStep();
      if (action === "reset") {
        if (machine.getSnapshot().status !== "terminated") {
          machine.controls.terminate();
        }
        machine.controls.restart();
      }
      if (action === "marker") {
        pluginApi.analytics?.trackAnalyticsEvent("manual_marker", {
          stepId: machine.getSnapshot().currentStep?.id ?? null
        });
      }
      if (action === "flush") {
        await pluginApi.autosave?.flushAutosave();
      }
      if (action === "clear-draft") {
        pluginApi.autosave?.clearAutosave();
      }
      if (action === "clear-replay") {
        pluginApi.replay?.clearReplaySession();
      }
      render();
    })();
  });

  machine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => render()
  );
  eventStore.subscribe(() => render());

  render();
};

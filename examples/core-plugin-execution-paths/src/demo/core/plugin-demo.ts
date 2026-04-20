/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import {
  createJourneyMachine,
  type JourneyMachine,
  type JourneySnapshot
} from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import "../styles/demo.css";
import {
  pluginDefinition,
  pluginStorageKey,
  pluginTitles,
  structureDefinition,
  type PluginContext,
  type PluginDemoKind
} from "../fixtures/plugin-fixtures";
import { createLogStore, createStoragePreview, formatJson } from "../fixtures/support";

type AnyMachine = JourneyMachine<any, any, any, any>;

const bindInputState = (root: HTMLElement, machine: AnyMachine) => {
  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const field = target.dataset.field as keyof PluginContext | undefined;
    if (!field) {
      return;
    }

    void machine.updateContext((context: PluginContext) => ({
      ...context,
      [field]: target.value
    }));
  });
};

export const mountCorePluginDemo = async (kind: PluginDemoKind, root: HTMLElement) => {
  const analyticsStore = createLogStore<{ name: string; payload: unknown }>();
  const storageKey = pluginStorageKey("core", kind);

  const machine =
    kind === "diagnostics"
      ? createJourneyMachine(structureDefinition, {
          plugins: [createDiagnosticsPlugin()] as const
        })
      : kind === "execution-paths"
        ? createJourneyMachine(structureDefinition, {
            plugins: [createExecutionPathsPlugin()] as const
          })
        : kind === "analytics"
          ? createJourneyMachine(pluginDefinition, {
              plugins: [
                createAnalyticsPlugin({
                  machineId: "core-plugin-analytics",
                  includeStepMeta: true,
                  track: (event) =>
                    analyticsStore.push({ name: event.name, payload: event.payload })
                })
              ] as const
            })
          : kind === "autosave"
            ? createJourneyMachine(pluginDefinition, {
                plugins: [
                  createAutosavePlugin({
                    key: storageKey,
                    debounceMs: 250,
                    hydrate: true
                  })
                ] as const
              })
            : kind === "persistence"
              ? createJourneyMachine(pluginDefinition, {
                  plugins: [createPersistencePlugin({ key: storageKey, version: 1 })] as const
                })
              : createJourneyMachine(pluginDefinition, {
                  plugins: [createReplayPlugin({ maxEntries: 60 })] as const
                });

  machine.subscribeEvent((event) => {
    if (kind !== "analytics") {
      analyticsStore.push({ name: event.type, payload: event });
    }
  });

  bindInputState(root, machine);

  const renderPluginPanel = (snapshot: JourneySnapshot<any, any>) => {
    if (kind === "analytics") {
      return analyticsStore
        .getSnapshot()
        .map(
          (entry) =>
            `<div class="log-item"><strong>${entry.name}</strong><pre class="json">${formatJson(entry.payload)}</pre></div>`
        )
        .join("");
    }

    if (kind === "autosave") {
      const autosaveMachine = machine as AnyMachine & {
        getAutosaveState: () => unknown;
      };
      return `<pre class="json">${formatJson(autosaveMachine.getAutosaveState())}</pre><pre class="json">${
        createStoragePreview(storageKey) || "No draft persisted yet."
      }</pre>`;
    }

    if (kind === "persistence") {
      return `<pre class="json">${createStoragePreview(storageKey) || "No persisted snapshot yet."}</pre>`;
    }

    if (kind === "replay") {
      const replayMachine = machine as AnyMachine & {
        getReplaySession: () => unknown;
        exportReplaySession: (options?: { pretty?: boolean }) => string;
      };
      return `<pre class="json">${formatJson(replayMachine.getReplaySession())}</pre><pre class="json">${replayMachine.exportReplaySession(
        { pretty: true }
      )}</pre>`;
    }

    if (kind === "diagnostics") {
      const diagnostics = (
        machine as AnyMachine & {
          getDiagnostics: (options?: { requireExplicitCompletion?: boolean }) => {
            issues: Array<{ code: string; severity: "warning" | "error"; stepId?: string }>;
            summary: unknown;
          };
        }
      ).getDiagnostics({
        requireExplicitCompletion: true
      });

      return `<div class="log-list">${diagnostics.issues
        .map(
          (issue) =>
            `<div class="issue-item"><strong class="severity-${issue.severity}">${issue.code}</strong> ${
              issue.stepId ?? "structural"
            }</div>`
        )
        .join("")}</div><pre class="json">${formatJson(diagnostics.summary)}</pre>`;
    }

    const executionPaths = (
      machine as AnyMachine & {
        getExecutionPaths: (options?: { maxDepth?: number; maxPaths?: number }) => {
          paths: Array<{ steps: string[]; events: string[]; terminated: string }>;
          truncated: boolean;
          cyclesDetected: boolean;
        };
      }
    ).getExecutionPaths({ maxDepth: 10, maxPaths: 20 });

    return `<div class="status-row"><span class="token">paths: ${executionPaths.paths.length}</span><span class="token">truncated: ${String(
      executionPaths.truncated
    )}</span><span class="token">cycles: ${String(
      executionPaths.cyclesDetected
    )}</span></div><div class="path-list">${executionPaths.paths
      .map(
        (path, index) =>
          `<div class="path-item"><strong>Path ${index + 1}</strong><div class="muted">${path.steps.join(
            " -> "
          )}</div><div class="muted">${path.events.join(" -> ") || "No events"}</div><div class="muted">terminated: ${
            path.terminated
          }</div></div>`
      )
      .join("")}</div>`;
  };

  const render = (snapshot = machine.getSnapshot()) => {
    const statefulControls =
      kind === "diagnostics" || kind === "execution-paths"
        ? ""
        : `<label class="field">Name<input data-field="name" value="${(snapshot.context as PluginContext).name}" /></label>
           <label class="field">Email<input data-field="email" value="${(snapshot.context as PluginContext).email}" /></label>
           <label class="field">Notes<textarea data-field="notes">${(snapshot.context as PluginContext).notes}</textarea></label>`;

    root.innerHTML = `
      <div class="app-shell">
        <header class="hero">
          <div class="hero-meta">
            <span class="badge badge-core">Core</span>
            <span class="badge badge-plugin">Plugin</span>
          </div>
          <h1>Core ${pluginTitles[kind]}</h1>
          <p>Prefixed runnable Vite example for the ${pluginTitles[kind].toLowerCase()} using createJourneyMachine().</p>
        </header>
        <div class="split">
          <div class="stack">
            <section class="card">
              <h2>Controls</h2>
              <div class="status-row">
                <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
                <span class="token">step: ${snapshot.currentStepId}</span>
                <span class="token">visited: ${snapshot.history.timeline.join(" -> ")}</span>
              </div>
              <div style="margin-top: 1rem">${statefulControls}</div>
              <div class="actions">
                <button data-action="start">Start</button>
                <button data-action="next">Next</button>
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
              <div class="stack">${renderPluginPanel(snapshot)}</div>
            </section>
          </div>
          <div class="stack">
            <section class="card">
              <h2>Snapshot</h2>
              <pre class="json">${formatJson(snapshot)}</pre>
            </section>
            <section class="card">
              <h2>Observed Events</h2>
              <div class="log-list">${analyticsStore
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
      if (action === "start") await machine.startJourney();
      if (action === "next") await machine.goToNextStep();
      if (action === "previous") await machine.goToPreviousStep();
      if (action === "reset") machine.resetJourney();
      if (action === "marker") {
        (
          machine as AnyMachine & { trackAnalyticsEvent: (name: string, payload?: unknown) => void }
        ).trackAnalyticsEvent("manual_marker", { stepId: machine.getSnapshot().currentStepId });
      }
      if (action === "flush") {
        await (machine as AnyMachine & { flushAutosave: () => Promise<void> }).flushAutosave();
      }
      if (action === "clear-draft") {
        (machine as AnyMachine & { clearAutosave: () => void }).clearAutosave();
      }
      if (action === "clear-replay") {
        (machine as AnyMachine & { clearReplaySession: () => void }).clearReplaySession();
      }
      render();
    })();
  });

  machine.subscribe(() => render());
  analyticsStore.subscribe(() => render());

  render();
  await machine.startJourney();
};

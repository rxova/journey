import { createGraphJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type { JourneySnapshot, JourneySubscriptionEvent } from "@rxova/journey-core";
import "../styles/demo.css";
import {
  authApi,
  createAuthHandlers,
  graphDefinition,
  type LoginContext,
  type LoginStepId
} from "../fixtures/auth-fixtures";
import { formatJson } from "../fixtures/support";

// Verbs are grouped by namespace on the machine:
//   send()      – the graph's primary verb: fire a domain event and let the
//                 definition's guards decide the actual target step (see the
//                 "when" clauses in auth-fixtures.ts)
//   navigate.*  – timeline moves (goToPreviousStep); goToStepById is
//                 transition-gated sugar
//   controls.*  – lifecycle (complete/terminate/restart), not step-to-step movement
//   context.*   – read/write journey context directly (e.g. form field edits)
//   async.*     – transition-level loading/error state (e.g. clearError)
const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "statusChange",
  "navigationBlocked",
  "error"
];

type LogEntry = { readonly label: string; readonly detail?: string };

type ShowcaseTransition = JourneySnapshot<LoginContext, LoginStepId>["transition"];

const getPendingLabel = (transition: ShowcaseTransition): string => {
  if (!transition.phase) return "Settling step effects";
  if (transition.phase === "entering") return `Entering ${transition.to ?? "step"}`;
  if (transition.phase === "working") return `Working on ${transition.from ?? "step"}`;
  return "Settling step effects";
};

const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "∅";
  }
  const json = JSON.stringify(value);
  return json.length > 24 ? `${json.slice(0, 21)}..."` : json;
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!
  );

const describeContextChange = (previous: LoginContext, current: LoginContext): string => {
  const keys = Object.keys(current) as (keyof LoginContext)[];
  const changed = keys.filter((key) => previous[key] !== current[key]);
  if (changed.length === 0) {
    return "(no fields changed)";
  }
  return changed
    .map((key) => `${key}: ${formatFieldValue(previous[key])} -> ${formatFieldValue(current[key])}`)
    .join(", ");
};

export const mountCoreShowcase = (root: HTMLElement) => {
  // Handlers are runtime functions, so both the policy the guards consult and
  // the client the definition's own work calls are swapped here without
  // touching the definition — the same seam a test would use to inject a fake
  // api. The definition's own default is 2 attempts; nothing about either
  // choice appears in the snapshot, which only carries serializable context.
  const handlers = createAuthHandlers(3, authApi);

  const machine = createGraphJourney(graphDefinition, {
    autoStart: true,
    handlers,
    plugins: [createExecutionPathsPlugin()] as const
  });

  const eventLog: LogEntry[] = [];
  const pushLogEntry = (entry: LogEntry) => {
    eventLog.push(entry);
    if (eventLog.length > 30) {
      eventLog.shift();
    }
  };

  for (const eventName of OBSERVED_EVENTS) {
    machine.subscriptions.subscribeEvent(eventName, () => {
      pushLogEntry({ label: eventName });
    });
  }

  machine.subscriptions.subscribeEvent("contextChange", ({ previous, current }) => {
    pushLogEntry({ label: "contextChange", detail: describeContextChange(previous, current) });
  });

  machine.subscriptions.subscribeEvent("stepEnter", ({ from, to }) => {
    pushLogEntry({ label: "stepEnter", detail: `${from ?? "∅"} -> ${to}` });
  });

  machine.subscriptions.subscribeEvent("stepLeave", ({ from, to }) => {
    pushLogEntry({ label: "stepLeave", detail: `${from} -> ${to}` });
  });

  const currentStepId = (): LoginStepId => machine.getSnapshot().currentStep?.id ?? "login";

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const field = target.dataset.field as keyof LoginContext | undefined;
    if (!field) {
      return;
    }

    machine.context.update((context) => ({
      ...context,
      [field]: target.value,
      error: field === "verificationCode" ? null : context.error
    }));
  });

  const resetJourney = () => {
    if (machine.getSnapshot().status !== "terminated") {
      machine.controls.terminate();
    }
    machine.controls.restart();
  };

  // Step markup is only (re)built when the step actually changes — never on every
  // context update — so an in-progress keystroke never gets its input node replaced.
  const renderStepShell = (stepId: LoginStepId, context: LoginContext): string => {
    if (stepId === "login") {
      return `
        <div class="step-view">
          <h3 class="step-title">Login</h3>
          <p class="muted">Password "blocked" fails; username length picks the 2FA method.</p>
          <label class="field">Username<input data-field="username" value="${escapeHtml(context.username)}" /></label>
          <label class="field">Password<input data-field="password" type="password" value="${escapeHtml(context.password)}" /></label>
          <div class="severity-error" data-role="error" hidden></div>
          <div class="actions"><button data-action="login">Sign In</button></div>
        </div>
      `;
    }

    if (stepId === "setup2fa") {
      return `
        <div class="step-view">
          <h3 class="step-title">Setup 2FA</h3>
          <p class="muted">Scan the code, then continue to verification.</p>
          <pre class="json" data-role="qrcode"></pre>
          <div class="actions">
            <button class="secondary" data-action="back">Back</button>
            <button data-action="continue-setup">Continue</button>
          </div>
        </div>
      `;
    }

    if (stepId === "verifyCode" || stepId === "emailCode" || stepId === "authenticatorCode") {
      return `
        <div class="step-view">
          <h3 class="step-title">${escapeHtml(stepId)}</h3>
          <p class="muted">Use 123456 to succeed.</p>
          <label class="field">Verification Code<input data-field="verificationCode" value="${escapeHtml(context.verificationCode)}" /></label>
          <div class="severity-error" data-role="error" hidden></div>
          <div class="status-row"><span class="token" data-role="attempts"></span></div>
          <div class="actions">
            <button class="secondary" data-action="back">Back</button>
            <button data-action="verify">Verify</button>
          </div>
        </div>
      `;
    }

    if (stepId === "loggedIn") {
      return `
        <div class="step-view">
          <h3 class="step-title">Logged In</h3>
          <p data-role="status-message"></p>
          <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
        </div>
      `;
    }

    return `
      <div class="step-view">
        <h3 class="step-title">Blocked</h3>
        <p class="severity-error" data-role="status-message"></p>
        <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
      </div>
    `;
  };

  // Fills in the parts of the mounted step that change on every snapshot, without
  // touching the <input> elements themselves.
  const updateStepContent = (
    stepContainer: HTMLElement,
    stepId: LoginStepId,
    context: LoginContext,
    isLoading: boolean
  ) => {
    const errorEl = stepContainer.querySelector<HTMLElement>('[data-role="error"]');
    if (errorEl) {
      errorEl.textContent = context.error ?? "";
      errorEl.hidden = !context.error;
    }

    const qrEl = stepContainer.querySelector<HTMLElement>('[data-role="qrcode"]');
    if (qrEl) {
      qrEl.textContent = context.qrCode ?? "Generating…";
    }

    const attemptsEl = stepContainer.querySelector<HTMLElement>('[data-role="attempts"]');
    if (attemptsEl) {
      attemptsEl.textContent = `attempts: ${context.attempts}`;
    }

    const statusMessageEl = stepContainer.querySelector<HTMLElement>(
      '[data-role="status-message"]'
    );
    if (statusMessageEl) {
      statusMessageEl.textContent =
        stepId === "blocked"
          ? (context.error ?? "Too many failed attempts.")
          : `Welcome, ${context.username || "User"}.`;
    }

    stepContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = isLoading;
    });
  };

  // `availableEvents` collapses every candidate for an event into one name, so it
  // cannot show *why* a route was taken. `outgoingTransitions` keeps each
  // candidate separate — the guard result and the first-enabled-wins pick — which
  // is the only place the routing rule is visible as data.
  const renderOutgoingTransitions = (
    outgoing: ReturnType<typeof machine.getSnapshot>["outgoingTransitions"]
  ) => {
    if (outgoing.length === 0) {
      return `<div class="muted">No outgoing transitions — this step is terminal.</div>`;
    }

    const guardClass: Record<string, string> = {
      passed: "token-success",
      failed: "token-error",
      none: ""
    };

    return outgoing
      .map((candidate) => {
        const token = (label: string, value: string, stateClass = "") =>
          `<span class="token ${stateClass}"><span class="token-label">${label}</span><span class="token-value">${value}</span></span>`;
        return `
          <div class="log-item">
            <strong>${escapeHtml(candidate.event)} -> ${escapeHtml(candidate.to)}</strong>
            <div class="status-row">
              ${token("priority", String(candidate.priority))}
              ${token("guard", candidate.guard, guardClass[candidate.guard] ?? "")}
              ${token("enabled", String(candidate.enabled), candidate.enabled ? "token-success" : "")}
              ${token("selected", String(candidate.selected), candidate.selected ? "token-success" : "")}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderExecutionPaths = () => {
    const api = machine.plugins["execution-paths"];
    const renderPath = (steps: readonly string[], label: string) =>
      `<div class="path-item"><strong>${label}</strong><div class="muted">${steps.join(" -> ") || "(empty)"}</div></div>`;
    return [
      renderPath(api.getCurrentPath(), "Current run"),
      ...api
        .getCompletedPaths()
        .map((steps, index) => renderPath(steps, `Finished run ${index + 1}`))
    ].join("");
  };

  root.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <div class="hero-meta">
          <span class="badge badge-core">Core</span>
          <span class="badge badge-graph">graph</span>
        </div>
        <h1>Core Showcase Graph</h1>
        <p>Event-driven transitions: send() is the primary verb, goToStepById is gated.</p>
      </header>
      <section class="card">
        <h2>Runtime</h2>
        <div class="status-row" data-role="status-row"></div>
      </section>
      <div class="split">
        <section class="card card-relative">
          <h2>Component</h2>
          <div data-role="step-slot"></div>
          <div class="pending-overlay" data-role="pending-overlay" hidden>
            <span class="spinner" aria-label="Loading"></span>
            <strong data-role="pending-label"></strong>
          </div>
        </section>
        <section class="card">
          <h2>Snapshot</h2>
          <pre class="json" data-role="snapshot"></pre>
        </section>
      </div>
      <section class="card">
        <h2>Outgoing Transitions</h2>
        <p class="hint">
          Every candidate declared from the current step, in declaration order.
          <code>guard</code> is the live result of the candidate's <code>when</code>,
          and <code>selected</code> marks the one <code>send()</code> would pick under
          first-enabled-wins. Fail a code to watch the <code>blocked</code> candidate
          flip from <code>failed</code> to <code>selected</code>, outranking the retry.
        </p>
        <div class="log-list" data-role="outgoing-transitions"></div>
      </section>
      <section class="card">
        <h2>Execution Paths</h2>
        <div class="path-list" data-role="execution-paths"></div>
      </section>
      <section class="card">
        <h2>Observed Events</h2>
        <div class="log-list" data-role="event-log"></div>
      </section>
    </div>
  `;

  const statusRowEl = root.querySelector<HTMLElement>('[data-role="status-row"]')!;
  const stepSlot = root.querySelector<HTMLElement>('[data-role="step-slot"]')!;
  const pendingOverlayEl = root.querySelector<HTMLElement>('[data-role="pending-overlay"]')!;
  const pendingLabelEl = root.querySelector<HTMLElement>('[data-role="pending-label"]')!;
  const snapshotEl = root.querySelector<HTMLElement>('[data-role="snapshot"]')!;
  const outgoingEl = root.querySelector<HTMLElement>('[data-role="outgoing-transitions"]')!;
  const executionPathsEl = root.querySelector<HTMLElement>('[data-role="execution-paths"]')!;
  const eventLogEl = root.querySelector<HTMLElement>('[data-role="event-log"]')!;

  let mountedStepId: LoginStepId | null = null;
  const render = () => {
    const snapshot = machine.getSnapshot();
    const context = snapshot.context;
    const stepId = currentStepId();
    const transition = snapshot.transition;
    const isLoading = snapshot.machine.isLoading;

    const token = (label: string, value: string, stateClass = "") =>
      `<span class="token ${stateClass}"><span class="token-label">${label}</span><span class="token-value">${value}</span></span>`;

    statusRowEl.innerHTML = `
      <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
      ${isLoading ? token("machine", "loading", "token-pending") : ""}
      ${token("step", snapshot.currentStep?.id ?? "—")}
      ${token("timeline", snapshot.history.timeline.join(" -> "))}
      ${token("events", snapshot.availableEvents.join(", ") || "none")}
      ${token("retry policy", handlers.describeRetryPolicy())}
    `;

    if (mountedStepId !== stepId) {
      stepSlot.innerHTML = renderStepShell(stepId, context);
      mountedStepId = stepId;
    }
    updateStepContent(stepSlot, stepId, context, isLoading);
    pendingOverlayEl.hidden = !isLoading;
    pendingLabelEl.textContent = getPendingLabel(transition);

    outgoingEl.innerHTML = renderOutgoingTransitions(snapshot.outgoingTransitions);
    executionPathsEl.innerHTML = renderExecutionPaths();

    snapshotEl.textContent = formatJson(snapshot);
    eventLogEl.innerHTML = eventLog
      .map(
        (entry) =>
          `<div class="log-item"><strong>${escapeHtml(entry.label)}</strong>${
            entry.detail ? `<div class="muted">${escapeHtml(entry.detail)}</div>` : ""
          }</div>`
      )
      .join("");
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (!action || machine.getSnapshot().machine.isLoading) {
      return;
    }

    // Every branch is a bare send: the definition owns the async, so the call
    // site names an intent and never pre-computes the route.
    void (async () => {
      if (action === "login") await machine.send("submitLogin");
      if (action === "back") await machine.navigate.goToPreviousStep();
      if (action === "continue-setup") await machine.send("setup2fa");
      if (action === "verify") await machine.send("verify");
      if (action === "reset") resetJourney();
    })();
  });

  // subscribeSelector drives the render loop off the whole snapshot; subscribeEvent
  // above is used for the audit-style log instead, since it needs discrete
  // occurrences (contextChange/stepEnter/...), not a derived render trigger.
  machine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => render()
  );
  render();
};

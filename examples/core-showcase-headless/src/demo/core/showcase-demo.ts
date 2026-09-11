import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type {
  GraphJourneyMachine,
  JourneySnapshot,
  JourneySubscriptionEvent,
  LinearJourneyMachine
} from "@rxova/journey-core";
import "../styles/demo.css";
import {
  authApi,
  graphDefinition,
  headlessDefinition,
  linearDefinition,
  type AuthEvent,
  type LoginContext,
  type LoginStepId
} from "../fixtures/auth-fixtures";
import { formatJson } from "../fixtures/support";

type Mode = "linear" | "graph" | "headless";

type ShowcaseMachine =
  | LinearJourneyMachine<LoginContext, LoginStepId>
  | GraphJourneyMachine<LoginContext, LoginStepId, AuthEvent>;

// Verbs are grouped by namespace on the machine:
//   navigate.*  – move between steps (goToNextStep/goToPreviousStep/goToStepById)
//   send()      – graph-only: fire a domain event, letting the definition's guards
//                 decide the actual target step (see the graphDefinition "when"
//                 clauses in auth-fixtures.ts)
//   controls.*  – lifecycle (complete/terminate/restart), not step-to-step movement
//   context.*   – read/write journey context directly (e.g. form field edits)
//   async.*     – transition-level loading/error state (e.g. clearError)
const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "statusChange",
  "navigationBlocked",
  "error"
];

const badgeClass: Record<Mode, string> = {
  linear: "badge-linear",
  graph: "badge-graph",
  headless: "badge-headless"
};

const titles: Record<Mode, string> = {
  linear: "Core Showcase Linear",
  graph: "Core Showcase Graph",
  headless: "Core Showcase Headless"
};

const subtitles: Record<Mode, string> = {
  linear: "Declared order drives goToNextStep; guards and hooks live on the steps.",
  graph: "Event-driven transitions: send() is the primary verb, goToStepById is gated.",
  headless:
    "A linear machine navigated purely by ungated goToStepById — the reserved headless tier's story (linear = headless + declared order)."
};

type LogEntry = { readonly label: string; readonly detail?: string };

type ShowcaseTransition = JourneySnapshot<LoginContext, LoginStepId>["transition"];

const createShowcaseMachine = (mode: Mode): ShowcaseMachine => {
  switch (mode) {
    case "linear":
      return createLinearJourney(linearDefinition, { autoStart: true }) as ShowcaseMachine;
    case "graph":
      return createGraphJourney(graphDefinition, {
        autoStart: true,
        plugins: [createExecutionPathsPlugin()] as const
      }) as ShowcaseMachine;
    case "headless":
      return createLinearJourney(headlessDefinition, { autoStart: true }) as ShowcaseMachine;
  }
};

const getStepperState = (index: number, currentIndex: number) => {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return "current";
  return "upcoming";
};

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

// Only linear/headless walk a declared step order, so only those two modes get a
// stepper — graph branches, so "progress" isn't a single line to draw a dot on.
const stepOrderForMode = (
  mode: Mode
): readonly { readonly id: LoginStepId; readonly label: string }[] => {
  if (mode === "graph") {
    return [];
  }
  const definition = mode === "linear" ? linearDefinition : headlessDefinition;
  return definition.steps.map((step) => ({
    id: step.id as LoginStepId,
    label: (step.metadata as { label?: string } | undefined)?.label ?? step.id
  }));
};

export const mountCoreShowcase = (mode: Mode, root: HTMLElement) => {
  const machine = createShowcaseMachine(mode);

  const isGraph = (
    candidate: ShowcaseMachine
  ): candidate is GraphJourneyMachine<LoginContext, LoginStepId, AuthEvent> => "send" in candidate;

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

  const currentStepId = (): LoginStepId =>
    (machine.getSnapshot().currentStep?.id ?? "login") as LoginStepId;

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

  const submitLogin = async (context: LoginContext) => {
    const result = await authApi.login(context.username, context.password);
    if (!result.success) {
      machine.context.update((current) => ({ ...current, error: "Login failed" }));
      return;
    }

    machine.context.update((current) => ({
      ...current,
      twoFactorMethod: result.method,
      error: null
    }));

    if (mode === "linear") {
      const qr = await authApi.generateQrCode();
      machine.context.update((current) => ({ ...current, qrCode: qr.qrCode }));
      await machine.navigate.goToNextStep();
      return;
    }

    if (isGraph(machine)) {
      if (result.method === "no_2fa") {
        const qr = await authApi.generateQrCode();
        machine.context.update((current) => ({ ...current, qrCode: qr.qrCode }));
      }

      // The definition's "when" guards (see loginStep in auth-fixtures.ts) pick the
      // actual target step from twoFactorMethod — this call only chooses the event.
      await machine.send("submitLogin");
      return;
    }

    let nextStep: LoginStepId = "setup2fa";
    if (result.method === "email") {
      nextStep = "emailCode";
      await authApi.sendEmailCode();
    }
    if (result.method === "authenticator") {
      nextStep = "authenticatorCode";
      const qr = await authApi.generateQrCode();
      machine.context.update((current) => ({ ...current, qrCode: qr.qrCode }));
    }

    await machine.navigate.goToStepById(nextStep);
  };

  const recordFailure = (context: LoginContext) => {
    const attempts = context.attempts + 1;
    machine.context.update((current) => ({
      ...current,
      attempts,
      error: attempts >= 3 ? "Too many failed attempts." : "Use 123456."
    }));
    return attempts;
  };

  const submitVerification = async (stepId: LoginStepId, context: LoginContext) => {
    const result = await authApi.verifyCode(context.verificationCode);

    if (isGraph(machine)) {
      // Same pattern as submitLogin: the "when" guards on each verify step (see
      // failureCandidates in auth-fixtures.ts) decide retry-vs-blocked; this map
      // only decides which success/failure event fires.
      const eventByStep: Partial<Record<LoginStepId, [AuthEvent["type"], AuthEvent["type"]]>> = {
        verifyCode: ["verifyCodeSuccess", "verifyCodeFailure"],
        emailCode: ["verifyEmailSuccess", "verifyEmailFailure"],
        authenticatorCode: ["verifyAuthenticatorSuccess", "verifyAuthenticatorFailure"]
      };
      const pair = eventByStep[stepId];
      if (pair) {
        await machine.send(result.success ? pair[0] : pair[1]);
      }
      return;
    }

    if (mode === "linear") {
      if (result.success) {
        await machine.navigate.goToNextStep();
      } else if (recordFailure(context) >= 3) {
        await machine.navigate.goToNextStep();
      }
      return;
    }

    if (result.success) {
      await machine.navigate.goToStepById("loggedIn");
    } else if (recordFailure(context) >= 3) {
      await machine.navigate.goToStepById("blocked");
    }
  };

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
      if (stepId === "blocked") {
        statusMessageEl.textContent = context.error ?? "Too many failed attempts.";
      } else {
        statusMessageEl.textContent = `Welcome, ${context.username || "User"}.`;
      }
    }

    stepContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = isLoading;
    });
  };

  const stepOrder = stepOrderForMode(mode);

  const renderStepper = (currentIndex: number) =>
    stepOrder
      .map(({ id, label }, index) => {
        const state = getStepperState(index, currentIndex);
        const connector =
          index < stepOrder.length - 1
            ? `<div class="stepper-connector stepper-connector-${index < currentIndex ? "done" : "upcoming"}"></div>`
            : "";
        return `
          <div class="stepper-item stepper-${state}" data-step-id="${id}">
            <span class="stepper-dot">${state === "done" ? "✓" : index + 1}</span>
            <span class="stepper-label">${escapeHtml(label)}</span>
          </div>
          ${connector}
        `;
      })
      .join("");

  const renderExecutionPaths = () => {
    if (!isGraph(machine)) {
      return "";
    }
    const api = machine.plugins["execution-paths" as never] as {
      getCurrentPath(): readonly string[];
      getCompletedPaths(): readonly (readonly string[])[];
    };
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
          <span class="badge ${badgeClass[mode]}">${mode}</span>
        </div>
        <h1>${titles[mode]}</h1>
        <p>${subtitles[mode]}</p>
      </header>
      ${
        stepOrder.length > 0
          ? `<section class="card"><h2>Progress</h2><div class="stepper" data-role="stepper"></div></section>`
          : ""
      }
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
      ${
        isGraph(machine)
          ? `<section class="card"><h2>Execution Paths</h2><div class="path-list" data-role="execution-paths"></div></section>`
          : ""
      }
      <section class="card">
        <h2>Observed Events</h2>
        <div class="log-list" data-role="event-log"></div>
      </section>
    </div>
  `;

  const stepperEl = root.querySelector<HTMLElement>('[data-role="stepper"]');
  const statusRowEl = root.querySelector<HTMLElement>('[data-role="status-row"]')!;
  const stepSlot = root.querySelector<HTMLElement>('[data-role="step-slot"]')!;
  const pendingOverlayEl = root.querySelector<HTMLElement>('[data-role="pending-overlay"]')!;
  const pendingLabelEl = root.querySelector<HTMLElement>('[data-role="pending-label"]')!;
  const snapshotEl = root.querySelector<HTMLElement>('[data-role="snapshot"]')!;
  const executionPathsEl = root.querySelector<HTMLElement>('[data-role="execution-paths"]');
  const eventLogEl = root.querySelector<HTMLElement>('[data-role="event-log"]')!;

  let mountedStepId: LoginStepId | null = null;
  const render = () => {
    const snapshot = machine.getSnapshot() as JourneySnapshot<LoginContext, LoginStepId>;
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
      ${
        snapshot.type === "graph"
          ? token("events", snapshot.availableEvents.join(", ") || "none")
          : ""
      }
    `;

    if (mountedStepId !== stepId) {
      stepSlot.innerHTML = renderStepShell(stepId, context);
      mountedStepId = stepId;
    }
    updateStepContent(stepSlot, stepId, context, isLoading);
    pendingOverlayEl.hidden = !isLoading;
    pendingLabelEl.textContent = getPendingLabel(transition);

    if (stepperEl) {
      const currentIndex = stepOrder.findIndex((step) => step.id === stepId);
      stepperEl.innerHTML = renderStepper(currentIndex);
    }

    if (executionPathsEl) {
      executionPathsEl.innerHTML = renderExecutionPaths();
    }

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

    const context = machine.getSnapshot().context;
    const stepId = currentStepId();

    void (async () => {
      if (action === "login") await submitLogin(context);
      if (action === "back") await machine.navigate.goToPreviousStep();
      if (action === "continue-setup") {
        if (isGraph(machine)) await machine.send("setup2fa");
        else if (mode === "headless") await machine.navigate.goToStepById("verifyCode");
        else await machine.navigate.goToNextStep();
      }
      if (action === "verify") await submitVerification(stepId, context);
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

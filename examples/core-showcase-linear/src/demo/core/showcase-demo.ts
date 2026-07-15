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

const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "statusChange",
  "navigationBlocked",
  "error"
];

type LogEntry = { readonly label: string; readonly detail?: string };

const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "∅";
  }
  const json = JSON.stringify(value);
  return json.length > 24 ? `${json.slice(0, 21)}..."` : json;
};

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

export const mountCoreShowcase = (mode: Mode, root: HTMLElement) => {
  const machine: ShowcaseMachine = (
    mode === "linear"
      ? createLinearJourney(linearDefinition, { autoStart: true })
      : mode === "graph"
        ? createGraphJourney(graphDefinition, {
            autoStart: true,
            plugins: [createExecutionPathsPlugin()] as const
          })
        : createLinearJourney(headlessDefinition, { autoStart: true })
  ) as ShowcaseMachine;

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

  const submitVerification = async (stepId: LoginStepId, context: LoginContext) => {
    const result = await authApi.verifyCode(context.verificationCode, context.attempts);

    if (isGraph(machine)) {
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

    if (result.success) {
      machine.context.update((current) => ({
        ...current,
        loggedInStatus: "loggedIn",
        error: null
      }));
    } else {
      machine.context.update((current) => ({
        ...current,
        attempts: current.attempts + 1,
        loggedInStatus: result.loggedInStatus,
        error: result.loggedInStatus === "blocked" ? "Too many failed attempts." : "Use 123456."
      }));
    }

    if (mode === "linear") {
      if (result.success || result.loggedInStatus === "blocked") {
        await machine.navigate.goToNextStep();
      }
      return;
    }

    if (result.success) {
      await machine.navigate.goToStepById("loggedIn");
    } else if (result.loggedInStatus === "blocked") {
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
          <p class="muted">
            Password "blocked" fails; username length % 3 picks the 2FA method
            (0 = no 2FA, 1 = email code, 2 = authenticator).
          </p>
          <label class="field">Username<input data-field="username" value="${context.username}" /></label>
          <label class="field">Password<input data-field="password" type="password" value="${context.password}" /></label>
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
          <h3 class="step-title">${stepId}</h3>
          <p class="muted">Use 123456 to succeed.</p>
          <label class="field">Verification Code<input data-field="verificationCode" value="${context.verificationCode}" /></label>
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
          <h3 class="step-title">Status</h3>
          <p data-role="status-message"></p>
          <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
        </div>
      `;
    }

    return `
      <div class="step-view">
        <h3 class="step-title">Blocked</h3>
        <p class="severity-error" data-role="error"></p>
        <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
      </div>
    `;
  };

  // Fills in the parts of the mounted step that change on every snapshot, without
  // touching the <input> elements themselves.
  const updateStepContent = (
    stepContainer: HTMLElement,
    stepId: LoginStepId,
    context: LoginContext
  ) => {
    const errorEl = stepContainer.querySelector<HTMLElement>('[data-role="error"]');
    if (errorEl) {
      const message =
        stepId === "blocked" ? (context.error ?? "Too many failed attempts.") : context.error;
      errorEl.textContent = message ?? "";
      errorEl.hidden = !message;
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
      // Linear mode has no dedicated "blocked" step — 3 failed attempts still lands
      // here, so this step reports whichever outcome authApi.verifyCode recorded.
      const isBlocked = context.loggedInStatus === "blocked";
      statusMessageEl.textContent = isBlocked
        ? (context.error ?? "Too many failed attempts.")
        : `Logged in. Welcome, ${context.username || "User"}.`;
      statusMessageEl.className = isBlocked ? "severity-error" : "";
    }

    stepContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = isPending;
    });
  };

  // Linear mode's declared step order is exactly what goToNextStep/goToPreviousStep
  // walk, so it doubles as the stepper's progression map.
  const stepOrder = linearDefinition.steps.map((step) => ({
    id: step.id as LoginStepId,
    label: (step.metadata as { label?: string } | undefined)?.label ?? step.id
  }));

  const renderStepper = (currentIndex: number) =>
    stepOrder
      .map(({ id, label }, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const connector =
          index < stepOrder.length - 1
            ? `<div class="stepper-connector stepper-connector-${index < currentIndex ? "done" : "upcoming"}"></div>`
            : "";
        return `
          <div class="stepper-item stepper-${state}" data-step-id="${id}">
            <span class="stepper-dot">${state === "done" ? "✓" : index + 1}</span>
            <span class="stepper-label">${label}</span>
          </div>
          ${connector}
        `;
      })
      .join("");

  const renderExecutionPathsList = () => {
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
        mode === "linear"
          ? `<section class="card"><h2>Progress</h2><div class="stepper" data-role="stepper"></div></section>`
          : ""
      }
      <div class="split">
        <section class="card">
          <h2>Runtime</h2>
          <div class="status-row" data-role="status-row"></div>
          <div style="margin-top: 1rem" data-role="step-slot"></div>
          ${isGraph(machine) ? `<div style="margin-top: 1rem"><h3>Execution Paths</h3><div class="path-list" data-role="execution-paths"></div></div>` : ""}
        </section>
        <section class="card">
          <h2>Snapshot</h2>
          <pre class="json" data-role="snapshot"></pre>
        </section>
      </div>
      <section class="card">
        <h2>Observed Events</h2>
        <div class="log-list" data-role="event-log"></div>
      </section>
    </div>
  `;

  const statusRow = root.querySelector<HTMLElement>('[data-role="status-row"]')!;
  const stepperEl = root.querySelector<HTMLElement>('[data-role="stepper"]');
  const stepSlot = root.querySelector<HTMLElement>('[data-role="step-slot"]')!;
  const executionPathsEl = root.querySelector<HTMLElement>('[data-role="execution-paths"]');
  const snapshotEl = root.querySelector<HTMLElement>('[data-role="snapshot"]')!;
  const eventLogEl = root.querySelector<HTMLElement>('[data-role="event-log"]')!;

  let mountedStepId: LoginStepId | null = null;
  let isPending = false;

  const render = () => {
    const snapshot = machine.getSnapshot() as JourneySnapshot<LoginContext, LoginStepId>;
    const context = snapshot.context;
    const stepId = currentStepId();

    statusRow.innerHTML = `
      <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
      ${isPending ? `<span class="token token-pending">Working…</span>` : ""}
      <span class="token">step: ${snapshot.currentStep?.id ?? "—"}</span>
      <span class="token">timeline: ${snapshot.history.timeline.join(" -> ")}</span>
      ${
        snapshot.type === "graph"
          ? `<span class="token">events: ${snapshot.availableEvents.join(", ") || "none"}</span>`
          : ""
      }
    `;

    if (mountedStepId !== stepId) {
      stepSlot.innerHTML = renderStepShell(stepId, context);
      mountedStepId = stepId;
    }
    updateStepContent(stepSlot, stepId, context);

    if (stepperEl) {
      const currentIndex = stepOrder.findIndex((step) => step.id === stepId);
      stepperEl.innerHTML = renderStepper(currentIndex);
    }

    if (executionPathsEl) {
      executionPathsEl.innerHTML = renderExecutionPathsList();
    }

    snapshotEl.textContent = formatJson(snapshot);
    eventLogEl.innerHTML = eventLog
      .map(
        (entry) =>
          `<div class="log-item"><strong>${entry.label}</strong>${
            entry.detail ? `<div class="muted">${entry.detail}</div>` : ""
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
    if (!action || isPending) {
      return;
    }

    const context = machine.getSnapshot().context;
    const stepId = currentStepId();

    void (async () => {
      isPending = true;
      render();
      try {
        if (action === "login") await submitLogin(context);
        if (action === "back") await machine.navigate.goToPreviousStep();
        if (action === "continue-setup") {
          if (isGraph(machine)) await machine.send("setup2fa");
          else if (mode === "headless") await machine.navigate.goToStepById("verifyCode");
          else await machine.navigate.goToNextStep();
        }
        if (action === "verify") await submitVerification(stepId, context);
        if (action === "reset") resetJourney();
      } finally {
        isPending = false;
        render();
      }
    })();
  });

  machine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => render()
  );
  render();
};

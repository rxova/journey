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
  "stepEnter",
  "stepLeave",
  "statusChange",
  "contextChange",
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

  const eventLog: string[] = [];
  for (const eventName of OBSERVED_EVENTS) {
    machine.subscriptions.subscribeEvent(eventName, () => {
      eventLog.push(eventName);
      if (eventLog.length > 30) {
        eventLog.shift();
      }
    });
  }

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

  const renderStep = (snapshot: JourneySnapshot<LoginContext, LoginStepId>) => {
    const context = snapshot.context;
    const stepId = currentStepId();

    if (stepId === "login") {
      return `
        <div class="step-view">
          <h3 class="step-title">Login</h3>
          <p class="muted">Password "blocked" fails; username length picks the 2FA method.</p>
          <label class="field">Username<input data-field="username" value="${context.username}" /></label>
          <label class="field">Password<input data-field="password" type="password" value="${context.password}" /></label>
          ${context.error ? `<div class="severity-error">${context.error}</div>` : ""}
          <div class="actions"><button data-action="login">Sign In</button></div>
        </div>
      `;
    }

    if (stepId === "setup2fa") {
      return `
        <div class="step-view">
          <h3 class="step-title">Setup 2FA</h3>
          <p class="muted">Scan the code, then continue to verification.</p>
          <pre class="json">${context.qrCode ?? "Generating…"}</pre>
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
          ${context.error ? `<div class="severity-error">${context.error}</div>` : ""}
          <div class="status-row"><span class="token">attempts: ${context.attempts}</span></div>
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
          <p>Welcome, ${context.username || "User"}.</p>
          <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
        </div>
      `;
    }

    return `
      <div class="step-view">
        <h3 class="step-title">Blocked</h3>
        <p class="severity-error">${context.error ?? "Too many failed attempts."}</p>
        <div class="actions"><button class="secondary" data-action="reset">Start Over</button></div>
      </div>
    `;
  };

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
    return `<section class="card"><h2>Execution Paths</h2><div class="path-list">${[
      renderPath(api.getCurrentPath(), "Current run"),
      ...api.getCompletedPaths().map((steps, index) => renderPath(steps, `Finished run ${index + 1}`))
    ].join("")}</div></section>`;
  };

  const render = () => {
    const snapshot = machine.getSnapshot() as JourneySnapshot<LoginContext, LoginStepId>;

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
        <div class="split">
          <div class="stack">
            <section class="card">
              <h2>Runtime</h2>
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
              <div style="margin-top: 1rem">${renderStep(snapshot)}</div>
            </section>
            ${renderExecutionPaths()}
          </div>
          <div class="stack">
            <section class="card">
              <h2>Snapshot</h2>
              <pre class="json">${formatJson(snapshot)}</pre>
            </section>
            <section class="card">
              <h2>Observed Events</h2>
              <div class="log-list">${eventLog
                .map((entry) => `<div class="log-item">${entry}</div>`)
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
      render();
    })();
  });

  machine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => render()
  );
  render();
};

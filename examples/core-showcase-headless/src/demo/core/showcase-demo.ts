/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createJourneyMachine } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import "../styles/demo.css";
import {
  authApi,
  graphDefinition,
  headlessDefinition,
  linearDefinition,
  type LoginContext,
  type LoginStepId
} from "../fixtures/auth-fixtures";
import { formatJson } from "../fixtures/support";

type Mode = "linear" | "graph" | "headless";

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

export const mountCoreShowcase = async (mode: Mode, root: HTMLElement) => {
  const machine =
    mode === "linear"
      ? createJourneyMachine(linearDefinition)
      : mode === "graph"
        ? createJourneyMachine(graphDefinition, {
            plugins: [createExecutionPathsPlugin()] as const
          })
        : createJourneyMachine(headlessDefinition);

  const eventLog: string[] = [];

  machine.subscribeEvent((event) => {
    eventLog.push(event.type);
    if (eventLog.length > 30) {
      eventLog.shift();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const field = target.dataset.field as keyof LoginContext | undefined;
    if (!field) {
      return;
    }

    void machine.updateContext((context: LoginContext) => ({
      ...context,
      [field]: target.value,
      error: field === "verificationCode" ? null : context.error
    }));
  });

  const submitLogin = async (context: LoginContext) => {
    const result = await authApi.login(context.username, context.password);
    if (!result.success) {
      await machine.updateContext((current: LoginContext) => ({
        ...current,
        error: "Login failed"
      }));
      return;
    }

    await machine.updateContext((current: LoginContext) => ({
      ...current,
      twoFactorMethod: result.method,
      error: null
    }));

    if (mode === "linear") {
      const qr = await authApi.generateQrCode();
      await machine.updateContext((current: LoginContext) => ({
        ...current,
        qrCode: qr.qrCode
      }));
      await machine.goToNextStep();
      return;
    }

    if (mode === "graph") {
      if (result.method === "no_2fa") {
        const qr = await authApi.generateQrCode();
        await machine.updateContext((current: LoginContext) => ({
          ...current,
          qrCode: qr.qrCode
        }));
      }

      await machine.send({ type: "submitLogin" });
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
      await machine.updateContext((current: LoginContext) => ({
        ...current,
        qrCode: qr.qrCode
      }));
    }

    await machine.goToStepById(nextStep);
  };

  const submitVerification = async (currentStepId: LoginStepId, context: LoginContext) => {
    const result = await authApi.verifyCode(context.verificationCode);

    if (mode === "linear") {
      if (result.success) {
        await machine.goToNextStep();
      } else {
        const attempts = context.attempts + 1;
        await machine.updateContext((current: LoginContext) => ({
          ...current,
          attempts,
          error: attempts >= 3 ? "Too many failed attempts." : "Use 123456."
        }));
        if (attempts >= 3) {
          await machine.goToNextStep();
        }
      }
      return;
    }

    if (mode === "graph") {
      if (currentStepId === "verifyCode") {
        await machine.send({ type: result.success ? "verifyCodeSuccess" : "verifyCodeFailure" });
      }
      if (currentStepId === "emailCode") {
        await machine.send({ type: result.success ? "verifyEmailSuccess" : "verifyEmailFailure" });
      }
      if (currentStepId === "authenticatorCode") {
        await machine.send({
          type: result.success ? "verifyAuthenticatorSuccess" : "verifyAuthenticatorFailure"
        });
      }
      return;
    }

    if (result.success) {
      await machine.goToStepById("loggedIn");
      return;
    }

    const attempts = context.attempts + 1;
    await machine.updateContext((current: LoginContext) => ({
      ...current,
      attempts,
      error: attempts >= 3 ? "Too many failed attempts." : "Use 123456."
    }));

    if (attempts >= 3) {
      await machine.goToStepById("blocked");
    }
  };

  const renderStep = (snapshot: ReturnType<typeof machine.getSnapshot>) => {
    const context = snapshot.context as LoginContext;
    const currentStepId = snapshot.currentStepId as LoginStepId;

    if (currentStepId === "login") {
      return `
        <div class="step-view">
          <h3 class="step-title">Login</h3>
          <p class="muted">Use a username with different lengths to branch between no_2fa, email, and authenticator.</p>
          <label class="field">Username<input data-field="username" value="${context.username}" placeholder="alice" /></label>
          <label class="field">Password<input data-field="password" value="${context.password}" placeholder="password" /></label>
          ${context.error ? `<div class="severity-error">${context.error}</div>` : ""}
          <div class="actions"><button data-action="login">Sign In</button></div>
        </div>
      `;
    }

    if (currentStepId === "setup2fa") {
      return `
        <div class="step-view">
          <h3 class="step-title">Setup 2FA</h3>
          <p class="muted">Scan the QR code and continue.</p>
          <pre class="json">${context.qrCode ?? "Generating QR code..."}</pre>
          <div class="actions">
            <button class="secondary" data-action="back">Back</button>
            <button data-action="continue-setup">Continue</button>
          </div>
        </div>
      `;
    }

    if (
      currentStepId === "verifyCode" ||
      currentStepId === "emailCode" ||
      currentStepId === "authenticatorCode"
    ) {
      return `
        <div class="step-view">
          <h3 class="step-title">${currentStepId}</h3>
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

    if (currentStepId === "loggedIn") {
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

  const render = () => {
    const snapshot = machine.getSnapshot();
    const executionPaths =
      mode === "graph" && "getExecutionPaths" in machine
        ? (
            machine as typeof machine & {
              getExecutionPaths: (options?: { maxDepth?: number; maxPaths?: number }) => {
                paths: Array<{ steps: string[]; events: string[]; terminated: string }>;
              };
            }
          ).getExecutionPaths({ maxDepth: 12, maxPaths: 20 })
        : null;

    root.innerHTML = `
      <div class="app-shell">
        <header class="hero">
          <div class="hero-meta">
            <span class="badge badge-core">Core</span>
            <span class="badge ${badgeClass[mode]}">${mode}</span>
          </div>
          <h1>${titles[mode]}</h1>
          <p>Framework-free Vite example that renders the same scenario shape without React.</p>
        </header>
        <div class="split">
          <div class="stack">
            <section class="card">
              <h2>Runtime</h2>
              <div class="status-row">
                <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
                <span class="token">step: ${snapshot.currentStepId}</span>
                <span class="token">timeline: ${snapshot.history.timeline.join(" -> ")}</span>
              </div>
              <div style="margin-top: 1rem">${renderStep(snapshot)}</div>
            </section>
            ${
              executionPaths
                ? `<section class="card"><h2>Execution Paths</h2><div class="path-list">${executionPaths.paths
                    .map(
                      (path, index) =>
                        `<div class="path-item"><strong>Path ${index + 1}</strong><div class="muted">${path.steps.join(
                          " -> "
                        )}</div><div class="muted">${path.events.join(" -> ") || "No events"}</div><div class="muted">terminated: ${
                          path.terminated
                        }</div></div>`
                    )
                    .join("")}</div></section>`
                : ""
            }
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

    const snapshot = machine.getSnapshot();
    const context = snapshot.context as LoginContext;
    const currentStepId = snapshot.currentStepId as LoginStepId;

    void (async () => {
      if (action === "login") await submitLogin(context);
      if (action === "back") await machine.goToPreviousStep();
      if (action === "continue-setup") {
        if (mode === "graph") await machine.send({ type: "setup2fa" });
        else if (mode === "headless") await machine.goToStepById("verifyCode");
        else await machine.goToNextStep();
      }
      if (action === "verify") await submitVerification(currentStepId, context);
      if (action === "reset") machine.resetJourney();
      render();
    })();
  });

  machine.subscribe(() => render());
  render();
  await machine.startJourney();
};

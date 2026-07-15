import { createLinearJourney } from "@rxova/journey-core";
import type { JourneySnapshot, JourneySubscriptionEvent } from "@rxova/journey-core";
import "../styles/demo.css";
import {
  authApi,
  linearDefinition,
  type LoginContext,
  type LoginStepId
} from "../fixtures/auth-fixtures";
import { formatJson } from "../fixtures/support";

const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "statusChange",
  "navigationBlocked",
  "error"
];

type LogEntry = { readonly label: string; readonly detail?: string };

class InvalidVerificationCodeError extends Error {
  constructor() {
    super("Use 123456.");
    this.name = "InvalidVerificationCodeError";
  }
}

type LoginTransition = JourneySnapshot<LoginContext, LoginStepId>["transition"];

const PENDING_LABELS: Partial<
  Record<NonNullable<LoginTransition["phase"]>, Partial<Record<LoginStepId, string>>>
> = {
  working: {
    login: "Authenticating (about 1.2 seconds)",
    setup2fa: "Confirming 2FA setup (about 6 seconds)",
    verifyCode: "Verifying code"
  },
  entering: {
    setup2fa: "Generating QR enrollment"
  }
};

const getPendingLabel = (transition: LoginTransition): string => {
  if (!transition.phase) return "Settling step effects";
  const stepId = transition.phase === "entering" ? transition.to : transition.from;
  return (stepId && PENDING_LABELS[transition.phase]?.[stepId]) ?? "Settling step effects";
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
  const machine = createLinearJourney(linearDefinition, { autoStart: true });

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

  const finishJourney = (loggedInStatus: LoginContext["loggedInStatus"]): void => {
    if (loggedInStatus === "loggedIn") {
      machine.controls.complete({ loggedInStatus });
    } else if (loggedInStatus === "blocked") {
      machine.controls.terminate({ loggedInStatus });
    }
  };

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const field = target.dataset.field as keyof LoginContext | undefined;
    if (!field) {
      return;
    }

    machine.async.clearError();
    machine.context.update((context) => ({
      ...context,
      [field]: target.value,
      error: null
    }));
  });

  const submitLogin = async () => {
    const navigation = await machine.navigate.goToNextStep({
      run: async ({ snapshot }) => {
        const result = await authApi.login(snapshot.context.username, snapshot.context.password);
        if (!result.success) throw new Error("Login failed");
        return result;
      },
      commit: ({ result, updateContext }) => {
        updateContext((current) => ({
          ...current,
          password: "",
          sessionId: result.sessionId,
          error: null
        }));
      }
    });
    if (!navigation.ok && navigation.reason === "error") {
      const message = navigation.error instanceof Error ? navigation.error.message : "Login failed";
      machine.context.update((current) => ({ ...current, error: message }));
    }
  };

  const submitVerification = async () => {
    const navigation = await machine.navigate.goToNextStep({
      run: async ({ snapshot }) => {
        const result = await authApi.verifyCode(
          snapshot.context.verificationCode,
          snapshot.context.attempts
        );
        if (!result.success && result.loggedInStatus === null) {
          throw new InvalidVerificationCodeError();
        }
        return result;
      },
      commit: ({ result, updateContext }) => {
        updateContext((current) => ({
          ...current,
          attempts: result.success ? current.attempts : current.attempts + 1,
          loggedInStatus: result.loggedInStatus,
          error: result.loggedInStatus === "blocked" ? "Too many failed attempts." : null
        }));
      }
    });

    if (navigation.ok) {
      finishJourney(machine.getSnapshot().context.loggedInStatus);
    } else if (navigation.reason === "error") {
      machine.context.update((current) => ({
        ...current,
        attempts: current.attempts + 1,
        error:
          navigation.error instanceof InvalidVerificationCodeError
            ? navigation.error.message
            : "Verification failed."
      }));
    }
  };

  const goBack = async () => {
    if (currentStepId() !== "verifyCode") {
      await machine.navigate.goToPreviousStep();
      return;
    }

    await machine.navigate.goToPreviousStep({
      run: () => undefined,
      commit: ({ updateContext }) => {
        updateContext((current) => ({
          ...current,
          attempts: 0,
          error: null
        }));
      }
    });
  };

  const resetJourney = () => {
    const status = machine.getSnapshot().status;
    if (status !== "completed" && status !== "terminated") {
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
          <p class="muted">Password "blocked" fails; any other password moves to Setup 2FA.</p>
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

    if (stepId === "verifyCode") {
      return `
        <div class="step-view">
          <h3 class="step-title">Verify Code</h3>
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

    return `
      <div class="step-view">
        <h3 class="step-title">Status</h3>
        <p data-role="status-message"></p>
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
      // Linear mode has no dedicated "blocked" step — 3 failed attempts still lands
      // here, so this step reports whichever outcome authApi.verifyCode recorded.
      const isBlocked = context.loggedInStatus === "blocked";
      statusMessageEl.textContent = isBlocked
        ? (context.error ?? "Too many failed attempts.")
        : `Logged in. Welcome, ${context.username || "User"}.`;
      statusMessageEl.className = isBlocked ? "severity-error" : "";
    }

    stepContainer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = isLoading;
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

  root.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <div class="hero-meta">
          <span class="badge badge-core">Core</span>
          <span class="badge badge-linear">linear</span>
        </div>
        <h1>Core Showcase Linear</h1>
        <p>Declared order drives next and previous; transactional work decides whether a move commits.</p>
      </header>
      <section class="card"><h2>Progress</h2><div class="stepper" data-role="stepper"></div></section>
      <section class="card">
        <h2>Runtime</h2>
        <p class="hint">
          <strong>Simulated async:</strong> Login authenticates before forward navigation and clears
          the password only when it commits. Setup 2FA waits 700 ms on entry to generate a QR code,
          then runs a 6-second confirmation before continuing. Back has no explicit work, but
          re-entering Setup 2FA runs its <code>onEnter</code> effect again.
        </p>
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
        <h2>Observed Events</h2>
        <div class="log-list" data-role="event-log"></div>
      </section>
    </div>
  `;

  const statusRow = root.querySelector<HTMLElement>('[data-role="status-row"]')!;
  const stepperEl = root.querySelector<HTMLElement>('[data-role="stepper"]')!;
  const stepSlot = root.querySelector<HTMLElement>('[data-role="step-slot"]')!;
  const pendingOverlayEl = root.querySelector<HTMLElement>('[data-role="pending-overlay"]')!;
  const pendingLabelEl = root.querySelector<HTMLElement>('[data-role="pending-label"]')!;
  const snapshotEl = root.querySelector<HTMLElement>('[data-role="snapshot"]')!;
  const eventLogEl = root.querySelector<HTMLElement>('[data-role="event-log"]')!;

  let mountedStepId: LoginStepId | null = null;
  const render = () => {
    const snapshot = machine.getSnapshot() as JourneySnapshot<LoginContext, LoginStepId>;
    const context = snapshot.context;
    const stepId = currentStepId();
    const transition = snapshot.transition;
    const isLoading = snapshot.machine.isLoading;
    const transitionLabel = transition.pending
      ? `${transition.phase}: ${transition.from ?? "start"} -> ${transition.to ?? "unknown"}`
      : "settled";
    const stepAsync = snapshot.currentStep?.async;
    const stepAsyncLabel = stepAsync?.isLoading
      ? "loading"
      : stepAsync?.isError
        ? "error"
        : stepAsync?.isSuccess
          ? "success"
          : "idle";

    statusRow.innerHTML = `
      <span class="status-pill status-${snapshot.status}">${snapshot.status}</span>
      ${isLoading ? `<span class="token token-pending">machine: loading</span>` : ""}
      <span class="token ${transition.pending ? "token-pending" : ""}">transition: ${transitionLabel}</span>
      <span class="token ${stepAsync?.isLoading ? "token-pending" : ""}">step async: ${stepAsyncLabel}</span>
      <span class="token">step: ${snapshot.currentStep?.id ?? "—"}</span>
      <span class="token">timeline: ${snapshot.history.timeline.join(" -> ")}</span>
    `;

    if (mountedStepId !== stepId) {
      stepSlot.innerHTML = renderStepShell(stepId, context);
      mountedStepId = stepId;
    }
    updateStepContent(stepSlot, stepId, context, isLoading);
    pendingOverlayEl.hidden = !isLoading;
    pendingLabelEl.textContent = getPendingLabel(transition);

    const currentIndex = stepOrder.findIndex((step) => step.id === stepId);
    stepperEl.innerHTML = renderStepper(currentIndex);

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

    void (async () => {
      if (action === "login") await submitLogin();
      if (action === "back") await goBack();
      if (action === "continue-setup") {
        await machine.navigate.goToNextStep({
          run: async ({ snapshot }) => {
            const confirmed = await authApi.confirmTwoFactorSetup(snapshot.context.qrCode);
            if (!confirmed) throw new Error("Complete QR enrollment before continuing");
          }
        });
      }
      if (action === "verify") await submitVerification();
      if (action === "reset") resetJourney();
    })();
  });

  machine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => render()
  );
  render();
};

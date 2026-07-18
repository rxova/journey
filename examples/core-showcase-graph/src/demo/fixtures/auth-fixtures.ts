import { createGraphJourneyBuilder } from "@rxova/journey-core";
import { delay } from "./support";

export type LoginStepId =
  | "login"
  | "setup2fa"
  | "verifyCode"
  | "emailCode"
  | "authenticatorCode"
  | "loggedIn"
  | "blocked";

export type TwoFactorMethod = "no_2fa" | "email" | "authenticator";

export type LoginContext = {
  username: string;
  password: string;
  twoFactorMethod: TwoFactorMethod | null;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
  /** Outcome of the last `verify` work — the fact its guards route on. */
  lastVerifyOk: boolean | null;
};

export type AuthApi = typeof authApi;

/**
 * Policy the guards consult, injected rather than closed over.
 *
 * Handlers are plain runtime functions: they are never serialized into the
 * snapshot, so this is where behaviour that must stay live (policy, injected
 * clients) belongs — as opposed to context, which is data and *is* serialized.
 * `createGraphJourney`'s `handlers` option overrides the definition's, so one
 * definition can serve the app under one policy and tests under another.
 */
export type AuthHandlers = {
  /** The injected client the definition's own async calls. */
  api: AuthApi;
  /** Routing policy: does the login result call for this 2FA method? */
  requiresMethod: (context: LoginContext, method: TwoFactorMethod) => boolean;
  /** Retry policy: has the user burned every allowed attempt? */
  hasExhaustedAttempts: (context: LoginContext) => boolean;
  /** Human-readable form of the active retry policy, for the Runtime row. */
  describeRetryPolicy: () => string;
};

export const createAuthHandlers = (maxAttempts: number, api: AuthApi): AuthHandlers => ({
  api,
  requiresMethod: (context, method) => context.twoFactorMethod === method,
  hasExhaustedAttempts: (context) => context.attempts >= maxAttempts,
  describeRetryPolicy: () => `${maxAttempts} attempts`
});

/**
 * One event per user intent, not per outcome.
 *
 * There is no `verifyCodeSuccess`/`verifyCodeFailure` pair: the caller does not
 * know the outcome, and picking the event by outcome would mean the call site
 * had already decided the route. `verify` carries the work that finds out, and
 * the guards route on what it stages. `verify` is declared from all three
 * verification steps — work is keyed by (step, event), so each declares its own.
 */
export type AuthEvent = { type: "submitLogin" } | { type: "setup2fa" } | { type: "verify" };

export type StepMeta = { label: string; icon: string };

export const authApi = {
  login: async (username: string, password: string) => {
    await delay(700);
    if (password === "blocked") {
      return { success: false as const, method: null };
    }

    const methods = ["no_2fa", "email", "authenticator"] as const;
    return { success: true as const, method: methods[username.length % 3] ?? "no_2fa" };
  },
  generateQrCode: async () => {
    await delay(350);
    return { qrCode: "otpauth://totp/Rxova:user?secret=BASE32SECRET" };
  },
  sendEmailCode: async () => {
    await delay(300);
    return { sent: true as const };
  },
  verifyCode: async (code: string) => {
    await delay(400);
    return { success: code === "123456" };
  }
};

export const initialLoginContext = (): LoginContext => ({
  username: "",
  password: "",
  twoFactorMethod: null,
  verificationCode: "",
  qrCode: null,
  error: null,
  attempts: 0,
  lastVerifyOk: null
});

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: LoginContext;
  stepId: LoginStepId;
  events: AuthEvent;
  meta: StepMeta;
  handlers: AuthHandlers;
}>();

/**
 * The login work: the machine calls the API itself, stages what came back, and
 * only then do the guards pick a step. The call site is a bare
 * `send("submitLogin")` — it neither knows nor decides the 2FA method.
 *
 * The last candidate is unguarded and points back at `login`. That keeps the
 * event *total*: a failed login still routes somewhere, so its error message
 * commits instead of being rolled back with the unmatched send.
 */
const loginStep = createStep("login", {
  metadata: { label: "Login", icon: "🔐" },
  on: {
    submitLogin: ({ to: into, work }) =>
      work({
        run: ({ snapshot, handlers }) =>
          handlers.api.login(snapshot.context.username, snapshot.context.password),
        commit: ({ result, updateContext }) =>
          updateContext((context) => ({
            ...context,
            twoFactorMethod: result.success ? result.method : null,
            password: result.success ? "" : context.password,
            error: result.success ? null : "Login failed"
          })),
        candidates: [
          into("setup2fa").when(({ context, handlers }) =>
            handlers.requiresMethod(context, "no_2fa")
          ),
          into("emailCode").when(({ context, handlers }) =>
            handlers.requiresMethod(context, "email")
          ),
          into("authenticatorCode").when(({ context, handlers }) =>
            handlers.requiresMethod(context, "authenticator")
          ),
          into("login")
        ]
      })
  }
});

const setup2faStep = createStep("setup2fa", {
  metadata: { label: "Setup 2FA", icon: "📱" },
  // Enrollment is a side effect of *arriving*, not of choosing a route, so it
  // belongs on the step rather than on an event's work. Note the asymmetry:
  // step hooks receive no `handlers`, so this closes over authApi directly
  // while the event work above gets its client injected.
  onEnter: async ({ updateContext }) => {
    const { qrCode } = await authApi.generateQrCode();
    updateContext((context) => ({ ...context, qrCode }));
  },
  on: {
    setup2fa: [to("verifyCode")]
  }
});

/**
 * Every verification step declares the same `verify` event with its own work
 * and its own candidates — which is what keying work by (step, event) buys.
 *
 * Candidate order is the policy: success wins, then the exhausted-attempts
 * guard, then an unguarded retry. The retry is what makes the event total, so
 * a wrong code commits its attempt count instead of rolling back.
 */
const verificationStep = (
  id: "verifyCode" | "emailCode" | "authenticatorCode",
  metadata: StepMeta,
  blockedError: string,
  retryError: string
) =>
  createStep(id, {
    metadata,
    on: {
      verify: ({ to: into, work }) =>
        work({
          run: ({ snapshot, handlers }) =>
            handlers.api.verifyCode(snapshot.context.verificationCode),
          commit: ({ result, updateContext }) =>
            updateContext((context) => ({
              ...context,
              lastVerifyOk: result.success,
              attempts: result.success ? context.attempts : context.attempts + 1,
              error: result.success ? null : retryError
            })),
          candidates: [
            into("loggedIn").when(({ context }) => context.lastVerifyOk === true),
            into("blocked")
              .when(({ context, handlers }) => handlers.hasExhaustedAttempts(context))
              .onTransition(({ updateContext }) =>
                updateContext((context) => ({ ...context, error: blockedError }))
              ),
            into(id)
          ]
        })
    }
  });

const verifyCodeStep = verificationStep(
  "verifyCode",
  { label: "Verify Code", icon: "✅" },
  "Too many failed attempts.",
  "Invalid code. Try 123456."
);

const emailCodeStep = verificationStep(
  "emailCode",
  { label: "Email Code", icon: "✉️" },
  "Email verification failed too many times.",
  "Use 123456 from the email."
);

const authenticatorCodeStep = verificationStep(
  "authenticatorCode",
  { label: "Authenticator", icon: "🛡️" },
  "Authenticator verification failed too many times.",
  "Use 123456 from the authenticator app."
);

const loggedInStep = createStep("loggedIn", {
  metadata: { label: "Logged In", icon: "🎉" }
});

const blockedStep = createStep("blocked", {
  metadata: { label: "Blocked", icon: "⛔" }
});

export const graphDefinition = build({
  initial: "login",
  context: initialLoginContext(),
  // The definition ships a default policy and the real client; the demo
  // overrides both at createGraphJourney time to show the seam, which is
  // exactly how a test would swap in a fake api (see showcase-demo.ts).
  handlers: createAuthHandlers(2, authApi),
  steps: [
    loginStep,
    setup2faStep,
    verifyCodeStep,
    emailCodeStep,
    authenticatorCodeStep,
    loggedInStep,
    blockedStep
  ]
});

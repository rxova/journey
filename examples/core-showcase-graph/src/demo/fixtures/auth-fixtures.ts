import type { GraphDefinition, GraphStep } from "@rxova/journey-core";
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
  attempts: 0
});

export type AuthBag = {
  context: LoginContext;
  stepId: LoginStepId;
  events: AuthEvent;
  meta: StepMeta;
  handlers: AuthHandlers;
  // `run` sits at a property position, which is not an inference site, so the
  // result type of each work is pinned here rather than inferred.
  results: {
    submitLogin: Awaited<ReturnType<AuthHandlers["api"]["login"]>>;
    verify: Awaited<ReturnType<AuthHandlers["api"]["verifyCode"]>>;
  };
};

/**
 * The login work: the machine calls the API itself, stages what came back, and
 * only then do the guards pick a step. The call site is a bare
 * `send("submitLogin")` — it neither knows nor decides the 2FA method.
 *
 * The last candidate is unguarded — a fallback back at `login`. That keeps the
 * event *total*: a failed login still routes somewhere, so its error message
 * commits instead of being rolled back with the unmatched send.
 */
const loginStep: GraphStep<AuthBag> = {
  metadata: { label: "Login", icon: "\ud83d\udd10" },
  on: {
    submitLogin: {
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
        {
          to: "setup2fa",
          when: ({ context, handlers }) => handlers.requiresMethod(context, "no_2fa")
        },
        {
          to: "emailCode",
          when: ({ context, handlers }) => handlers.requiresMethod(context, "email")
        },
        {
          to: "authenticatorCode",
          when: ({ context, handlers }) => handlers.requiresMethod(context, "authenticator")
        },
        { to: "login" }
      ]
    }
  }
};

const setup2faStep: GraphStep<AuthBag> = {
  metadata: { label: "Setup 2FA", icon: "\ud83d\udcf1" },
  // Enrollment is a side effect of *arriving*, not of choosing a route, so it
  // belongs on the step rather than on an event's work. Note the asymmetry:
  // step hooks receive no `handlers`, so this closes over authApi directly
  // while the event work above gets its client injected.
  onEnter: async ({ updateContext }) => {
    const { qrCode } = await authApi.generateQrCode();
    updateContext((context) => ({ ...context, qrCode }));
  },
  on: { setup2fa: "verifyCode" }
};

/**
 * Every verification step declares the same `verify` event with its own work
 * and its own candidates — which is what keying work by (step, event) buys.
 *
 * Candidates route on the context `commit` staged, never on the run result
 * directly: guards stay total functions of context, so snapshot introspection
 * (`outgoingTransitions`, `availableEvents`) reports the same answer the live
 * send would. Order is the policy — success first, then exhausted attempts,
 * then the unguarded retry that makes the event total, so a wrong code commits
 * its attempt count instead of rolling back.
 */
const verificationStep = (
  metadata: StepMeta,
  self: "verifyCode" | "emailCode" | "authenticatorCode",
  blockedError: string,
  retryError: string
): GraphStep<AuthBag> => ({
  metadata,
  on: {
    verify: {
      run: ({ snapshot, handlers }) => handlers.api.verifyCode(snapshot.context.verificationCode),
      commit: ({ result, updateContext }) =>
        updateContext((context) => ({
          ...context,
          attempts: result.success ? context.attempts : context.attempts + 1,
          error: result.success ? null : retryError
        })),
      candidates: [
        // `commit` always writes `error`, so a null one means this verify
        // succeeded — the staged fact the route is decided from.
        { to: "loggedIn", when: ({ context }) => context.error === null },
        {
          to: "blocked",
          when: ({ context, handlers }) => handlers.hasExhaustedAttempts(context),
          onTransition: ({ updateContext }) =>
            updateContext((context) => ({ ...context, error: blockedError }))
        },
        { to: self }
      ]
    }
  }
});

const verifyCodeStep = verificationStep(
  { label: "Verify Code", icon: "\u2705" },
  "verifyCode",
  "Too many failed attempts.",
  "Invalid code. Try 123456."
);

const emailCodeStep = verificationStep(
  { label: "Email Code", icon: "\u2709\ufe0f" },
  "emailCode",
  "Email verification failed too many times.",
  "Use 123456 from the email."
);

const authenticatorCodeStep = verificationStep(
  { label: "Authenticator", icon: "\ud83d\udee1\ufe0f" },
  "authenticatorCode",
  "Authenticator verification failed too many times.",
  "Use 123456 from the authenticator app."
);

const loggedInStep: GraphStep<AuthBag> = { metadata: { label: "Logged In", icon: "\ud83c\udf89" } };

const blockedStep: GraphStep<AuthBag> = { metadata: { label: "Blocked", icon: "\u26d4" } };

export const graphDefinition = {
  initial: "login",
  context: initialLoginContext(),
  // The definition ships a default policy and the real client; the demo
  // overrides both at createGraphJourney time to show the seam, which is
  // exactly how a test would swap in a fake api (see showcase-demo.ts).
  handlers: createAuthHandlers(2, authApi),
  steps: {
    login: loginStep,
    setup2fa: setup2faStep,
    verifyCode: verifyCodeStep,
    emailCode: emailCodeStep,
    authenticatorCode: authenticatorCodeStep,
    loggedIn: loggedInStep,
    blocked: blockedStep
  }
} satisfies GraphDefinition<AuthBag>;

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
};

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
  /** Routing policy: does the login result call for this 2FA method? */
  requiresMethod: (context: LoginContext, method: TwoFactorMethod) => boolean;
  /** Retry policy: has the user burned every allowed attempt? */
  hasExhaustedAttempts: (context: LoginContext) => boolean;
  /** Human-readable form of the active retry policy, for the Runtime row. */
  describeRetryPolicy: () => string;
};

export const createAuthHandlers = (maxAttempts: number): AuthHandlers => ({
  requiresMethod: (context, method) => context.twoFactorMethod === method,
  hasExhaustedAttempts: (context) => context.attempts >= maxAttempts,
  describeRetryPolicy: () => `${maxAttempts} attempts`
});

export type AuthEvent =
  | { type: "submitLogin" }
  | { type: "setup2fa" }
  | { type: "verifyCodeSuccess" }
  | { type: "verifyCodeFailure" }
  | { type: "verifyEmailSuccess" }
  | { type: "verifyEmailFailure" }
  | { type: "verifyAuthenticatorSuccess" }
  | { type: "verifyAuthenticatorFailure" };

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

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: LoginContext;
  stepId: LoginStepId;
  events: AuthEvent;
  meta: StepMeta;
  handlers: AuthHandlers;
}>();

const clearError = (context: LoginContext): LoginContext => ({ ...context, error: null });

const loginStep = createStep("login", {
  metadata: { label: "Login", icon: "🔐" },
  on: {
    submitLogin: [
      to("setup2fa")
        .when(({ context, handlers }) => handlers.requiresMethod(context, "no_2fa"))
        .onTransition(({ updateContext }) => updateContext(clearError)),
      to("emailCode")
        .when(({ context, handlers }) => handlers.requiresMethod(context, "email"))
        .onTransition(({ updateContext }) =>
          updateContext((context) => ({ ...clearError(context), password: "" }))
        ),
      to("authenticatorCode")
        .when(({ context, handlers }) => handlers.requiresMethod(context, "authenticator"))
        .onTransition(({ updateContext }) =>
          updateContext((context) => ({ ...clearError(context), password: "" }))
        )
    ]
  }
});

const setup2faStep = createStep("setup2fa", {
  metadata: { label: "Setup 2FA", icon: "📱" },
  on: {
    setup2fa: [to("verifyCode")]
  }
});

/** Failure candidates: first-enabled wins, so "blocked" guards the retry loop. */
const failureCandidates = (
  retryTarget: "verifyCode" | "emailCode" | "authenticatorCode",
  blockedError: string,
  retryError: string
) => [
  to("blocked")
    .when(({ context, handlers }) => handlers.hasExhaustedAttempts(context))
    .onTransition(({ updateContext }) =>
      updateContext((context) => ({
        ...context,
        attempts: context.attempts + 1,
        error: blockedError
      }))
    ),
  to(retryTarget).onTransition(({ updateContext }) =>
    updateContext((context) => ({
      ...context,
      attempts: context.attempts + 1,
      error: retryError
    }))
  )
];

const verifyCodeStep = createStep("verifyCode", {
  metadata: { label: "Verify Code", icon: "✅" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: failureCandidates(
      "verifyCode",
      "Too many failed attempts.",
      "Invalid code. Try 123456."
    )
  }
});

const emailCodeStep = createStep("emailCode", {
  metadata: { label: "Email Code", icon: "✉️" },
  on: {
    verifyEmailSuccess: [to("loggedIn")],
    verifyEmailFailure: failureCandidates(
      "emailCode",
      "Email verification failed too many times.",
      "Use 123456 from the email."
    )
  }
});

const authenticatorCodeStep = createStep("authenticatorCode", {
  metadata: { label: "Authenticator", icon: "🛡️" },
  on: {
    verifyAuthenticatorSuccess: [to("loggedIn")],
    verifyAuthenticatorFailure: failureCandidates(
      "authenticatorCode",
      "Authenticator verification failed too many times.",
      "Use 123456 from the authenticator app."
    )
  }
});

const loggedInStep = createStep("loggedIn", {
  metadata: { label: "Logged In", icon: "🎉" }
});

const blockedStep = createStep("blocked", {
  metadata: { label: "Blocked", icon: "⛔" }
});

export const graphDefinition = build({
  initial: "login",
  context: initialLoginContext(),
  // The definition ships a default policy; the demo overrides it at
  // createGraphJourney time to show the seam (see showcase-demo.ts).
  handlers: createAuthHandlers(2),
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

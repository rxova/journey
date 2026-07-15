import { createGraphJourneyBuilder, type LinearJourneyDefinition } from "@rxova/journey-core";
import { delay } from "./support";

export type LoginStepId =
  | "login"
  | "setup2fa"
  | "verifyCode"
  | "emailCode"
  | "authenticatorCode"
  | "loggedIn"
  | "blocked";

export type LoginContext = {
  username: string;
  password: string;
  twoFactorMethod: "no_2fa" | "email" | "authenticator" | null;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
  loggedInStatus: "loggedIn" | "blocked" | null;
};

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
  verifyCode: async (code: string, attempts: number) => {
    await delay(400);
    if (code === "123456") {
      return { success: true as const, loggedInStatus: "loggedIn" as const };
    }
    const loggedInStatus = attempts + 1 >= 3 ? ("blocked" as const) : null;
    return { success: false as const, loggedInStatus };
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
  loggedInStatus: null
});

export const linearDefinition = {
  context: { ...initialLoginContext(), twoFactorMethod: "no_2fa" as const },
  steps: [
    { id: "login", metadata: { label: "Login" } },
    { id: "setup2fa", metadata: { label: "Setup 2FA" } },
    { id: "verifyCode", metadata: { label: "Verify Code" } },
    { id: "loggedIn", metadata: { label: "Status" } }
  ]
} satisfies LinearJourneyDefinition<LoginContext>;

/**
 * The "headless" scenario: every auth step in one machine, navigated purely by
 * ungated `goToStepById`. The dedicated headless tier is reserved in the
 * rewritten core; linear minus its declared-order navigation is exactly that
 * story (linear = headless + declared order).
 */
export const headlessDefinition = {
  context: initialLoginContext(),
  steps: [
    { id: "login", metadata: { label: "Login" } },
    { id: "setup2fa", metadata: { label: "Setup 2FA" } },
    { id: "verifyCode", metadata: { label: "Verify Code" } },
    { id: "emailCode", metadata: { label: "Email Code" } },
    { id: "authenticatorCode", metadata: { label: "Authenticator" } },
    { id: "loggedIn", metadata: { label: "Logged In" } },
    { id: "blocked", metadata: { label: "Blocked" } }
  ]
} satisfies LinearJourneyDefinition<LoginContext>;

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: LoginContext;
  stepId: LoginStepId;
  events: AuthEvent;
  meta: StepMeta;
}>();

const clearError = (context: LoginContext): LoginContext => ({ ...context, error: null });

const loginStep = createStep("login", {
  metadata: { label: "Login", icon: "🔐" },
  on: {
    submitLogin: [
      to("setup2fa")
        .when(({ context }) => context.twoFactorMethod === "no_2fa")
        .onTransition(({ updateContext }) => updateContext(clearError)),
      to("emailCode")
        .when(({ context }) => context.twoFactorMethod === "email")
        .onTransition(({ updateContext }) =>
          updateContext((context) => ({ ...clearError(context), password: "" }))
        ),
      to("authenticatorCode")
        .when(({ context }) => context.twoFactorMethod === "authenticator")
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
    .when(({ context }) => context.attempts >= 2)
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

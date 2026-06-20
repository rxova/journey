/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {
  createGraphJourneyBuilder,
  type HeadlessJourneyDefinition,
  type LinearJourneyDefinition
} from "@rxova/journey-core";
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
};

export type AuthEventMap = {
  submitLogin: Record<never, never>;
  setup2fa: Record<never, never>;
  verifyCodeSuccess: Record<never, never>;
  verifyCodeFailure: Record<never, never>;
  verifyEmailSuccess: Record<never, never>;
  verifyEmailFailure: Record<never, never>;
  verifyAuthenticatorSuccess: Record<never, never>;
  verifyAuthenticatorFailure: Record<never, never>;
};

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

export const linearDefinition: LinearJourneyDefinition<
  LoginContext,
  "login" | "setup2fa" | "verifyCode" | "loggedIn",
  { label: string }
> = {
  context: {
    username: "",
    password: "",
    twoFactorMethod: "no_2fa",
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: [
    { id: "login", meta: { label: "Login" } },
    { id: "setup2fa", meta: { label: "Setup 2FA" } },
    { id: "verifyCode", meta: { label: "Verify Code" } },
    { id: "loggedIn", meta: { label: "Logged In" } }
  ]
};

const { createStep, to, build } = createGraphJourneyBuilder<
  LoginContext,
  LoginStepId,
  AuthEventMap,
  StepMeta
>();

const loginStep = createStep("login", {
  meta: { label: "Login", icon: "🔐" },
  on: {
    submitLogin: [
      to("setup2fa")
        .when(({ context }) => context.twoFactorMethod === "no_2fa")
        .updateContext(({ context }) => ({ ...context, error: null })),
      to("emailCode")
        .when(({ context }) => context.twoFactorMethod === "email")
        .updateContext(({ context }) => ({ ...context, password: "", error: null })),
      to("authenticatorCode")
        .when(({ context }) => context.twoFactorMethod === "authenticator")
        .updateContext(({ context }) => ({ ...context, password: "", error: null }))
    ]
  }
});

const setup2faStep = createStep("setup2fa", {
  meta: { label: "Setup 2FA", icon: "📱" },
  on: {
    setup2fa: [to("verifyCode").label("setup-to-verify")]
  }
});

const verifyCodeStep = createStep("verifyCode", {
  meta: { label: "Verify Code", icon: "✅" },
  on: {
    verifyCodeSuccess: [to("loggedIn").label("verify-success")],
    verifyCodeFailure: [
      to("blocked")
        .when(({ context }) => context.attempts >= 2)
        .updateContext(({ context }) => ({
          ...context,
          attempts: context.attempts + 1,
          error: "Too many failed attempts."
        })),
      to("verifyCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Invalid code. Try 123456."
      }))
    ]
  }
});

const emailCodeStep = createStep("emailCode", {
  meta: { label: "Email Code", icon: "✉️" },
  on: {
    verifyEmailSuccess: [to("loggedIn").label("email-success")],
    verifyEmailFailure: [
      to("blocked")
        .when(({ context }) => context.attempts >= 2)
        .updateContext(({ context }) => ({
          ...context,
          attempts: context.attempts + 1,
          error: "Email verification failed too many times."
        })),
      to("emailCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Use 123456 from the email."
      }))
    ]
  }
});

const authenticatorCodeStep = createStep("authenticatorCode", {
  meta: { label: "Authenticator", icon: "🛡️" },
  on: {
    verifyAuthenticatorSuccess: [to("loggedIn").label("auth-success")],
    verifyAuthenticatorFailure: [
      to("blocked")
        .when(({ context }) => context.attempts >= 2)
        .updateContext(({ context }) => ({
          ...context,
          attempts: context.attempts + 1,
          error: "Authenticator verification failed too many times."
        })),
      to("authenticatorCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Use 123456 from the authenticator app."
      }))
    ]
  }
});

const loggedInStep = createStep("loggedIn", {
  meta: { label: "Logged In", icon: "🎉" }
});

const blockedStep = createStep("blocked", {
  meta: { label: "Blocked", icon: "⛔" },
  // Demonstrates `after`: a delayed transition that auto-recovers the dead-end
  // "blocked" screen back to "login" after a cooldown, resetting the attempt
  // state. The timer starts on entry and cancels if the step is left first.
  after: {
    5000: {
      to: "login",
      updateContext: ({ context }) => ({
        ...context,
        attempts: 0,
        error: null,
        password: ""
      })
    }
  }
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

export const headlessDefinition: HeadlessJourneyDefinition<LoginContext, LoginStepId> = {
  initial: "login",
  context: initialLoginContext(),
  steps: {
    login: {},
    setup2fa: {},
    verifyCode: {},
    emailCode: {},
    authenticatorCode: {},
    loggedIn: {},
    blocked: {}
  }
};

import { createJourney } from "@rxova/journey-react";
import type { JourneyDefinition, JourneyLinearStep } from "@rxova/journey-core";

export type StepId = "login" | "setup2fa" | "verifyCode" | "loggedIn";

export type LoginContext = {
  username: string;
  password: string;
  verificationCode: string;
  qrCode: string | null;
  error: string | null;
  attempts: number;
};

type StepMeta = { label: string };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  login: async (username: string, password: string) => {
    void username;
    void password;
    await delay(800);
    return { success: true, method: "no_2fa" as const };
  },
  generateQrCode: async () => {
    await delay(400);
    return { qrCode: "otpauth://totp/App:user?secret=BASE32SECRET" };
  },
  verifyCode: async (code: string) => {
    await delay(600);
    return { success: code === "123456" };
  }
};

const setup2faStep: JourneyLinearStep<LoginContext, StepId> = {
  step: "setup2fa",
  id: "login-to-setup",
  timeoutMs: 10000
};

const verifyCodeStep: JourneyLinearStep<LoginContext, StepId> = {
  step: "verifyCode",
  id: "setup-to-verify",
  timeoutMs: 5000
};

const definition: JourneyDefinition<LoginContext, StepId, Record<never, never>, StepMeta> = {
  context: {
    username: "",
    password: "",
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: {
    login: { meta: { label: "Login" } },
    setup2fa: { meta: { label: "Setup 2FA" } },
    verifyCode: { meta: { label: "Verify Code" } },
    loggedIn: { meta: { label: "Logged In" } }
  },
  transitions: ["login", setup2faStep, verifyCodeStep, "loggedIn"]
};

export const journey = createJourney(definition);

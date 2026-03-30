import { createJourney } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

export type StepId =
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

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  login: async (username: string, password: string) => {
    await delay(800);
    if (password === "blocked") return { success: false as const, method: null };
    const methods = ["no_2fa", "email", "authenticator"] as const;
    const method = methods[username.length % 3]!;
    return { success: true as const, method };
  },
  generateQrCode: async () => {
    await delay(400);
    return { qrCode: "otpauth://totp/App:user?secret=BASE32SECRET" };
  },
  verifyCode: async (code: string) => {
    await delay(600);
    return { success: code === "123456" };
  },
  sendEmailCode: async () => {
    await delay(500);
    return { sent: true };
  }
};

const definition: JourneyDefinition<LoginContext, StepId> = {
  initial: "login",
  context: {
    username: "",
    password: "",
    twoFactorMethod: null,
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: {
    login: {},
    setup2fa: {},
    verifyCode: {},
    emailCode: {},
    authenticatorCode: {},
    loggedIn: {},
    blocked: {}
  }
  // No transitions — headless mode. All navigation via goToStepById.
};

export const {
  useJourneySnapshot,
  useJourneyComputed,
  useJourneyApi,
  useJourneyEvent,
  JourneyProvider,
  StepRenderer,
  machine
} = createJourney(definition);

import type { LinearJourneyDefinition } from "@rxova/journey-core";
import { delay } from "./support";

export type LoginStepId = "login" | "setup2fa" | "verifyCode" | "loggedIn";

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

export const authApi = {
  login: async (username: string, password: string) => {
    await delay(1200);
    if (password === "blocked") {
      return { success: false as const, method: null };
    }

    const methods = ["no_2fa", "email", "authenticator"] as const;
    return { success: true as const, method: methods[username.length % 3] ?? "no_2fa" };
  },
  generateQrCode: async () => {
    await delay(700);
    return { qrCode: "otpauth://totp/Rxova:user?secret=BASE32SECRET" };
  },
  confirmTwoFactorSetup: async (qrCode: string | null) => {
    await delay(6_000);
    return qrCode !== null;
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

const linearInitialContext: LoginContext = {
  ...initialLoginContext(),
  twoFactorMethod: "no_2fa"
};

export const linearDefinition = {
  context: linearInitialContext,
  steps: [
    { id: "login", metadata: { label: "Login" } },
    {
      id: "setup2fa",
      metadata: { label: "Setup 2FA" },
      onEnter: async ({ updateContext }) => {
        const enrollment = await authApi.generateQrCode();
        updateContext((context) => ({ ...context, qrCode: enrollment.qrCode }));
      }
    },
    { id: "verifyCode", metadata: { label: "Verify Code" } },
    { id: "loggedIn", metadata: { label: "Status" } }
  ]
} satisfies LinearJourneyDefinition<LoginContext>;

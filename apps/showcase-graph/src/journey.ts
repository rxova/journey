import { createJourney } from "@rxova/journey-react";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { build } from "./builder";
import { loginStep } from "./steps/login.step";
import { setup2faStep } from "./steps/setup2fa.step";
import { verifyCodeStep } from "./steps/verifyCode.step";
import { emailCodeStep } from "./steps/emailCode.step";
import { authenticatorCodeStep } from "./steps/authenticatorCode.step";
import { loggedInStep } from "./steps/loggedIn.step";
import { blockedStep } from "./steps/blocked.step";

export { mockApi } from "./api";
export type { StepId, LoginContext, EventMap, StepMeta } from "./types";

const definition = build({
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
  steps: [
    loginStep,
    setup2faStep,
    verifyCodeStep,
    emailCodeStep,
    authenticatorCodeStep,
    loggedInStep,
    blockedStep
  ],
  global: {
    completeJourney: true,
    terminateJourney: true
  }
});

export const journey = createJourney(definition, {
  defaultTimeoutMs: 15000,
  plugins: [createExecutionPathsPlugin()] as const
});

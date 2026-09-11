import { withGraphTypes } from "@rxova/journey-react/graph";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import type { GraphDefinition } from "@rxova/journey-core";
import { mockApi } from "./api";
import { loginStep } from "./steps/login.step";
import { setup2faStep } from "./steps/setup2fa.step";
import { verifyCodeStep } from "./steps/verifyCode.step";
import { emailCodeStep } from "./steps/emailCode.step";
import { authenticatorCodeStep } from "./steps/authenticatorCode.step";
import { loggedInStep } from "./steps/loggedIn.step";
import { blockedStep } from "./steps/blocked.step";

export { mockApi } from "./api";
export type { StepId, LoginContext, EventMap, StepMeta } from "./types";

import type { AuthBag } from "./types";

const definition = {
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
  // Injected dependencies — the verifyCode step's guard calls handlers.verifyCode
  // instead of importing the API. A test passes a different verifyCode here.
  handlers: {
    verifyCode: mockApi.verifyCode
  },
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

const plugins = [createExecutionPathsPlugin()] as const;

export const journey = withGraphTypes<AuthBag>()(definition, {
  defaultTimeoutMs: 15000,
  plugins
});

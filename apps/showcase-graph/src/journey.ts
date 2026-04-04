import { createJourney } from "@rxova/journey-react";
import type { JourneyBuilderRuntimeFromDefinition } from "@rxova/journey-react";
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
    completeJourney: [
      {
        onLeave: ({ context, from }) => {
          console.log("[graph] global completeJourney onLeave", {
            from,
            attempts: context.attempts
          });
        },
        onEnter: ({ context, from, to }) => {
          console.log("[graph] global completeJourney onEnter", {
            from,
            to,
            attempts: context.attempts
          });
        }
      }
    ],
    terminateJourney: [
      {
        onLeave: ({ context, from }) => {
          console.log("[graph] global terminateJourney onLeave", {
            from,
            attempts: context.attempts
          });
        },
        onEnter: ({ context, from, to }) => {
          console.log("[graph] global terminateJourney onEnter", {
            from,
            to,
            attempts: context.attempts
          });
        }
      }
    ]
  }
});

const plugins = [createExecutionPathsPlugin()] as const;

export const journey: JourneyBuilderRuntimeFromDefinition<typeof definition, typeof plugins> =
  createJourney(definition, {
    defaultTimeoutMs: 15000,
    plugins
  });

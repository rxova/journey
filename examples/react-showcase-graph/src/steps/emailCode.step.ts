import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const emailCodeStep: GraphStep<AuthBag> = {
  metadata: { label: "Email Code", icon: "\ud83d\udce7" },
  on: {
    verifyCodeSuccess: "loggedIn",
    verifyCodeFailure: [
      { to: "blocked", when: ({ context }) => context.attempts >= 3 },
      { to: "emailCode" }
    ],
    switchAuthMethod: "authenticatorCode"
  }
};

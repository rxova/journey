import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const authenticatorCodeStep: GraphStep<AuthBag> = {
  metadata: { label: "Authenticator", icon: "\ud83d\udd10" },
  on: {
    verifyCodeSuccess: "loggedIn",
    verifyCodeFailure: [
      { to: "blocked", when: ({ context }) => context.attempts >= 3 },
      { to: "authenticatorCode" }
    ],
    switchAuthMethod: "emailCode"
  }
};

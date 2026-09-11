import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const verifyCodeStep: GraphStep<AuthBag> = {
  metadata: { label: "Verify Setup", icon: "\u2705" },
  on: {
    verifyCodeSuccess: "loggedIn",
    verifyCodeFailure: [
      { to: "blocked", when: ({ context }) => context.attempts >= 3 },
      { to: "verifyCode" }
    ]
  }
};

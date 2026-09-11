import type { ReactGraphStep } from "@rxova/journey-react/graph";
import type { AuthBag } from "../types";

export const verifyCodeStep: ReactGraphStep<AuthBag> = {
  metadata: { label: "Verify Setup", icon: "\u2705" },
  on: {
    verifyCodeSuccess: "loggedIn",
    verifyCodeFailure: [
      { to: "blocked", when: ({ context }) => context.attempts >= 3 },
      { to: "verifyCode" }
    ]
  }
};

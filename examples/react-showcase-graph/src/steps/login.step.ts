import type { ReactGraphStep } from "@rxova/journey-react/graph";
import type { AuthBag } from "../types";

export const loginStep: ReactGraphStep<AuthBag> = {
  metadata: { label: "Login", icon: "\ud83d\udd11" },
  on: {
    submitLogin: [
      { to: "setup2fa", when: ({ context }) => context.twoFactorMethod === "no_2fa" },
      { to: "emailCode", when: ({ context }) => context.twoFactorMethod === "email" },
      {
        to: "authenticatorCode",
        when: ({ context }) => context.twoFactorMethod === "authenticator"
      }
    ]
  }
};

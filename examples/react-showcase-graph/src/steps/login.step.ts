import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const loginStep: GraphStep<AuthBag> = {
  metadata: { label: "Login", icon: "\ud83d\udd11" },
  onLeave: ({ snapshot }) => {
    console.log("[journey] login: submitting for", snapshot.context.username);
  },
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

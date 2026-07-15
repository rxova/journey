import { createStep, to } from "../builder";

export const authenticatorCodeStep = createStep("authenticatorCode", {
  metadata: { label: "Authenticator", icon: "🔐" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [
      to("blocked").when(({ context }) => context.attempts >= 3),
      to("authenticatorCode")
    ],
    switchAuthMethod: [to("emailCode")]
  }
});

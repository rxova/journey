import { createStep, to } from "../builder";

export const emailCodeStep = createStep("emailCode", {
  metadata: { label: "Email Code", icon: "📧" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [
      to("blocked").when(({ context }) => context.attempts >= 3),
      to("emailCode")
    ],
    switchAuthMethod: [to("authenticatorCode")]
  }
});

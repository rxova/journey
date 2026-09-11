import { createStep, to } from "../builder";

export const verifyCodeStep = createStep("verifyCode", {
  metadata: { label: "Verify Setup", icon: "✅" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [
      to("blocked").when(({ context }) => context.attempts >= 3),
      to("verifyCode")
    ]
  }
});

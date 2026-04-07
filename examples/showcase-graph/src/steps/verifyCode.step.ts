import { createStep, to } from "../builder";

export const verifyCodeStep = createStep("verifyCode", {
  meta: { label: "Verify Setup", icon: "✅" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [
      to("blocked")
        .when(({ context }) => context.attempts >= 2)
        .updateContext(({ context }) => ({
          ...context,
          attempts: context.attempts + 1,
          error: "Too many failed attempts."
        })),
      to("verifyCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Invalid code. Try again."
      }))
    ]
  }
});

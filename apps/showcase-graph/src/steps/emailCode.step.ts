import { createStep, to } from "../builder";

export const emailCodeStep = createStep("emailCode", {
  meta: { label: "Email Code", icon: "📧" },
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
      to("emailCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Invalid code. Try again."
      }))
    ],
    switchAuthMethod: [to("authenticatorCode")]
  }
});

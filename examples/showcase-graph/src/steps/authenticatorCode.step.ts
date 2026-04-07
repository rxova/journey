import { createStep, to } from "../builder";

export const authenticatorCodeStep = createStep("authenticatorCode", {
  meta: { label: "Authenticator", icon: "🔐" },
  on: {
    verifyCodeSuccess: [to("loggedIn")],
    verifyCodeFailure: [
      to("blocked")
        .when(({ context }) => context.attempts >= 2) // { snapshot, context, from, timeline, index, signal, handlers, event }
        .updateContext(({ context }) => {
          // context.attempts = 6;

          return {
            ...context,
            attempts: context.attempts + 1,
            error: "Too many failed attempts."
          };
        }),
      to("authenticatorCode").updateContext(({ context }) => ({
        ...context,
        attempts: context.attempts + 1,
        error: "Invalid code. Try again."
      }))
    ],
    switchAuthMethod: [to("emailCode")]
  }
});

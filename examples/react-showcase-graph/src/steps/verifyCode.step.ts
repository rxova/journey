import { createStep } from "../builder";

export const verifyCodeStep = createStep("verifyCode", {
  meta: { label: "Verify Setup", icon: "✅" },
  on: {
    // `submitCode` carries the entered code; the machine — not the UI — validates
    // it by calling the injected `verifyCode` handler from an async guard. Swap
    // that handler in a test and this flow is unchanged. See the Handlers docs.
    // The callback form of `on` narrows `event` to the `submitCode` payload.
    submitCode: ({ to }) => [
      to("loggedIn").when(async ({ handlers, event }) => {
        const result = await handlers.verifyCode(event.payload?.code ?? "");
        return result.success;
      }),
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

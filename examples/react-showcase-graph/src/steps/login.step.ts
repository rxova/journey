import { createStep } from "../builder";

export const loginStep = createStep("login", {
  meta: { label: "Login", icon: "🔑" },
  onLeave: ({ context }) => {
    console.log("[journey] login: submitting for", context.username);
  },
  on: {
    // Factory form: `to` is typed for "submitLogin", so event.payload is
    // { username: string; password: string } in guards and updates.
    submitLogin: ({ to }) => [
      to("emailCode")
        .when(({ context }) => context.twoFactorMethod === "email")
        .updateContext(({ context }) => ({ ...context, password: "" })),
      to("authenticatorCode")
        .when(({ context }) => context.twoFactorMethod === "authenticator")
        .updateContext(({ context }) => ({ ...context, password: "" }))
    ]
  }
});

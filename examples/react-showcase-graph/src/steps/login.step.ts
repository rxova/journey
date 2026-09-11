import { createStep } from "../builder";

export const loginStep = createStep("login", {
  metadata: { label: "Login", icon: "🔑" },
  onLeave: ({ snapshot }) => {
    console.log("[journey] login: submitting for", snapshot.context.username);
  },
  on: {
    // Factory form: `to` is typed for "submitLogin", so event.payload is
    // { username: string; password: string } in guards and updates.
    submitLogin: ({ to }) => [
      to("setup2fa").when(({ context }) => context.twoFactorMethod === "no_2fa"),
      to("emailCode").when(({ context }) => context.twoFactorMethod === "email"),
      to("authenticatorCode").when(({ context }) => context.twoFactorMethod === "authenticator")
    ]
  }
});

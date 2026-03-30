import { createStep, to } from "../builder";

export const loginStep = createStep("login", {
  meta: { label: "Login", icon: "🔑" },
  onLeave: ({ context }) => {
    console.log("[journey] login: submitting for", context.username);
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

// The outer `to` export is still available for steps that don't need typed payloads.
export { to };

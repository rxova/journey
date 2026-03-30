import { createStep, to } from "../builder";

export const setup2faStep = createStep("setup2fa", {
  meta: { label: "Setup 2FA", icon: "📱" },
  on: {
    setup2fa: [to("verifyCode").id("setup-to-verify")]
  }
});

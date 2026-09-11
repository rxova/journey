import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const setup2faStep: GraphStep<AuthBag> = {
  metadata: { label: "Setup 2FA", icon: "\ud83d\udcf1" },
  on: { setup2fa: "verifyCode" }
};

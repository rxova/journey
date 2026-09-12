import type { ReactGraphStep } from "@rxova/journey-react/graph";
import type { AuthBag } from "../types";

export const setup2faStep: ReactGraphStep<AuthBag> = {
  metadata: { label: "Setup 2FA", icon: "\ud83d\udcf1" },
  on: { setup2fa: "verifyCode" }
};

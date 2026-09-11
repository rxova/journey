import type { ReactGraphStep } from "@rxova/journey-react/graph";
import type { AuthBag } from "../types";

export const blockedStep: ReactGraphStep<AuthBag> = {
  metadata: { label: "Blocked", icon: "\ud83d\udeab" }
};

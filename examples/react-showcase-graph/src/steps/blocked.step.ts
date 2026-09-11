import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const blockedStep: GraphStep<AuthBag> = {
  metadata: { label: "Blocked", icon: "\ud83d\udeab" },
  onEnter: ({ snapshot }) => {
    console.warn(
      "[journey] blocked: account locked after",
      snapshot.context.attempts,
      "failed attempts"
    );
  }
};

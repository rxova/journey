import { createStep } from "../builder";

export const blockedStep = createStep("blocked", {
  metadata: { label: "Blocked", icon: "🚫" },
  onEnter: ({ snapshot }) => {
    console.warn(
      "[journey] blocked: account locked after",
      snapshot.context.attempts,
      "failed attempts"
    );
  }
});

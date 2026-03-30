import { createStep } from "../builder";

export const blockedStep = createStep("blocked", {
  meta: { label: "Blocked", icon: "🚫" },
  onEnter: ({ context }) => {
    console.warn("[journey] blocked: account locked after", context.attempts, "failed attempts");
  }
});

import { createStep } from "../builder";

export const blockedStep = createStep("blocked", {
  meta: { label: "Blocked", icon: "🚫" },
  onEnter: ({ context }) => {
    // {    snapshot, context, from, to, event, transitionId, handlers, signal, dispatch  }
    console.warn("[journey] blocked: account locked after", context.attempts, "failed attempts");
  }
});

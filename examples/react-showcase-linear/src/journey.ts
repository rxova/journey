import { createLinearJourney } from "@rxova/journey-react";
import { initialContext } from "./context";

/**
 * The typed factory: captures the definition once — the context value is the
 * type anchor, the steps carry their configs — and creates one standalone
 * machine. Every hook and delegate on the bundle closes over it, with or
 * without the Provider.
 */
export const loginJourney = createLinearJourney({
  name: "loginJourney",
  context: initialContext,
  steps: ["login", "setup2fa", "verifyCode", { id: "loggedIn", metadata: { label: "Logged In" } }]
});

// The machine is standalone: observers attach at module scope, no React needed.
loginJourney.machine.subscriptions.subscribeEvent("statusChange", ({ current }) => {
  if (current === "completed") {
    console.log("[react linear] journey.completed", loginJourney.machine.getSnapshot().context);
  }
});

import { createLinearJourney } from "@rxova/journey-react";
import { initialContext } from "./context";

/**
 * The typed factory: captures the definition once — the context value is the
 * type anchor, the steps carry their configs — so every step and chrome
 * component gets fully typed hooks with no generics. No machine lives here;
 * one is created per <loginJourney.Provider> mount.
 */
export const loginJourney = createLinearJourney({
  context: initialContext,
  steps: ["login", "setup2fa", "verifyCode", { id: "loggedIn", metadata: { label: "Logged In" } }]
});

/** The bundle's machine type, for imperative escape hatches like machineRef. */
export type LoginJourneyMachine = ReturnType<typeof loginJourney.useJourney>["machine"];

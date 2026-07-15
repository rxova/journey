import { createLinearJourney } from "@rxova/journey-react";
import type { LoginContext } from "./context";

/**
 * The typed curry: binds the context type and the step-id union once, so every
 * step and chrome component gets fully typed hooks with no generics.
 */
export const loginJourney = createLinearJourney<LoginContext>()([
  "login",
  "setup2fa",
  "verifyCode",
  "loggedIn"
]);

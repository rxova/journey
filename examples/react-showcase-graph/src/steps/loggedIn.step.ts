import type { ReactGraphStep } from "@rxova/journey-react/graph";
import type { AuthBag } from "../types";

export const loggedInStep: ReactGraphStep<AuthBag> = {
  metadata: { label: "Logged In", icon: "\ud83c\udf89" }
};

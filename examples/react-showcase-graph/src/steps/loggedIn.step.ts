import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const loggedInStep: GraphStep<AuthBag> = {
  metadata: { label: "Logged In", icon: "\ud83c\udf89" },
  onEnter: ({ snapshot }) => {
    console.log("[journey] loggedIn: authenticated as", snapshot.context.username);
  }
};

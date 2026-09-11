import { createStep } from "../builder";

export const loggedInStep = createStep("loggedIn", {
  metadata: { label: "Logged In", icon: "🎉" },
  onEnter: ({ snapshot }) => {
    console.log("[journey] loggedIn: authenticated as", snapshot.context.username);
  }
});

import { createStep } from "../builder";

export const loggedInStep = createStep("loggedIn", {
  meta: { label: "Logged In", icon: "🎉" },
  onEnter: ({ context }) => {
    console.log("[journey] loggedIn: authenticated as", context.username);
  }
});

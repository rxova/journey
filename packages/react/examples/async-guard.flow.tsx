import React from "react";

import {
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "validate" | "blocked" | "allowed";
type Ctx = { token: string };

const Validate = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Check token</button>;
};
const Blocked = () => <div>Blocked</div>;
const Allowed = () => <div>Allowed</div>;

const isTokenValid = async (token: string) => token.length > 3;

export const asyncGuardJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "validate",
  context: { token: "abcd" },
  steps: {
    validate: { component: Validate },
    blocked: { component: Blocked },
    allowed: { component: Allowed }
  },
  transitions: [
    {
      from: "validate",
      event: "next",
      to: "allowed",
      when: async ({ context }) => isTokenValid(context.token)
    },
    {
      from: "validate",
      event: "next",
      to: "blocked",
      when: async ({ context }) => !(await isTokenValid(context.token))
    }
  ]
};

export const AsyncGuardExample = () => (
  <JourneyProvider journey={asyncGuardJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);

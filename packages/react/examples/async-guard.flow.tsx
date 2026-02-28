import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "validate" | "blocked" | "allowed";
type Ctx = { token: string };

const Validate = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Check token</button>;
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
      event: "goToNextStep",
      to: "allowed",
      when: async ({ context }) => isTokenValid(context.token)
    },
    {
      from: "validate",
      event: "goToNextStep",
      to: "blocked",
      when: async ({ context }) => !(await isTokenValid(context.token))
    }
  ]
};

const bindings = createJourneyBindings(asyncGuardJourney);

export const AsyncGuardExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};

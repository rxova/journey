import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmExit";
type Event = "requestClose";
type Ctx = {
  includeScreenshot: boolean;
  dirty: boolean;
};

const Category = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Details = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Screenshot = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};

const ConfirmExit = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Discard</button>;
};

export const supportTicketJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "category",
  context: {
    includeScreenshot: false,
    dirty: false
  },
  steps: {
    category: { component: Category },
    details: { component: Details },
    screenshot: { component: Screenshot },
    review: { component: Review },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    { from: "category", event: "goToNextStep", to: "details" },
    {
      from: "details",
      event: "goToNextStep",
      to: "screenshot",
      when: ({ context }) => context.includeScreenshot
    },
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeScreenshot
    },
    { from: "screenshot", event: "goToNextStep", to: "review" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "review", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(supportTicketJourney);

export const SupportTicketExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};

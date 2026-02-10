import React from "react";

import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@/src";

type StepId =
  | "destination"
  | "dates"
  | "lodging"
  | "recap"
  | "confirmExit";

type Event = "next" | "back" | "close" | "submit";

type OrderCardsContext = {
  hasMixedCardTypes: boolean;
  needsAddressStep: boolean;
  dirty: boolean;
};

const ChooseType = () => {
  const { api } = useJourney<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const ChooseExceptions = () => {
  const { api } = useJourney<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const AddAddress = () => {
  const { api } = useJourney<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Save address</button>;
};

const Summary = () => {
  const { api } = useJourney<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.submit()}>Place order</button>;
};

const ConfirmClose = () => {
  const { api } = useJourney<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.close()}>Confirm close</button>;
};

export const orderCardsJourney: JourneyReactDefinition<OrderCardsContext, StepId, Event> = {
  initial: "destination",
  context: {
    hasMixedCardTypes: false,
    needsAddressStep: false,
    dirty: false
  },
  steps: {
    destination: { component: ChooseType },
    dates: { component: ChooseExceptions },
    lodging: { component: AddAddress },
    summary: { component: Summary },
    confirmExit: { component: ConfirmClose }
  },
  transitions: [
    {
      from: "destination",
      event: "next",
      to: "dates",
      when: ({ context }) => context.hasMixedCardTypes
    },
    {
      from: "destination",
      event: "next",
      to: "recap",
      when: ({ context }) => !context.hasMixedCardTypes
    },
    {
      from: "dates",
      event: "next",
      to: "lodging",
      when: ({ context }) => context.needsAddressStep
    },
    {
      from: "dates",
      event: "next",
      to: "recap",
      when: ({ context }) => !context.needsAddressStep
    },
    { from: "lodging", event: "next", to: "recap" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "recap", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const OrderCardsExample = () => (
  <JourneyProvider journey={orderCardsJourney}>
    <JourneyStepRenderer<OrderCardsContext, StepId, Event> />
  </JourneyProvider>
);

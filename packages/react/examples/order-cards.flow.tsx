import React from "react";

import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId =
  | "chooseOrderCardType"
  | "chooseExceptions"
  | "addNewAddress"
  | "summary"
  | "confirmClose";

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
  initial: "chooseOrderCardType",
  context: {
    hasMixedCardTypes: false,
    needsAddressStep: false,
    dirty: false
  },
  steps: {
    chooseOrderCardType: { component: ChooseType },
    chooseExceptions: { component: ChooseExceptions },
    addNewAddress: { component: AddAddress },
    summary: { component: Summary },
    confirmClose: { component: ConfirmClose }
  },
  transitions: [
    {
      from: "chooseOrderCardType",
      event: "next",
      to: "chooseExceptions",
      when: ({ context }) => context.hasMixedCardTypes
    },
    {
      from: "chooseOrderCardType",
      event: "next",
      to: "summary",
      when: ({ context }) => !context.hasMixedCardTypes
    },
    {
      from: "chooseExceptions",
      event: "next",
      to: "addNewAddress",
      when: ({ context }) => context.needsAddressStep
    },
    {
      from: "chooseExceptions",
      event: "next",
      to: "summary",
      when: ({ context }) => !context.needsAddressStep
    },
    { from: "addNewAddress", event: "next", to: "summary" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmClose",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "summary", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const OrderCardsExample = () => (
  <JourneyProvider journey={orderCardsJourney}>
    <JourneyStepRenderer<OrderCardsContext, StepId, Event> />
  </JourneyProvider>
);

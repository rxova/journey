import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

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
  const { api } = useFlow<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const ChooseExceptions = () => {
  const { api } = useFlow<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const AddAddress = () => {
  const { api } = useFlow<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.next()}>Save address</button>;
};

const Summary = () => {
  const { api } = useFlow<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.submit()}>Place order</button>;
};

const ConfirmClose = () => {
  const { api } = useFlow<OrderCardsContext, StepId, Event>();
  return <button onClick={() => api.close()}>Confirm close</button>;
};

export const orderCardsFlow: FlowReactFlow<OrderCardsContext, StepId, Event> = {
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
      to: FLOW_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "summary", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const OrderCardsExample = () => (
  <FlowProvider flow={orderCardsFlow}>
    <FlowStepRenderer<OrderCardsContext, StepId, Event> />
  </FlowProvider>
);

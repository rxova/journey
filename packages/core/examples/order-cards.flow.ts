import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

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

export const orderCardsJourney: JourneyDefinition<OrderCardsContext, StepId, Event> = {
  initial: "chooseOrderCardType",
  context: {
    hasMixedCardTypes: false,
    needsAddressStep: false,
    dirty: false
  },
  steps: {
    chooseOrderCardType: {},
    chooseExceptions: {},
    addNewAddress: {},
    summary: {},
    confirmClose: {}
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

export const createOrderCardsMachine = () =>
  createJourneyMachine<OrderCardsContext, StepId, Event>(orderCardsJourney);

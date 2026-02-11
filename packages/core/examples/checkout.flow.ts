import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Event = "next" | "back" | "close" | "submit";
type Ctx = {
  needsShipping: boolean;
  wantsGiftWrap: boolean;
};

export const checkoutJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "cart",
  context: {
    needsShipping: true,
    wantsGiftWrap: false
  },
  steps: {
    cart: {},
    address: {},
    giftWrap: {},
    payment: {},
    review: {}
  },
  transitions: [
    {
      from: "cart",
      event: "next",
      to: "address",
      when: ({ context }) => context.needsShipping
    },
    {
      from: "cart",
      event: "next",
      to: "payment",
      when: ({ context }) => !context.needsShipping
    },
    {
      from: "address",
      event: "next",
      to: "giftWrap",
      when: ({ context }) => context.wantsGiftWrap
    },
    {
      from: "address",
      event: "next",
      to: "payment",
      when: ({ context }) => !context.wantsGiftWrap
    },
    { from: "giftWrap", event: "next", to: "payment" },
    { from: "payment", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const createCheckoutMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(checkoutJourney);

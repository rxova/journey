import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
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
      event: "goToNextStep",
      to: "address",
      when: ({ context }) => context.needsShipping
    },
    {
      from: "cart",
      event: "goToNextStep",
      to: "payment",
      when: ({ context }) => !context.needsShipping
    },
    {
      from: "address",
      event: "goToNextStep",
      to: "giftWrap",
      when: ({ context }) => context.wantsGiftWrap
    },
    {
      from: "address",
      event: "goToNextStep",
      to: "payment",
      when: ({ context }) => !context.wantsGiftWrap
    },
    { from: "giftWrap", event: "goToNextStep", to: "payment" },
    { from: "payment", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

export const createCheckoutMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(checkoutJourney);

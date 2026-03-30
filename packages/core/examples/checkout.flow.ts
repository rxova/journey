import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Ctx = {
  needsShipping: boolean;
  wantsGiftWrap: boolean;
};

export const checkoutJourney: JourneyDefinition<Ctx, StepId> = {
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
  transitions: {
    cart: {
      goToNextStep: [
        { to: "address", when: ({ context }) => context.needsShipping },
        { to: "payment", when: ({ context }) => !context.needsShipping }
      ]
    },
    address: {
      goToNextStep: [
        { to: "giftWrap", when: ({ context }) => context.wantsGiftWrap },
        { to: "payment", when: ({ context }) => !context.wantsGiftWrap }
      ]
    },
    giftWrap: { goToNextStep: [{ to: "payment" }] },
    payment: { goToNextStep: [{ to: "review" }] },
    review: { completeJourney: [{}] },
    global: { terminateJourney: [{}] }
  }
};

export const createCheckoutMachine = () => createJourneyMachine(checkoutJourney);

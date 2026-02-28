import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Ctx = {
  needsShipping: boolean;
  wantsGiftWrap: boolean;
};

const Cart = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Checkout</button>;
};

const Address = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const GiftWrap = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Payment = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Review order</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Place order</button>;
};

export const checkoutJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "cart",
  context: {
    needsShipping: true,
    wantsGiftWrap: false
  },
  steps: {
    cart: { component: Cart },
    address: { component: Address },
    giftWrap: { component: GiftWrap },
    payment: { component: Payment },
    review: { component: Review }
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

const bindings = createJourneyBindings(checkoutJourney);

export const CheckoutExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};

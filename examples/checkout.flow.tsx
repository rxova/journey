import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Ctx = {
  needsShipping: boolean;
  wantsGiftWrap: boolean;
};

const Cart = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Checkout</button>;
};

const Address = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const GiftWrap = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const Payment = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Review order</button>;
};

const Review = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Place order</button>;
};

export const checkoutFlow: FlowReactFlow<Ctx, StepId> = {
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
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: FLOW_TERMINAL.CLOSE }
  ]
};

export const CheckoutExample = () => (
  <FlowProvider flow={checkoutFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);

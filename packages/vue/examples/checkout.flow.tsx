import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "cart" | "address" | "giftWrap" | "payment" | "review";
type Ctx = {
  needsShipping: boolean;
  wantsGiftWrap: boolean;
};

const Cart = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Checkout</button>`
});

const Address = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const GiftWrap = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const Payment = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Review order</button>`
});

const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Place order</button>`
});

export const checkoutJourney: JourneyVueDefinition<Ctx, StepId> = {
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

export const CheckoutExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});

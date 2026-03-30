import { createJourney } from "@rxova/journey-react";
import { checkoutJourney } from "../../core/examples/checkout.flow";

export { checkoutJourney } from "../../core/examples/checkout.flow";

const journey = createJourney(checkoutJourney);

const Cart = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Checkout</button>;
};

const Address = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const GiftWrap = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Payment = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Review order</button>;
};

const Review = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Place order</button>;
};
const views = {
  cart: Cart,
  address: Address,
  giftWrap: GiftWrap,
  payment: Payment,
  review: Review
};

export const CheckoutExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};

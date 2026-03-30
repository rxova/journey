import { createJourney } from "@rxova/journey-react";
import { goToJumpJourney } from "../../core/examples/go-to-jump.flow";

export { goToJumpJourney } from "../../core/examples/go-to-jump.flow";

const journey = createJourney(goToJumpJourney);

const Step1 = () => {
  const api = journey.useJourneyApi();
  return (
    <button onClick={() => api.send({ type: "goToStepById", stepId: "review" })}>
      Jump to review
    </button>
  );
};
const Step2 = () => <div>Step 2</div>;
const Review = () => <div>Review</div>;
const views = {
  step1: Step1,
  step2: Step2,
  review: Review
};

export const GoToJumpExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};

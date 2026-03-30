import { createJourney } from "@rxova/journey-react";
import { historyBackJourney } from "../../core/examples/history-back.flow";

export { historyBackJourney } from "../../core/examples/history-back.flow";

const journey = createJourney(historyBackJourney);

const Start = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const BranchA = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>To review</button>;
};
const BranchB = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>To review</button>;
};
const Review = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToPreviousStep()}>Back by history</button>;
};
const views = {
  start: Start,
  branchA: BranchA,
  branchB: BranchB,
  review: Review
};

export const HistoryBackExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};

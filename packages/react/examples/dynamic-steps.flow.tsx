import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = string;
type Ctx = { includeSurvey: boolean };

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Start</button>;
};

const Details = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Survey = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Finish survey</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};

const buildJourney = (includeSurvey: boolean): JourneyReactDefinition<Ctx, StepId> => ({
  initial: "start",
  context: { includeSurvey },
  steps: includeSurvey
    ? {
        start: { component: Start },
        details: { component: Details },
        survey: { component: Survey },
        review: { component: Review }
      }
    : {
        start: { component: Start },
        details: { component: Details },
        review: { component: Review }
      },
  transitions: includeSurvey
    ? [
        { from: "start", event: "goToNextStep", to: "details" },
        { from: "details", event: "goToNextStep", to: "survey" },
        { from: "survey", event: "goToNextStep", to: "review" },
        { from: "review", event: "completeJourney" }
      ]
    : [
        { from: "start", event: "goToNextStep", to: "details" },
        { from: "details", event: "goToNextStep", to: "review" },
        { from: "review", event: "completeJourney" }
      ]
});

const bindings = createJourneyBindings(buildJourney(false));

export const DynamicStepsExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;
  const [includeSurvey, setIncludeSurvey] = React.useState(false);

  const journey = React.useMemo(() => buildJourney(includeSurvey), [includeSurvey]);

  return (
    <div>
      <button onClick={() => setIncludeSurvey((value) => !value)}>
        {includeSurvey ? "Remove survey step" : "Add survey step"}
      </button>
      <p>
        Dynamic step is {includeSurvey ? "enabled" : "disabled"}. Toggling rebuilds the journey
        graph; if you want a reset, pass resetOnJourneyChange or remount the provider.
      </p>
      <Provider journey={journey}>
        <StepRenderer />
      </Provider>
    </div>
  );
};

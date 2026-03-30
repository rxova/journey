import React from "react";

import { createJourney } from "@rxova/journey-react";
import { buildDynamicStepsJourney } from "../../core/examples/dynamic-steps.flow";

export const DynamicStepsExample = () => {
  const [includeSurvey, setIncludeSurvey] = React.useState(false);
  const journey = React.useMemo(
    () => createJourney(buildDynamicStepsJourney(includeSurvey)),
    [includeSurvey]
  );

  React.useEffect(() => {
    return () => {
      journey.dispose();
    };
  }, [journey]);

  const Start = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.goToNextStep()}>Start</button>;
  };

  const Details = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.goToNextStep()}>Continue</button>;
  };

  const Survey = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.goToNextStep()}>Finish survey</button>;
  };

  const Review = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.completeJourney()}>Submit</button>;
  };

  const views = {
    start: Start,
    details: Details,
    survey: Survey,
    review: Review
  };

  return (
    <div>
      <button onClick={() => setIncludeSurvey((value) => !value)}>
        {includeSurvey ? "Remove survey step" : "Add survey step"}
      </button>
      <p>
        Dynamic step is {includeSurvey ? "enabled" : "disabled"}. Toggling swaps in a rebuilt
        machine with a different graph, so state resets with the new definition.
      </p>
      <journey.JourneyProvider views={views}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    </div>
  );
};

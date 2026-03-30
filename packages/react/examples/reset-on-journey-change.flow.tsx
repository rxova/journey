import React from "react";

import { createJourney } from "@rxova/journey-react";
import { buildResetJourney } from "../../core/examples/reset-on-journey-change.flow";

export const ResetOnJourneyChangeExample = () => {
  const [variant, setVariant] = React.useState<"A" | "B">("A");
  const journey = React.useMemo(
    () =>
      createJourney(
        variant === "A"
          ? buildResetJourney("Variant A", "start")
          : buildResetJourney("Variant B", "review")
      ),
    [variant]
  );

  React.useEffect(() => {
    return () => {
      journey.dispose();
    };
  }, [journey]);

  const Start = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.goToNextStep()}>Next</button>;
  };

  const Review = () => {
    const api = journey.useJourneyApi();
    return <button onClick={() => api.completeJourney()}>Submit</button>;
  };

  const views = {
    start: Start,
    review: Review
  };

  return (
    <div>
      <button onClick={() => setVariant((value) => (value === "A" ? "B" : "A"))}>
        Switch to {variant === "A" ? "Variant B" : "Variant A"}
      </button>
      <p>
        This swaps between two machine instances, so changing variants intentionally resets state to
        the new machine's initial snapshot.
      </p>
      <journey.JourneyProvider views={views}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    </div>
  );
};

import { createJourney } from "@rxova/journey-react";
import { confirmExitJourney } from "../../core/examples/confirm-close.flow";

export { confirmExitJourney } from "../../core/examples/confirm-close.flow";

const journey = createJourney(confirmExitJourney);

const Edit = () => {
  const snapshot = journey.useJourneySnapshot();
  const api = journey.useJourneyApi();
  return (
    <div>
      <button onClick={() => api.updateContext((ctx) => ({ ...ctx, dirty: true }))}>
        Make dirty
      </button>
      <button
        onClick={() =>
          snapshot.context.dirty ? api.send({ type: "requestClose" }) : api.terminateJourney()
        }
      >
        Close
      </button>
    </div>
  );
};

const ConfirmExit = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Confirm close</button>;
};
const views = {
  edit: Edit,
  confirmExit: ConfirmExit
};

export const ConfirmExitExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};

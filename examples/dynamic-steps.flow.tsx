import React from "react";

import { FLOW_TERMINAL, type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = string;
type Ctx = { includeSurvey: boolean };

const Start = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Start</button>;
};

const Details = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const Survey = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Finish survey</button>;
};

const Review = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Submit</button>;
};

const buildFlow = (includeSurvey: boolean): FlowReactFlow<Ctx, StepId> => ({
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
        { from: "start", event: "next", to: "details" },
        { from: "details", event: "next", to: "survey" },
        { from: "survey", event: "next", to: "review" },
        { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
      ]
    : [
        { from: "start", event: "next", to: "details" },
        { from: "details", event: "next", to: "review" },
        { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
      ]
});

export const DynamicStepsExample = () => {
  const [includeSurvey, setIncludeSurvey] = React.useState(false);

  const flow = React.useMemo(() => buildFlow(includeSurvey), [includeSurvey]);

  return (
    <div>
      <button onClick={() => setIncludeSurvey((value) => !value)}>
        {includeSurvey ? "Remove survey step" : "Add survey step"}
      </button>
      <p>
        Dynamic step is {includeSurvey ? "enabled" : "disabled"}. Toggling rebuilds the flow graph
        and remounts the provider.
      </p>
      <FlowProvider flow={flow}>
        <FlowStepRenderer<Ctx, StepId> />
      </FlowProvider>
    </div>
  );
};

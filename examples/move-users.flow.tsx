import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

type StepId = "invitees" | "preferences" | "budget";
type Event = "next" | "back" | "close" | "submit";
type MoveScenario = "regular" | "needsWarning";

type MoveUsersContext = {
  selectedUsers: string[];
  scenario: MoveScenario;
  targetGroupId: string | null;
  dirty: boolean;
};

const SelectTargetGroup = () => {
  const { api } = useFlow<MoveUsersContext, StepId, Event>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const WarningModal = () => {
  const { api } = useFlow<MoveUsersContext, StepId, Event>();
  return <button onClick={() => api.next()}>Acknowledge</button>;
};

const ArrangeMove = () => {
  const { api } = useFlow<MoveUsersContext, StepId, Event>();
  return <button onClick={() => api.submit()}>Move users</button>;
};

export const moveUsersFlow: FlowReactFlow<MoveUsersContext, StepId, Event> = {
  initial: "invitees",
  context: {
    selectedUsers: [],
    scenario: "regular",
    targetGroupId: null,
    dirty: false
  },
  steps: {
    invitees: { component: SelectTargetGroup },
    preferences: { component: WarningModal },
    budget: { component: ArrangeMove }
  },
  transitions: [
    {
      from: "invitees",
      event: "next",
      to: "preferences",
      when: ({ context }) => context.scenario === "needsWarning"
    },
    {
      from: "invitees",
      event: "next",
      to: "budget",
      when: ({ context }) => context.scenario !== "needsWarning"
    },
    { from: "preferences", event: "next", to: "budget" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "budget", event: "submit", to: FLOW_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: FLOW_TERMINAL.CLOSE }
  ]
};

export const MoveUsersExample = () => (
  <FlowProvider flow={moveUsersFlow}>
    <FlowStepRenderer<MoveUsersContext, StepId, Event> />
  </FlowProvider>
);

import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

type StepId = "selectTargetGroup" | "warningModal" | "arrangeMove";
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
  initial: "selectTargetGroup",
  context: {
    selectedUsers: [],
    scenario: "regular",
    targetGroupId: null,
    dirty: false
  },
  steps: {
    selectTargetGroup: { component: SelectTargetGroup },
    warningModal: { component: WarningModal },
    arrangeMove: { component: ArrangeMove }
  },
  transitions: [
    {
      from: "selectTargetGroup",
      event: "next",
      to: "warningModal",
      when: ({ context }) => context.scenario === "needsWarning"
    },
    {
      from: "selectTargetGroup",
      event: "next",
      to: "arrangeMove",
      when: ({ context }) => context.scenario !== "needsWarning"
    },
    { from: "warningModal", event: "next", to: "arrangeMove" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "arrangeMove", event: "submit", to: FLOW_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: FLOW_TERMINAL.CLOSE }
  ]
};

export const MoveUsersExample = () => (
  <FlowProvider flow={moveUsersFlow}>
    <FlowStepRenderer<MoveUsersContext, StepId, Event> />
  </FlowProvider>
);

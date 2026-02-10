import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "selectTargetGroup" | "warningModal" | "arrangeMove";
type Event = "next" | "back" | "close" | "submit";
type MoveScenario = "regular" | "needsWarning";

type MoveUsersContext = {
  selectedUsers: string[];
  scenario: MoveScenario;
  targetGroupId: string | null;
  dirty: boolean;
};

export const moveUsersJourney: JourneyDefinition<MoveUsersContext, StepId, Event> = {
  initial: "selectTargetGroup",
  context: {
    selectedUsers: [],
    scenario: "regular",
    targetGroupId: null,
    dirty: false
  },
  steps: {
    selectTargetGroup: {},
    warningModal: {},
    arrangeMove: {}
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
    { from: "arrangeMove", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const createMoveUsersMachine = () =>
  createJourneyMachine<MoveUsersContext, StepId, Event>(moveUsersJourney);

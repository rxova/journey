import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type Ctx = { submitted: boolean };
type StepId = "start" | "review" | "done";

export const subscribeJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "start",
  context: { submitted: false },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: {
      goToNextStep: [
        {
          to: "done",
          updateContext: ({ context }) => ({ ...context, submitted: true })
        }
      ]
    },
    done: { completeJourney: [{}] }
  }
};

export const createSubscribeExampleMachine = () =>
  createJourneyMachine<Ctx, StepId>(subscribeJourney);

export const runSubscribeExample = async () => {
  const machine = createSubscribeExampleMachine();

  let snapshotNotificationCount = 0;
  const observedEventTypes: string[] = [];

  const unsubscribeSnapshot = machine.subscribe(() => {
    snapshotNotificationCount += 1;
    const snapshot = machine.getSnapshot();
    console.log("snapshot changed:", snapshot.currentStepId, snapshot.status);
  });

  const unsubscribeEvents = machine.subscribeEvent((event) => {
    observedEventTypes.push(event.type);
    console.log("event emitted:", event.type);
  });

  await machine.send({ type: "goToNextStep" });
  await machine.send({ type: "goToNextStep" });
  await machine.send({ type: "completeJourney" });

  unsubscribeSnapshot();
  unsubscribeEvents();

  return {
    finalSnapshot: machine.getSnapshot(),
    snapshotNotificationCount,
    observedEventTypes
  };
};

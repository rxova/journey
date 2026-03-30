import { createPersistenceController } from "./controller";

import type {
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyPersistenceOptions
} from "../../types";

/**
 * Creates a machine plugin that hydrates snapshots from storage and persists
 * state changes without pulling persistence code into the base entrypoint.
 */
export const createPersistencePlugin = <TContext extends JourneyJsonObject, TStepId extends string>(
  options: JourneyPersistenceOptions<TContext, TStepId>
) => {
  const setup = (({ resolvedJourney }) => {
    const controller = createPersistenceController({
      initial: resolvedJourney.initial as unknown as TStepId,
      context: resolvedJourney.context as unknown as TContext,
      steps: resolvedJourney.steps as unknown as Record<TStepId, unknown>,
      options
    });

    return {
      hydrateSnapshot: (snapshot) => controller.hydrateSnapshot(snapshot as never),
      onSnapshotChange: ({ snapshot, reason }) => {
        if (reason === "async") {
          return;
        }

        if (reason === "reset" && controller.clearOnReset) {
          controller.removePersistedSnapshot();
          return;
        }

        controller.persistSnapshot(snapshot as never);
      }
    };
  }) as JourneyMachinePlugin["setup"];

  return {
    name: "persistence",
    setup
  } satisfies JourneyMachinePlugin;
};

export { createPersistenceController };
export type { JourneyPersistedState, JourneyPersistenceOptions, JourneyStorage } from "../../types";

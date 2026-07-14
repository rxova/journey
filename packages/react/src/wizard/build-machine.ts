import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

import type {
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneySnapshotStateBase,
  LinearJourneyDefinition,
  LinearJourneyMachine
} from "@rxova/journey-core";
import type { DerivedWizardStep } from "./derive-steps";
import type { WizardPersistProp } from "./types";

export type WizardMachineConfig = {
  context: JourneyJsonObject;
  initial?: string | undefined;
  startIndex?: number | undefined;
  persist?: WizardPersistProp | undefined;
  plugins?: readonly JourneyMachinePlugin[] | undefined;
  handlers?: Record<string, unknown> | undefined;
  requireExplicitCompletion?: boolean | undefined;
};

export const buildLinearDefinition = (
  steps: readonly DerivedWizardStep[],
  context: JourneyJsonObject,
  initial?: string,
  startIndex?: number
): LinearJourneyDefinition<JourneyJsonObject, string> => {
  if (steps.length === 0) {
    throw new Error("<Wizard> needs at least one step.");
  }

  return {
    context,
    ...(initial !== undefined ? { initial } : {}),
    ...(startIndex !== undefined ? { startIndex } : {}),
    steps: steps.map((step) => ({
      id: step.id,
      ...step.config
    })) as unknown as LinearJourneyDefinition<JourneyJsonObject, string>["steps"]
  };
};

const buildPersistPlugin = (persist: WizardPersistProp): JourneyMachinePlugin =>
  createPersistencePlugin<JourneyJsonObject, string>({
    key: persist.key,
    ...(persist.storage !== undefined ? { storage: persist.storage } : {}),
    ...(persist.version !== undefined ? { version: persist.version } : {}),
    ...(persist.migrate !== undefined ? { migrate: persist.migrate } : {})
  });

/**
 * Thin shell over core `createLinearJourney`: builds the definition from the
 * derived steps and expands the `persist` sugar. All linear semantics — start
 * position, visits, transplant hydration, interceptors — live in the core
 * linear runtime.
 */
export const createWizardMachine = (
  steps: readonly DerivedWizardStep[],
  config: WizardMachineConfig,
  initialSnapshot?: JourneySnapshotStateBase<JourneyJsonObject, string>
): LinearJourneyMachine<JourneyJsonObject, string> => {
  const definition = buildLinearDefinition(
    steps,
    config.context,
    config.initial,
    config.startIndex
  );
  const options: JourneyMachineOptions<readonly JourneyMachinePlugin[]> = {
    ...(config.requireExplicitCompletion !== undefined
      ? { requireExplicitCompletion: config.requireExplicitCompletion }
      : {}),
    ...(config.handlers !== undefined ? { handlers: config.handlers } : {}),
    plugins: [
      ...(config.persist ? [buildPersistPlugin(config.persist)] : []),
      ...(config.plugins ?? [])
    ],
    ...(initialSnapshot !== undefined ? { initialSnapshot } : {})
  };

  return createLinearJourney<JourneyJsonObject, string>(
    definition,
    options as never
  ) as LinearJourneyMachine<JourneyJsonObject, string>;
};

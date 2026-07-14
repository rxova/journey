import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { warnInDevelopment } from "@rxova/journey-common/dev";

import type {
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneySnapshotStateBase,
  LinearJourneyDefinition,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type { DerivedWizardStep } from "./derive-steps";
import type { WizardPersistProp } from "./types";

export type WizardMachineConfig = {
  context: JourneyJsonObject;
  persist?: WizardPersistProp | undefined;
  plugins?: readonly JourneyMachinePlugin[] | undefined;
  handlers?: Record<string, unknown> | undefined;
  requireExplicitCompletion?: boolean | undefined;
};

export const buildLinearDefinition = (
  steps: readonly DerivedWizardStep[],
  context: JourneyJsonObject
): LinearJourneyDefinition<JourneyJsonObject, string> => {
  if (steps.length === 0) {
    throw new Error("<Wizard> needs at least one step.");
  }

  return {
    context,
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

export const createWizardMachine = (
  steps: readonly DerivedWizardStep[],
  config: WizardMachineConfig,
  initialSnapshot?: JourneySnapshotStateBase<JourneyJsonObject, string>
): LinearJourneyMachine<JourneyJsonObject, string> => {
  const definition = buildLinearDefinition(steps, config.context);
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

/** Builds the initialSnapshot for a `startIndex`/`startStepId` start position. */
export const buildStartSnapshot = (
  steps: readonly DerivedWizardStep[],
  context: JourneyJsonObject,
  startStepId: string | undefined,
  startIndex: number | undefined
): JourneySnapshotStateBase<JourneyJsonObject, string> | undefined => {
  if (startStepId === undefined && (startIndex === undefined || startIndex === 0)) {
    return undefined;
  }

  let startId: string | undefined;
  if (startStepId !== undefined) {
    if (!steps.some((step) => step.id === startStepId)) {
      throw new Error(`<Wizard> startStepId "${startStepId}" does not match any step id.`);
    }
    startId = startStepId;
  } else if (startIndex !== undefined) {
    const step = steps[startIndex];
    if (!step) {
      throw new Error(
        `<Wizard> startIndex ${startIndex} is out of range (0..${steps.length - 1}).`
      );
    }
    startId = step.id;
  }

  if (startId === undefined) {
    return undefined;
  }

  return {
    currentStepId: startId,
    history: { timeline: [startId], index: 0 },
    context,
    visited: { [startId]: true },
    status: "idled"
  };
};

/**
 * Builds the transplant snapshot when the derived step list changes while the
 * wizard is mounted: context carries over verbatim, timeline/visited are
 * filtered to surviving ids, the index is clamped, and the active id stays
 * active when it survived (else the nearest surviving index, with a dev
 * warning). Returns undefined when nothing survives — the new machine starts
 * fresh (context still carried by the definition).
 */
export const buildTransplantSnapshot = (
  previous: LinearJourneySnapshot<JourneyJsonObject, string>,
  nextSteps: readonly DerivedWizardStep[]
): JourneySnapshotStateBase<JourneyJsonObject, string> | undefined => {
  const surviving = new Set(nextSteps.map((step) => step.id));
  const timeline = previous.history.timeline.filter((stepId) => surviving.has(stepId));

  if (timeline.length === 0) {
    return undefined;
  }

  let index: number;
  if (surviving.has(previous.currentStepId)) {
    index = timeline.lastIndexOf(previous.currentStepId);
  } else {
    index = Math.min(previous.history.index, timeline.length - 1);
    warnInDevelopment(
      `<Wizard> active step "${previous.currentStepId}" was removed by a dynamic step change; ` +
        `falling back to "${timeline[index]}".`
    );
  }

  const visited = Object.fromEntries(
    nextSteps.map((step) => [step.id, previous.visited[step.id] === true])
  );

  return {
    currentStepId: timeline[index] as string,
    history: { timeline, index },
    context: previous.context,
    visited,
    status: previous.status
  };
};

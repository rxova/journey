import { createJourneyMachine } from "./journey-machine";
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyStepDefinition,
  LinearJourneyDefinition,
  LinearJourneyMachine
} from "./types";
import type { JourneyEmpty } from "./types";

/** Creates a linear journey machine from an ordered steps array. Steps are traversed sequentially; `goToNextStep` advances through them in order. */
export function createLinearJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins> {
  const stepOrder = def.steps.map((s) =>
    typeof s === "string" ? (s as TStepId) : (s as { id: TStepId }).id
  );

  const stepsRecord = Object.fromEntries(
    def.steps.map((s) => {
      if (typeof s === "string") {
        return [s, {}];
      }
      const { id, meta, onEnter, onLeave, effect, after } = s as {
        id: TStepId;
        meta?: TStepMeta;
        onEnter?: unknown;
        onLeave?: unknown;
        effect?: unknown;
        after?: unknown;
      };
      return [id, { meta, onEnter, onLeave, effect, after }];
    })
  ) as Record<
    TStepId,
    JourneyStepDefinition<TContext, TStepId, JourneyEmpty, TStepMeta, THandlers>
  >;

  const internalDef: JourneyDefinition<TContext, TStepId, JourneyEmpty, TStepMeta, THandlers> = {
    context: def.context,
    ...(def.handlers !== undefined ? { handlers: def.handlers } : {}),
    steps: stepsRecord,
    transitions: stepOrder as unknown as readonly [TStepId, ...TStepId[]]
  };

  const machine = createJourneyMachine<
    TContext,
    TStepId,
    JourneyEmpty,
    TStepMeta,
    THandlers,
    TPlugins
  >(internalDef, options);

  const goToStepByIndex = (index: number) => {
    const stepId = stepOrder[index];
    if (stepId === undefined) {
      return Promise.resolve({ transitioned: false as const, snapshot: machine.getSnapshot() });
    }
    const currentIndex = stepOrder.indexOf(machine.getSnapshot().currentStepId);
    const diff = index - currentIndex;
    if (diff === 1) return machine.goToNextStep();
    if (diff < 0) return machine.goToPreviousStep(Math.abs(diff));
    // Arbitrary forward jumps: delegate to goToStepById (succeeds if a goToStepById
    // transition is defined for this edge; otherwise returns transitioned: false).
    return machine.goToStepById(stepId);
  };

  return Object.assign(machine, { goToStepByIndex }) as LinearJourneyMachine<
    TContext,
    TStepId,
    TStepMeta,
    THandlers,
    TPlugins
  >;
}

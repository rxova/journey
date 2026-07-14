import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import type { RuntimeStep } from "../core/runtime.types";
import type {
  LinearJourneyMachine,
  LinearStepConfig,
  LinearStepIdOf,
  LinearStepInput
} from "./linear.types";
import type { AnyJourneyPlugin, JourneyRuntimeOptions } from "../core/types";

/**
 * Creates a linear journey runtime from a pure-data definition.
 *
 * Declared order drives `goToNextStep`'s fallback at the timeline tip and the
 * order-based snapshot fields (`index`, `isFirstStep`, `isLastStep`,
 * `stepOrder`). `goToNextStep` on the last step never auto-completes.
 */
export function createLinearJourney<
  TContext,
  const TSteps extends readonly LinearStepInput<TContext, TMeta>[],
  TMeta = Record<string, unknown>,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly []
>(
  definition: { readonly steps: TSteps; readonly context: TContext },
  options: JourneyRuntimeOptions<TPlugins> = {}
): LinearJourneyMachine<TContext, LinearStepIdOf<TSteps>, TMeta, TPlugins> {
  if (definition.steps.length === 0) {
    throw new Error("journey: a linear journey needs at least one step");
  }

  const stepIds: string[] = [];
  const steps: Record<string, RuntimeStep> = {};
  for (const input of definition.steps) {
    const config: LinearStepConfig<TContext, string, TMeta> =
      typeof input === "string" ? { id: input } : input;
    if (config.id in steps) {
      throw new Error(`journey: duplicate step id "${config.id}"`);
    }
    stepIds.push(config.id);
    const runtimeStep: {
      metadata: unknown;
      onEnter?: NonNullable<RuntimeStep["onEnter"]>;
      onLeave?: NonNullable<RuntimeStep["onLeave"]>;
    } = { metadata: config.metadata ?? {} };
    if (config.onEnter) {
      runtimeStep.onEnter = config.onEnter as unknown as NonNullable<RuntimeStep["onEnter"]>;
    }
    if (config.onLeave) {
      runtimeStep.onLeave = config.onLeave as unknown as NonNullable<RuntimeStep["onLeave"]>;
    }
    steps[config.id] = runtimeStep;
  }

  const runtime = new JourneyRuntime({
    kind: "linear",
    stepIds,
    steps,
    initial: stepIds[0] as string,
    initialContext: definition.context,
    transitions: [],
    handlers: undefined,
    autoStart: options.autoStart ?? false,
    defaultTimeoutMs: options.defaultTimeoutMs,
    plugins: options.plugins ?? []
  });

  return buildMachineSurface(runtime) as unknown as LinearJourneyMachine<
    TContext,
    LinearStepIdOf<TSteps>,
    TMeta,
    TPlugins
  >;
}

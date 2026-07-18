import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import { persistOptionToPlugin } from "../plugins/persistence/persistence";
import type { RuntimeStep } from "../core/runtime.types";
import type {
  CompletePayloadOf,
  JourneyTerminationPayloads,
  LinearJourneyDefinition,
  LinearJourneyMachine,
  LinearStepConfig,
  TerminatePayloadOf
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
  const TStepId extends string,
  TContext,
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly AnyJourneyPlugin[],
  TMeta = Record<string, unknown>
>(
  definition: LinearJourneyDefinition<TStepId, TContext, TTerminationPayloads, TMeta>,
  options: JourneyRuntimeOptions<TPlugins, NoInfer<TStepId>> = {}
): LinearJourneyMachine<
  TContext,
  TStepId,
  TMeta,
  TPlugins,
  CompletePayloadOf<TTerminationPayloads>,
  TerminatePayloadOf<TTerminationPayloads>
> {
  if (definition.steps.length === 0) {
    throw new Error("journey: a linear journey needs at least one step");
  }

  const stepIds: string[] = [];
  const steps: Record<string, RuntimeStep> = {};
  for (const input of definition.steps) {
    const config: LinearStepConfig<
      TContext,
      TStepId,
      TMeta,
      CompletePayloadOf<TTerminationPayloads>,
      TerminatePayloadOf<TTerminationPayloads>
    > = typeof input === "string" ? { id: input } : input;
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

  if (options.startAt !== undefined && !(options.startAt in steps)) {
    throw new Error(`journey: startAt references unknown step "${options.startAt}"`);
  }

  const runtime = new JourneyRuntime({
    kind: "linear",
    stepIds,
    steps,
    initial: stepIds[0] as string,
    ...(options.startAt !== undefined ? { startAt: options.startAt } : {}),
    initialContext: definition.context,
    transitions: [],
    handlers: undefined,
    autoStart: options.autoStart ?? false,
    defaultTimeoutMs: options.defaultTimeoutMs,
    plugins: [
      ...(options.persist ? [persistOptionToPlugin(options.persist)] : []),
      ...(options.plugins ?? [])
    ]
  });

  return buildMachineSurface(runtime) as unknown as LinearJourneyMachine<
    TContext,
    TStepId,
    TMeta,
    TPlugins,
    CompletePayloadOf<TTerminationPayloads>,
    TerminatePayloadOf<TTerminationPayloads>
  >;
}

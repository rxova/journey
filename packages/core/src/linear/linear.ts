import { JourneyError } from "../core/errors";
import { hasOwn } from "../core/helpers";
import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import { persistOptionToPlugin } from "../plugins/persistence/persistence";
import { readRestorableState } from "../plugins/persistence/persistence.helpers";
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
import type { Bag, MetaOf } from "../graph/bag.types";

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
  // Defaults to the empty tuple, matching createGraphJourney. Defaulting to
  // `readonly AnyJourneyPlugin[]` collapsed PluginApis to `{ [x: string]: never }`
  // — an index signature that accepts any key — so `machine.plugins.typo`
  // compiled clean whenever plugins were omitted or the first generics were
  // supplied explicitly.
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
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
    throw new JourneyError("empty-definition", "a linear journey needs at least one step");
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
    if (hasOwn(steps, config.id)) {
      throw new JourneyError("duplicate-step-id", `duplicate step id "${config.id}"`, {
        stepId: config.id
      });
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

  if (options.startAt !== undefined && !hasOwn(steps, options.startAt)) {
    throw new JourneyError("unknown-step", `startAt references unknown step "${options.startAt}"`, {
      stepId: options.startAt
    });
  }

  // Explicit `startAt` wins over a persisted record; restore is best-effort.
  const restored =
    options.persist && options.startAt === undefined
      ? readRestorableState(options.persist, (id) => hasOwn(steps, id))
      : null;

  const runtime = new JourneyRuntime({
    kind: "linear",
    stepIds,
    steps,
    initial: stepIds[0] as string,
    ...(options.startAt !== undefined ? { startAt: options.startAt } : {}),
    initialContext: definition.context,
    ...(restored
      ? {
          restore: {
            context: restored.context,
            timeline: restored.timeline,
            currentIndex: restored.currentIndex
          }
        }
      : {}),
    transitions: [],
    handlers: undefined,
    autoStart: options.autoStart ?? false,
    defaultTimeoutMs: options.defaultTimeoutMs,
    ...(options.onListenerError !== undefined ? { onListenerError: options.onListenerError } : {}),
    plugins: [
      ...(options.persist ? [persistOptionToPlugin(options.persist)] : []),
      ...(options.plugins ?? [])
    ]
  });

  const surface = buildMachineSurface(runtime);
  return {
    ...surface,
    navigate: {
      ...surface.navigate,
      goToStepByIndex: (index: number) => runtime.goToStepByIndex(index)
    }
  } as unknown as LinearJourneyMachine<
    TContext,
    TStepId,
    TMeta,
    TPlugins,
    CompletePayloadOf<TTerminationPayloads>,
    TerminatePayloadOf<TTerminationPayloads>
  >;
}

/**
 * Returns a `createLinearJourney` with its types pinned up front instead of
 * inferred.
 *
 * The linear tier infers almost everything from the definition already — step
 * ids from the `steps` tuple, context from its value — so reach for this only
 * to pin a `meta` shape, or to share one bag with steps authored in separate
 * files.
 *
 * A standalone export rather than a property on the factory: attaching one
 * would be a module-level side effect, and that defeats tree-shaking badly
 * enough that importing only `createLinearJourney` pulled the whole graph tier
 * into the bundle.
 *
 * ```ts
 * const checkout = withLinearTypes<CheckoutBag>()({
 *   steps: ["account", "shipping", "review"],
 *   context: initialContext
 * });
 * ```
 */
export const withLinearTypes =
  <TBag extends Bag>() =>
  <const TPlugins extends readonly AnyJourneyPlugin[] = readonly []>(
    definition: LinearJourneyDefinition<
      TBag["stepId"],
      TBag["context"],
      JourneyTerminationPayloads,
      MetaOf<TBag>
    >,
    options: JourneyRuntimeOptions<TPlugins, TBag["stepId"]> = {}
  ): LinearJourneyMachine<TBag["context"], TBag["stepId"], MetaOf<TBag>, TPlugins> =>
    createLinearJourney(definition, options) as unknown as LinearJourneyMachine<
      TBag["context"],
      TBag["stepId"],
      MetaOf<TBag>,
      TPlugins
    >;

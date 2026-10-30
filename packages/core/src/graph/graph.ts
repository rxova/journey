import { JourneyError } from "../core/errors";
import { hasOwn } from "../core/helpers";
import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import { persistOptionToPlugin } from "../plugins/persistence/persistence";
import { readRestorableState } from "../plugins/persistence/persistence.helpers";
import { ensureCompiled, runtimeOf } from "./compile";
import type { CompiledGraph } from "./compile";
import type { GraphDefinitionInput, GraphJourneyMachine, GraphJourneyOptions } from "./graph.types";
import type { Bag, GraphDefinition, HandlersOf, MetaOf } from "./bag.types";
import type {
  AnyJourneyPlugin,
  CompletePayloadOf,
  JourneyEventObject,
  JourneyTerminationPayloads,
  TerminatePayloadOf,
} from "../core/types";

/**
 * Creates a graph journey runtime from a pure-data definition.
 *
 * `send(event, payload?)` is the primary verb; `goToStepById` is
 * transition-gated sugar (fires only if an enabled transition targets that
 * id). Timeline moves bypass transition gating — retracing a walked path is
 * always legal. Step `onLeave` effects still run after those moves commit.
 */
export function createGraphJourney<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads,
>(
  // A union, not an overload pair: `Parameters<typeof createGraphJourney>[0]`
  // is read by `withGraphTypes` here and in the React package, and that
  // resolves to the last overload only. The literal shape comes first so
  // error elaboration still lands on the definition the caller wrote.
  definition:
    | GraphDefinitionInput<TContext, TStepId, TEvents, THandlers, TMeta, TTerminationPayloads>
    | CompiledGraph<TContext, TStepId, TEvents, THandlers, TMeta, TTerminationPayloads>,
  options: GraphJourneyOptions<NoInfer<THandlers>, TPlugins, NoInfer<TStepId>> = {},
  // THandlers is load-bearing: it types `handlers` inside send work, which is
  // the only channel injected clients reach. Omitting it here let the
  // annotation win over the cast below and erased it to `unknown`.
): GraphJourneyMachine<
  TContext,
  TStepId,
  TEvents,
  TMeta,
  TPlugins,
  CompletePayloadOf<TTerminationPayloads>,
  TerminatePayloadOf<TTerminationPayloads>
> {
  const { stepIds, steps, transitions, eventWork, initial, context, handlers } = runtimeOf(
    ensureCompiled(definition),
  );

  if (options.startAt !== undefined && !hasOwn(steps, options.startAt)) {
    throw new JourneyError("unknown-step", `startAt references unknown step "${options.startAt}"`, {
      stepId: options.startAt,
    });
  }

  // Explicit `startAt` wins over a persisted record; restore is best-effort.
  const restored =
    options.persist && options.startAt === undefined
      ? readRestorableState(options.persist, (id) => hasOwn(steps, id))
      : null;

  const runtime = new JourneyRuntime({
    kind: "graph",
    stepIds,
    steps,
    initial,
    ...(options.startAt !== undefined ? { startAt: options.startAt } : {}),
    initialContext: context,
    ...(restored
      ? {
          restore: {
            context: restored.context,
            timeline: restored.timeline,
            currentIndex: restored.currentIndex,
          },
        }
      : {}),
    transitions,
    ...(Object.keys(eventWork).length > 0 ? { eventWork } : {}),
    handlers: options.handlers ?? handlers,
    autoStart: options.autoStart ?? true,
    defaultTimeoutMs: options.defaultTimeoutMs,
    ...(options.onListenerError !== undefined ? { onListenerError: options.onListenerError } : {}),
    plugins: [
      ...(options.persist ? [persistOptionToPlugin(options.persist)] : []),
      ...(options.plugins ?? []),
    ],
  });

  const machine = {
    ...buildMachineSurface(runtime),
    send: (type: string, payload?: unknown) => runtime.send(type, payload),
  };
  return machine as unknown as GraphJourneyMachine<
    TContext,
    TStepId,
    TEvents,
    TMeta,
    TPlugins,
    CompletePayloadOf<TTerminationPayloads>,
    TerminatePayloadOf<TTerminationPayloads>
  >;
}

/**
 * Creates a graph journey factory with its types pinned up front instead of
 * inferred.
 *
 * Reach for it when the definition cannot supply a type on its own —
 * `handlers`, a `meta` shape, or a `run` result, none of which sit at an
 * inference site — or when the same bag is shared by steps authored in
 * separate files. The definition is then *checked* against the bag rather than
 * read for types.
 *
 * ```ts
 * const login = withGraphTypes<AuthBag>()({
 *   initial: "login",
 *   context: initialContext,
 *   steps: { login: { on: { submit: "twofa" } }, twofa: {} }
 * });
 * ```
 *
 * Plain `createGraphJourney(definition)` stays the default: step ids infer from
 * the `steps` keys and event names from the `on` keys.
 */
export const withGraphTypes =
  <TBag extends Bag>() =>
  <const TPlugins extends readonly AnyJourneyPlugin[] = readonly []>(
    definition: GraphDefinition<TBag>,
    options: GraphJourneyOptions<HandlersOf<TBag>, TPlugins, TBag["stepId"]> = {},
  ): GraphJourneyMachine<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>, TPlugins> =>
    createGraphJourney(
      definition as unknown as Parameters<typeof createGraphJourney>[0],
      options as unknown as Parameters<typeof createGraphJourney>[1],
    ) as unknown as GraphJourneyMachine<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      MetaOf<TBag>,
      TPlugins
    >;

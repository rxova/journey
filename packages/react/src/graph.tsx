import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import { createAutoStartHook, createJourneyBindings } from "./react.helpers";
import type { Bag, HandlersOf, MetaOf } from "@rxova/journey-core";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphSnapshot,
  JourneyEventObject
} from "@rxova/journey-core";
import type { GraphJourneyBundle, ReactGraphDefinition, ReactGraphStepConfig } from "./react.types";

export type {
  GraphJourneyBundle,
  JourneyProviderProps,
  JourneyStepRendererProps,
  JourneyViews,
  ReactGraphDefinition,
  ReactGraphStep,
  ReactGraphStepConfig
} from "./react.types";

/**
 * Creates a graph journey bundle for React around **one standalone machine**,
 * created right here in the factory. The machine outlives any component:
 * every hook closes over it and works with or without the Provider, non-React
 * code drives it via `bundle.machine` / `bundle.send` / `bundle.updateContext`,
 * and unmounting disposes nothing. The Provider only hands `views` to
 * `<StepRenderer>` — which renders the active step wherever you place it, so
 * headers and footers are ordinary siblings:
 *
 * ```tsx
 * const checkout = createGraphJourney({ steps, transitions, initial: "cart", context });
 *
 * <checkout.Provider views={{ cart: <Cart />, shipping: <Shipping /> }}>
 *   <ProgressHeader />
 *   <checkout.StepRenderer fallback={<Spinner />} />
 *   <Footer />
 * </checkout.Provider>;
 *
 * checkout.send("SUBMIT");            // from anywhere
 * const step = checkout.useStep();    // from any component
 * ```
 *
 * Consequences of the standalone machine: all Providers and hooks share the
 * one machine, journey state survives remounts (reset explicitly —
 * `controls.restart()` after a terminal status, `terminate()` first when
 * mid-flight), and in SSR a module-scope machine is shared across every
 * request in the process — for per-mount or per-request isolation, wrap the
 * factory in `useJourney()`, which owns and disposes one bundle per component
 * instance.
 *
 * By default the machine starts when the first Provider or hook mounts, so
 * subscribers attach before the journey's first `stepEnter` and SSR renders
 * `fallback` on both sides. Pass `{ autoStart: true }` to start eagerly here
 * instead — needed for server-rendered step content, and for a bundle driven
 * entirely from non-React code, since nothing mounts to start it. Pass
 * `{ autoStart: false }` to start it yourself with `controls.start()`.
 */
export function createGraphJourney<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly []
>(
  definition: {
    readonly steps: Readonly<
      Record<
        TStepId,
        ReactGraphStepConfig<
          NoInfer<TContext>,
          NoInfer<TStepId>,
          NoInfer<TEvents>,
          TMeta,
          NoInfer<THandlers>
        >
      >
    >;
    readonly initial: NoInfer<TStepId>;
    readonly context: TContext;
    readonly handlers?: THandlers;
    readonly $events?: TEvents;
    /** Optional bundle name, used for the React DevTools display names. */
    readonly name?: string;
  },
  options?: GraphJourneyOptions<NoInfer<THandlers>, TPlugins, NoInfer<TStepId>>
): GraphJourneyBundle<TContext, TStepId, TEvents, TMeta, TPlugins> {
  type Machine = GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
  type Snapshot = GraphSnapshot<TContext, TStepId, TMeta, TEvents>;

  const { name, ...coreDefinition } = definition;
  // Three-way autoStart — see the note in create-linear-journey.tsx.
  const machine: Machine = coreCreateGraphJourney(coreDefinition, {
    ...options,
    autoStart: options?.autoStart === true
  });

  return {
    ...createJourneyBindings<Machine, TContext, TStepId, Snapshot>(
      machine,
      name ?? "GraphJourney",
      createAutoStartHook(machine, options?.autoStart === undefined)
    ),
    send: machine.send
  };
}

/**
 * Creates a graph journey bundle with its types pinned up front instead of
 * inferred — the React twin of `createGraphJourney.withTypes` in Core.
 *
 * Needed whenever the definition is authored separately (steps in their own
 * files, or a `satisfies GraphDefinition<Bag>` literal reused across call
 * sites): the event union then sits at no inference site, so the factory
 * cannot read it off the definition and must be told.
 *
 * ```ts
 * export const journey = withGraphTypes<AuthBag>()(definition);
 * ```
 */
export const withGraphTypes =
  <TBag extends Bag>() =>
  <const TPlugins extends readonly AnyJourneyPlugin[] = readonly []>(
    definition: ReactGraphDefinition<TBag> & { readonly name?: string },
    options?: GraphJourneyOptions<HandlersOf<TBag>, TPlugins, TBag["stepId"]>
  ): GraphJourneyBundle<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>, TPlugins> =>
    createGraphJourney(
      definition as unknown as Parameters<typeof createGraphJourney>[0],
      options as unknown as Parameters<typeof createGraphJourney>[1]
    ) as unknown as GraphJourneyBundle<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      MetaOf<TBag>,
      TPlugins
    >;

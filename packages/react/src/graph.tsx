import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import { createAutoStartHook, createJourneyBindings } from "./react.helpers";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphSnapshot,
  GraphStepConfig,
  GraphTransitionsMap,
  JourneyEventObject
} from "@rxova/journey-core";
import type { GraphJourneyBundle } from "./react.types";

export type {
  GraphJourneyBundle,
  JourneyProviderProps,
  JourneyStepRendererProps,
  JourneyViews
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
 * mid-flight), and in SSR a module-scope machine is shared across requests —
 * for per-mount or per-request isolation, create the bundle inside a
 * component with a `useState` lazy initializer (the reference must stay
 * stable for the component's lifetime), or own a core machine yourself and
 * read it with `React.useSyncExternalStore`. `autoStart` defaults to `true`
 * here (the React-tier default); pass `{ autoStart: false }` and call
 * `bundle.machine.controls.start()` to defer the initial entry.
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
      Record<TStepId, GraphStepConfig<NoInfer<TContext>, NoInfer<TStepId>, NoInfer<TEvents>, TMeta>>
    >;
    readonly transitions: GraphTransitionsMap<
      NoInfer<TContext>,
      NoInfer<TStepId>,
      NoInfer<TEvents>,
      NoInfer<THandlers>,
      NoInfer<TMeta>
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

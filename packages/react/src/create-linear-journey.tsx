import React from "react";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { createAutoStartHook, createJourneyBindings } from "./react.helpers";
import { useSafeLayoutEffect } from "./use-safe-layout-effect";
import type { AnyJourneyPlugin, LinearStepIdOf, LinearStepInput } from "@rxova/journey-core";
import type {
  LinearJourneyBundle,
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
  LinearJourneySnapshot,
  LinearJourneyStepHandler
} from "./react.types";

const stepIdOf = (step: string | { readonly id: string }): string =>
  typeof step === "string" ? step : step.id;

/**
 * Creates a linear journey bundle for React around **one standalone machine**,
 * created right here in the factory — the same shape as the graph bundle,
 * with the linear verbs. `TContext` is inferred from `definition.context`
 * (annotate the value, e.g. `const initialContext: SignupContext = {...}`),
 * the step-id union from the `steps` tuple; call sites never pass generics.
 *
 * ```tsx
 * const signup = createLinearJourney({
 *   name: "signup",
 *   context: initialContext,
 *   steps: ["email", "review", "done"]
 * });
 *
 * <signup.Provider views={{ email: <EmailStep />, review: <ReviewStep />, done: <DoneStep /> }}>
 *   <ProgressHeader />
 *   <signup.StepRenderer fallback={<Spinner />} />
 *   <Controls />
 * </signup.Provider>;
 *
 * void signup.navigate.goToNextStep();   // from anywhere
 * const step = signup.useStep();         // from any component
 * ```
 *
 * The machine outlives any component: every hook closes over it and works
 * with or without the Provider, non-React code drives it via `bundle.machine`
 * / `bundle.navigate` / `bundle.updateContext`, and unmounting disposes
 * nothing. All Providers and hooks share the one machine, journey state
 * survives remounts (reset explicitly — `controls.restart()` after a terminal
 * status, `terminate()` first when mid-flight), and in SSR a module-scope
 * machine is shared across every request in the process — for per-mount or
 * per-request isolation, wrap the factory in `useJourney()`, which owns and
 * disposes one bundle per component instance.
 *
 * By default the machine starts when the first Provider or hook mounts, so
 * subscribers attach before the journey's first `stepEnter` and SSR renders
 * `fallback` on both sides. Pass `{ autoStart: true }` to start eagerly here
 * instead — needed for server-rendered step content, and for a bundle driven
 * entirely from non-React code, since nothing mounts to start it. Pass
 * `{ autoStart: false }` to start it yourself with `controls.start()`.
 */
export const createLinearJourney = <
  TContext,
  const TSteps extends readonly [
    LinearStepInput<NoInfer<TContext>, unknown>,
    ...LinearStepInput<NoInfer<TContext>, unknown>[]
  ],
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly []
>(
  definition: LinearJourneyBundleDefinition<TContext, TSteps>,
  options?: LinearJourneyBundleOptions<LinearStepIdOf<TSteps>, TPlugins>
): LinearJourneyBundle<TContext, LinearStepIdOf<TSteps>, TPlugins> => {
  type TStepId = LinearStepIdOf<TSteps>;
  type Machine = LinearJourneyMachine<TContext, TStepId, TPlugins>;
  type Snapshot = LinearJourneySnapshot<TContext, TStepId>;

  const declaredStepIds = definition.steps.map(stepIdOf);
  if (declaredStepIds.length === 0) {
    throw new Error("createLinearJourney() needs at least one step in the definition.");
  }
  if (new Set(declaredStepIds).size !== declaredStepIds.length) {
    throw new Error(
      `createLinearJourney() step ids must be unique; received [${declaredStepIds.join(", ")}].`
    );
  }

  // The one boundary cast in this factory: core anchors its step-id union on
  // the definition generic, while this tier re-anchors inference on the steps
  // tuple (`LinearStepIdOf<TSteps>`) so `context` alone types the bundle. The
  // two derivations name the same union, but TypeScript cannot prove it
  // through the generic call, so core infers `string` and the result is
  // re-branded here.
  // Three-way autoStart in this tier: `undefined` (the default) starts the
  // machine from a layout effect on first mount, so subscribers attach before
  // the initial stepEnter; `true` keeps the eager in-factory start for callers
  // who need SSR to emit step content; `false` defers to controls.start().
  const eagerStart = options?.autoStart === true;
  const machine = coreCreateLinearJourney(
    { steps: definition.steps, context: definition.context },
    { ...options, autoStart: eagerStart }
  ) as unknown as Machine;

  const useAutoStart = createAutoStartHook(machine, options?.autoStart === undefined);

  return {
    ...createJourneyBindings<Machine, TContext, TStepId, Snapshot>(
      machine,
      definition.name ?? "LinearJourney",
      useAutoStart
    ),
    useStepHandler: <TResult = void,>(
      stepId: TStepId,
      handler: LinearJourneyStepHandler<TContext, TResult, TStepId>
    ): void => {
      // Latest-ref: inline handlers change identity every render; the
      // registration must not tear down on each one — it is per mounted caller.
      // The ref advances from an effect, never during render, so a discarded
      // render cannot leave it pointing at a closure that was never committed.
      const handlerRef = React.useRef(handler);
      useSafeLayoutEffect(() => {
        handlerRef.current = handler;
      });
      useSafeLayoutEffect(() => {
        const work: LinearJourneyStepHandler<TContext, TResult, TStepId> = {
          run: (args) => handlerRef.current.run(args),
          commit: (args) => handlerRef.current.commit?.(args)
        };
        return machine.navigate.registerNextStepInterceptor(stepId, work);
      }, [stepId]);
      // Declared last on purpose: the interceptor must be registered before the
      // start effect runs, so it can gate a navigation from the very first step.
      useAutoStart();
    },
    navigate: machine.navigate
  };
};

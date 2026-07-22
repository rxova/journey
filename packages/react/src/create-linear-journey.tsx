import React from "react";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { createJourneyBindings } from "./react.helpers";
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
 * machine is shared across requests — for per-mount or per-request isolation,
 * create the bundle inside a component with a `useState` lazy initializer
 * (the reference must stay stable for the component's lifetime), or own a
 * core machine yourself and read it with `React.useSyncExternalStore`.
 * `autoStart` defaults to `true` here (the React-tier default); pass
 * `{ autoStart: false }` and call `bundle.machine.controls.start()` to defer
 * the initial entry.
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

  const machine = coreCreateLinearJourney(
    { steps: definition.steps as never, context: definition.context as unknown },
    { ...options, autoStart: options?.autoStart ?? true }
  ) as unknown as Machine;

  return {
    ...createJourneyBindings<Machine, TContext, TStepId, Snapshot>(
      machine,
      definition.name ?? "LinearJourney"
    ),
    useStepHandler: <TResult = void,>(
      stepId: TStepId,
      handler: LinearJourneyStepHandler<TContext, TResult, TStepId>
    ): void => {
      // Latest-ref: inline handlers change identity every render; the
      // registration must not tear down on each one — it is per mounted caller.
      const handlerRef = React.useRef(handler);
      handlerRef.current = handler;
      useSafeLayoutEffect(() => {
        const work: LinearJourneyStepHandler<TContext, TResult, TStepId> = {
          run: (args) => handlerRef.current.run(args),
          commit: (args) => handlerRef.current.commit?.(args)
        };
        return machine.navigate.registerNextStepInterceptor(stepId, work as never);
      }, [stepId]);
    },
    navigate: machine.navigate
  };
};

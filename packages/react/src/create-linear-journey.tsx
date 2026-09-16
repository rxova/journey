import React from "react";
import { warnInDevelopment } from "@rxova/journey-common/dev";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { createAutoStartHook, createJourneyBindings } from "./react.helpers";
import { useSafeLayoutEffect } from "./use-safe-layout-effect";
import type { AnyJourneyPlugin, LinearStepIdOf } from "@rxova/journey-core";
/**
 * The generics-erased handler shape the registry stores. `unknown` args rather
 * than `never`: the registry is written by `useStepHandler`, which has the
 * concrete types, and read by the wrapper, which does not.
 */
type AnyStepHandler = {
  run: (args: never) => unknown;
  commit?: (args: never) => void;
};

import type {
  LinearJourneyBundle,
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
  LinearJourneySnapshot,
  LinearJourneyStepHandler,
  ReactLinearStepInput
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
    ReactLinearStepInput<NoInfer<TContext>, unknown>,
    ...ReactLinearStepInput<NoInfer<TContext>, unknown>[]
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

  // `name` is this tier's own field; everything else is core's definition and is
  // forwarded whole. Listing core's fields by hand here would silently drop any
  // field core adds later — the graph factory already destructures this way.
  const { name, ...coreDefinition } = definition;

  // The one boundary cast in this factory: core anchors its step-id union on
  // the definition generic, while this tier re-anchors inference on the steps
  // tuple (`LinearStepIdOf<TSteps>`) so `context` alone types the bundle. The
  // two derivations name the same union, but TypeScript cannot prove it
  // through the generic call, so core infers `string` and the result is
  // re-branded here.
  //
  // Three-way autoStart in this tier: `undefined` (the default) starts the
  // machine from a layout effect on first mount, so subscribers attach before
  // the initial stepEnter; `true` keeps the eager in-factory start for callers
  // who need SSR to emit step content; `false` defers to controls.start().
  //
  // `options?.autoStart === true` is load-bearing and must stay a strict
  // comparison, not a spread. Core now defaults autoStart to `true`, so
  // forwarding `options` unchanged would start every bundle inside the factory:
  // SSR would render step content where the client renders `fallback`,
  // hydration would mismatch, and the journey's first stepEnter would fire
  // before any component could subscribe. This line is what turns Core's
  // default off so the mount effect below can own starting instead.
  const machine = coreCreateLinearJourney(coreDefinition, {
    ...options,
    autoStart: options?.autoStart === true
  }) as unknown as Machine;

  const useAutoStart = createAutoStartHook(machine, options?.autoStart === undefined);

  /**
   * Per-step handlers registered by mounted components, stacked so a remount
   * that overlaps an unmount does not strand the survivor: the last entry wins
   * and each caller removes only its own.
   *
   * This registry lives in the bundle rather than in core. Core keeps exactly
   * one channel for pre-move async — `goToNextStep(work)` — and register-on-
   * mount is a React lifetime concern, so the bundle wraps `goToNextStep` to
   * consult it. The wrapper is what `bundle.navigate` and `bundle.machine`
   * expose, so every path reached through the bundle honours the handlers.
   */
  const stepHandlers = new Map<string, { current: AnyStepHandler }[]>();

  type NextStepWork = Parameters<Machine["navigate"]["goToNextStep"]>[0];

  const goToNextStep = ((work?: NextStepWork) => {
    if (work) return machine.navigate.goToNextStep(work);
    const stepId = machine.getSnapshot().currentStep?.id;
    const stack = stepId === undefined ? undefined : stepHandlers.get(stepId);
    const registered = stack?.[stack.length - 1];
    if (!registered) return machine.navigate.goToNextStep();
    const handler = registered.current as unknown as NonNullable<NextStepWork>;
    return machine.navigate.goToNextStep({
      run: (args) => handler.run(args),
      commit: (args) => handler.commit?.(args)
    } as NonNullable<NextStepWork>);
  }) as Machine["navigate"]["goToNextStep"];

  const navigate: Machine["navigate"] = { ...machine.navigate, goToNextStep };
  const boundMachine: Machine = { ...machine, navigate };

  return {
    ...createJourneyBindings<Machine, TContext, TStepId, Snapshot>(
      boundMachine,
      name ?? "LinearJourney",
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
        const entry = handlerRef as unknown as { current: AnyStepHandler };
        const stack = stepHandlers.get(stepId) ?? [];
        if (stack.length > 0) {
          // Two components mounted against one step is almost always a mistake:
          // only the last registration runs, so the other's work silently never
          // fires. StrictMode's double-mount is exempt — it unregisters first.
          warnInDevelopment(
            `journey: shadowed a live registration for step "${stepId}" — last registration wins.`
          );
        }
        stack.push(entry);
        stepHandlers.set(stepId, stack);
        return () => {
          // Both guards below are unreachable from the public API: the key is
          // deleted only once the stack empties, and emptying it means splicing
          // out this very entry, so no cleanup can find its key missing or its
          // own entry gone. They stay as defence against a future caller that
          // breaks that invariant.
          const live = stepHandlers.get(stepId);
          /* v8 ignore start -- the key is deleted only as the last entry is spliced out, so a live cleanup always finds its stack. */
          if (!live) return;
          /* v8 ignore stop */
          const index = live.lastIndexOf(entry);
          /* v8 ignore start -- each cleanup removes its own entry exactly once, so the lookup cannot miss. */
          if (index >= 0) {
            /* v8 ignore stop */
            live.splice(index, 1);
          }
          if (!live.length) stepHandlers.delete(stepId);
        };
      }, [stepId]);
      // Declared last on purpose: the handler must be registered before the
      // start effect runs, so it can gate a navigation from the very first step.
      useAutoStart();
    },
    machine: boundMachine,
    navigate
  };
};

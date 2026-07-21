import React from "react";
import { useJourneySelector } from "../headless/use-journey-selector";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { LinearJourneyProvider } from "./linear";
import { useLinearJourneyStep } from "./use-linear-journey-step";
import type { LinearStepIdOf, LinearStepInput } from "@rxova/journey-core";
import type {
  LinearJourneyBundle,
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
  LinearJourneySnapshot,
  LinearJourneyStepHandler,
  LinearProviderProps,
  UseLinearJourneyResult
} from "./linear.types";

const stepIdOf = (step: string | { readonly id: string }): string =>
  typeof step === "string" ? step : step.id;

/**
 * The typed factory over the linear tier: capture the definition once, get a
 * fully-typed bundle back — `TContext` is inferred from `definition.context`
 * (annotate the value, e.g. `const initialContext: SignupContext = {...}`),
 * the step-id union from the `steps` tuple. Call sites never pass generics.
 *
 * ```tsx
 * const signup = createLinearJourney({
 *   name: "signup",
 *   context: initialContext,
 *   steps: [{ id: "email" }, { id: "review" }, { id: "done" }]
 * });
 *
 * <signup.Provider
 *   views={{ email: <EmailStep />, review: <ReviewStep />, done: <DoneStep /> }}
 *   footer={<Controls />}
 *   onComplete={track}
 * />;
 *
 * const { machine, snapshot } = signup.useJourney();
 * ```
 *
 * **No machine is created here** — the definition is captured and a machine is
 * created per `<Provider>` mount (StrictMode-safe, disposed on unmount);
 * multiple Providers are independent instances. Step configs (`metadata`,
 * `onEnter`, `onLeave`) live in the definition; the Provider's `views` record
 * supplies what each step renders, and its keys are type-checked to cover the
 * declared ids exactly. Each bundle owns a private React context, so its
 * hooks only see its own Providers. The definition is core's
 * `LinearJourneyDefinition` shape — hand it to `linearToGraphDefinition()`
 * from `@rxova/journey-core/convert` when a journey outgrows the linear tier.
 */
export const createLinearJourney = <
  TContext,
  const TSteps extends readonly [
    LinearStepInput<NoInfer<TContext>, unknown>,
    ...LinearStepInput<NoInfer<TContext>, unknown>[]
  ]
>(
  definition: LinearJourneyBundleDefinition<TContext, TSteps>,
  options?: LinearJourneyBundleOptions<LinearStepIdOf<TSteps>>
): LinearJourneyBundle<TContext, LinearStepIdOf<TSteps>> => {
  type TStepId = LinearStepIdOf<TSteps>;
  type Machine = LinearJourneyMachine<TContext, TStepId>;
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

  const MachineContext = React.createContext<Machine | null>(null);

  const useMachine = (hookName: string): Machine => {
    const machine = React.useContext(MachineContext);
    if (machine === null) {
      throw new Error(`${hookName}() must be called inside this journey's <Provider>.`);
    }
    return machine;
  };

  const Provider = (props: LinearProviderProps<TContext, TStepId>): React.ReactElement => (
    <LinearJourneyProvider<TContext, TStepId>
      {...props}
      definition={definition as LinearJourneyBundleDefinition<TContext>}
      declaredStepIds={declaredStepIds}
      runtimeOptions={options}
      machineContext={MachineContext}
    />
  );
  Provider.displayName = definition.name ? `${definition.name}.Provider` : "LinearJourney.Provider";

  return {
    Provider,
    useJourney: (): UseLinearJourneyResult<TContext, TStepId> => {
      const machine = useMachine("useJourney");
      const snapshot = useJourneySnapshot(machine) as Snapshot;
      return { machine, snapshot };
    },
    useSelector: <TSelected,>(
      selector: (snapshot: Snapshot) => TSelected,
      equalityFn?: (a: TSelected, b: TSelected) => boolean
    ): TSelected => {
      const machine = useMachine("useSelector");
      return useJourneySelector(
        machine,
        selector as (snapshot: ReturnType<Machine["getSnapshot"]>) => TSelected,
        equalityFn
      );
    },
    useStep: <TResult = void,>(handler?: LinearJourneyStepHandler<TContext, TResult>): void => {
      const machine = useMachine("useStep");
      useLinearJourneyStep<TContext, TResult>(machine, handler);
    }
  };
};

import React from "react";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { useLinearJourney } from "./use-linear-journey";
import { useLinearJourneySelector } from "./use-linear-journey-selector";
import { useLinearJourneyStep } from "./use-linear-journey-step";
import { LinearJourney } from "./linear";
import { LinearJourneyStep } from "./linear-journey-step";
import type { GraphJourneyDefinition } from "@rxova/journey-core";
import type {
  LinearJourneyProps,
  LinearJourneySnapshot,
  LinearJourneyStepHandler,
  LinearJourneyStepProps,
  UseLinearJourneyResult
} from "./linear.types";

/** `<LinearJourney>` with the bundle's context and step-id types baked in. */
export type TypedLinearJourney<TContext, TStepId extends string> = ((
  props: LinearJourneyProps<TContext, TStepId>
) => React.ReactElement) & {
  Step: (props: LinearJourneyStepProps<TContext, TStepId>) => React.ReactElement;
};

export type LinearJourneyBundle<TContext, TStepId extends string> = {
  /** Typed `<LinearJourney>`: children must cover exactly the declared step ids. */
  LinearJourney: TypedLinearJourney<TContext, TStepId>;
  useLinearJourney: () => UseLinearJourneyResult<TContext, TStepId>;
  useLinearJourneySelector: <TSelected>(
    selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  useLinearJourneyStep: <TResult = void>(
    handler?: LinearJourneyStepHandler<TContext, TResult>
  ) => void;
  /** Emits the equivalent core graph definition (linear→graph migration). */
  toGraphDefinition: (context: TContext) => GraphJourneyDefinition<TContext, TStepId>;
};

/**
 * The typed curry over the zero-config `<LinearJourney>`: bind the context type,
 * then declare the step ids — the returned components and hooks are fully
 * typed, so `bundle.useLinearJourney()` needs no generics at call sites.
 *
 * ```tsx
 * const journey = createLinearJourney<SignupContext>()(["email", "password", "confirm"]);
 *
 * <journey.LinearJourney context={initial} onComplete={done}>
 *   <Email id="email" />
 *   <Password id="password" />
 *   <Confirm id="confirm" />
 * </journey.LinearJourney>;
 * ```
 *
 * The factory declares **types only** — no machine, no components of its own.
 * Steps stay in JSX (`<journey.LinearJourney>` verifies at mount that the
 * children ids match the declaration); everything else (context value,
 * persist, plugins, callbacks) is a render-time prop. Zero-config and bundle
 * linear journeys share one runtime path.
 */
export const createLinearJourney =
  <TContext = Record<string, never>>() =>
  <const TStepIds extends readonly [string, ...string[]]>(
    stepIds: TStepIds
  ): LinearJourneyBundle<TContext, TStepIds[number]> => {
    type TStepId = TStepIds[number];

    if (new Set(stepIds).size !== stepIds.length) {
      throw new Error(
        `createLinearJourney() step ids must be unique; received [${stepIds.join(", ")}].`
      );
    }

    // The public component type hides the internal `declaredStepIds` prop and
    // widens step ids to string; this alias is the one cast bridging both.
    const LinearJourneyWithDeclaration = LinearJourney as unknown as (
      props: LinearJourneyProps<TContext, TStepId> & { declaredStepIds: readonly string[] }
    ) => React.ReactElement;

    const BundleLinearJourney = (props: LinearJourneyProps<TContext, TStepId>) =>
      React.createElement(LinearJourneyWithDeclaration, { ...props, declaredStepIds: stepIds });
    BundleLinearJourney.displayName = "LinearJourney";

    return {
      LinearJourney: Object.assign(BundleLinearJourney, {
        Step: LinearJourneyStep as TypedLinearJourney<TContext, TStepId>["Step"]
      }),
      useLinearJourney: () => useLinearJourney<TContext, TStepId>(),
      useLinearJourneySelector: (selector, equalityFn) =>
        useLinearJourneySelector(selector as never, equalityFn) as ReturnType<typeof selector>,
      useLinearJourneyStep: <TResult>(handler?: LinearJourneyStepHandler<TContext, TResult>) =>
        useLinearJourneyStep<TContext, TResult>(handler),
      toGraphDefinition: (context) =>
        linearToGraphDefinition({
          steps: stepIds.map((id) => ({ id })),
          context
        }) as unknown as GraphJourneyDefinition<TContext, TStepId>
    };
  };

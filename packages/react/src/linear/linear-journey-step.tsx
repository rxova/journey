import type React from "react";
import type { LinearJourneyStepProps } from "./linear.types";

/**
 * Config-only marker element for the children form: declares a step's id (and
 * optional meta / lifecycle hooks) without touching the wrapped component's
 * props. `<LinearJourney>` reads the props off this element and renders its children;
 * the element itself never renders.
 */
export const LinearJourneyStep = <TContext,>(
  props: LinearJourneyStepProps<TContext>
): React.ReactElement => {
  void props;
  throw new Error(
    "<LinearJourney.Step> must be a direct child of <LinearJourney>; it never renders on its own."
  );
};

LinearJourneyStep.displayName = "LinearJourneyStep";

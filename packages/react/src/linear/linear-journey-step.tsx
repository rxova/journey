import type React from "react";
import type { LinearJourneyStepProps } from "./linear.types";

/**
 * Marker element for the Provider's children form: declares which definition
 * step a child renders, without touching the wrapped component's props. Every
 * bundle's `journey.Step` is this one component (typed per bundle); the
 * Provider reads the id off the element and renders its children — the element
 * itself never renders.
 */
export const LinearJourneyStep = (props: LinearJourneyStepProps): React.ReactElement => {
  void props;
  throw new Error(
    "<journey.Step> must be a direct child of the journey's <Provider>; it never renders on its own."
  );
};

LinearJourneyStep.displayName = "LinearJourneyStep";

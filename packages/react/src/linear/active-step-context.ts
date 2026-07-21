import React from "react";

/**
 * Id of the step currently being rendered — lets `journey.useStep()` know its
 * owner. Shared across bundles (nested Providers shadow it correctly): the
 * machine itself always comes from the bundle's private context.
 */
export const LinearJourneyActiveStepContext = /*#__PURE__*/ React.createContext<string | null>(
  null
);

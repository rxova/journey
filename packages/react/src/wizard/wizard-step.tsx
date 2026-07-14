import type React from "react";

import type { JourneyJsonObject } from "@rxova/journey-core";
import type { WizardStepProps } from "./types";

/**
 * Config-only marker element for the children form: declares a step's id and
 * optional meta/lifecycle/effect/after inline, wrapping the step's UI.
 *
 * ```tsx
 * <Wizard>
 *   <Wizard.Step id="login" meta={{ title: "Sign in" }}>
 *     <Login />
 *   </Wizard.Step>
 *   <Verify id="verify" />
 * </Wizard>
 * ```
 *
 * It renders nothing itself — `<Wizard>` detects it by element type and
 * unwraps its children. Rendering it outside `<Wizard>` is a mistake and
 * yields nothing.
 */
export const WizardStep = <TContext extends JourneyJsonObject = JourneyJsonObject>(
  props: WizardStepProps<TContext>
): React.ReactElement | null => {
  void props;
  return null;
};

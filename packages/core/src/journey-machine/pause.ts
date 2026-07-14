import { buildSendResult, now, warnDisposedNoop } from "./helpers";

import type { JourneyBaseEvent, JourneyJsonObject, JourneySendResult } from "../types";
import type { JourneyMachineRuntime } from "./runtime";

export type JourneyMachinePauseController<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = {
  isPaused: () => boolean;
  buildPausedSendResult: () => JourneySendResult<TContext, TStepId>;
  pause: () => void;
  resume: () => void;
};

/**
 * Pause is a transient runtime flag — deliberately NOT part of the snapshot
 * (and therefore never persisted). While paused, navigation and sends resolve
 * as no-ops carrying `noOpReason: "paused"`; `updateContext`, `startJourney`,
 * `resetJourney`, and `clearStepError` keep working. Only `resumeJourney()`
 * clears it. Internal effect/after routing flows through the paused checks
 * too, so a paused machine also holds effect-driven navigation.
 */
export const createJourneyMachinePauseController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
>({
  runtime
}: {
  runtime: JourneyMachineRuntime<TContext, TStepId, TEvents>;
}): JourneyMachinePauseController<TContext, TStepId> => {
  let paused = false;

  return {
    isPaused: () => paused,
    buildPausedSendResult: () =>
      buildSendResult(runtime.getSnapshot(), false, { noOpReason: "paused" as const }),
    pause: () => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("controls.pause");
        return;
      }
      if (paused) {
        return;
      }
      paused = true;
      runtime.emit({
        type: "journey.paused",
        stepId: runtime.peekSnapshot().currentStepId,
        timestamp: now()
      });
    },
    resume: () => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("controls.resume");
        return;
      }
      if (!paused) {
        return;
      }
      paused = false;
      runtime.emit({
        type: "journey.resumed",
        stepId: runtime.peekSnapshot().currentStepId,
        timestamp: now()
      });
    }
  };
};

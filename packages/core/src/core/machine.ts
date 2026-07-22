import type { JourneyRuntime } from "./runtime.js";
import type { AnyNavigationWork } from "./runtime.types.js";
import type {
  ContextUpdater,
  JourneyEventPayloads,
  JourneyMachineBase,
  JourneySnapshot,
  JourneySubscriptionEvent,
  Unsubscribe
} from "./types.js";

/**
 * Builds the stable machine surface over a runtime. The object (and every
 * nested group) is created once — all changing state lives in the snapshot.
 */
export function buildMachineSurface(
  runtime: JourneyRuntime
): JourneyMachineBase<unknown, string> & { plugins: Readonly<Record<string, unknown>> } {
  return {
    getSnapshot: () => runtime.store.getSnapshot(),
    controls: {
      start: () => runtime.start(),
      pause: () => runtime.pause(),
      resume: () => runtime.resume(),
      complete: (payload?: unknown) => runtime.complete(payload),
      terminate: (payload?: unknown) => runtime.terminate(payload),
      restart: () => runtime.restart()
    },
    dispose: () => runtime.dispose(),
    navigate: {
      goToStepById: (id: string) => runtime.goToStepById(id),
      goToPreviousStep: ((nOrWork?: number | AnyNavigationWork, work?: AnyNavigationWork) =>
        runtime.goToPreviousStep(nOrWork, work)) as JourneyMachineBase<
        unknown,
        string
      >["navigate"]["goToPreviousStep"],
      goToNextStep: (work) => runtime.goToNextStep(work as AnyNavigationWork | undefined),
      goToLastVisitedStep: () => runtime.goToLastVisitedStep(),
      registerNextStepInterceptor: (stepId, work) =>
        runtime.registerNextStepInterceptor(stepId, work as AnyNavigationWork)
    },
    subscriptions: {
      subscribeSelector: <TSelected>(
        selector: (snapshot: JourneySnapshot<unknown, string>) => TSelected,
        listener: (selected: TSelected) => void,
        equals?: (a: TSelected, b: TSelected) => boolean
      ): Unsubscribe => runtime.store.subscribeSelector(selector, listener, equals),
      subscribeEvent: <TEvent extends JourneySubscriptionEvent>(
        event: TEvent,
        listener: (payload: JourneyEventPayloads<unknown, string>[TEvent]) => void
      ): Unsubscribe => runtime.store.subscribeEvent(event, listener)
    },
    context: {
      update: (updater: ContextUpdater<unknown>) => runtime.updateContext(updater)
    },
    async: {
      clearError: () => runtime.clearAsyncError()
    },
    plugins: runtime.pluginApis
  };
}

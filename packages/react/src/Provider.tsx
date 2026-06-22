import React from "react";

import type {
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneySelector,
  JourneyMachineWithPlugins,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import type { JourneyProviderErrorContext, JourneyProviderProps, JourneyViews } from "./types";
import type { JourneyBaseEvent, JourneyEmpty } from "@rxova/journey-core";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const reportProviderError = (
  error: unknown,
  context: JourneyProviderErrorContext,
  listener?: ((error: unknown, context: JourneyProviderErrorContext) => void) | undefined
) => {
  if (listener) {
    listener(error, context);
    return;
  }

  console.error(`JourneyProvider ${context.phase} failed.`, error);
};

export const createJourneyProviderArtifacts = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>,
  useJourneySelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected
) => {
  const ViewsContext = React.createContext<JourneyViews<TStepId> | null>(null);

  const useJourneyViews = (hookName = "hook") => {
    const views = React.useContext(ViewsContext);
    if (!views) {
      throw new Error(`${hookName} must be used within JourneyProvider.`);
    }
    return views;
  };

  const ProviderController = ({
    runtimeMachine,
    onError,
    disposeOnUnmount
  }: {
    runtimeMachine: typeof machine;
    onError: JourneyProviderProps<TStepId>["onError"] | undefined;
    disposeOnUnmount: boolean;
  }) => {
    const onErrorRef = React.useRef(onError);
    const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
    onErrorRef.current = onError;

    useSafeLayoutEffect(() => {
      if (scheduledDisposeRef.current === null) {
        return;
      }

      globalThis.clearTimeout(scheduledDisposeRef.current);
      scheduledDisposeRef.current = null;
    });

    const selectStatus = React.useCallback(
      (snapshot: ReturnType<typeof runtimeMachine.getSnapshot>) => snapshot.status,
      [runtimeMachine]
    );
    const subscribeToStatus = React.useCallback(
      (onStoreChange: () => void) =>
        runtimeMachine.subscribeSelector(selectStatus, () => {
          onStoreChange();
        }),
      [runtimeMachine, selectStatus]
    );
    const getStatus = React.useCallback(
      () => runtimeMachine.getSnapshot().status,
      [runtimeMachine]
    );
    const status = React.useSyncExternalStore(subscribeToStatus, getStatus, getStatus);

    useSafeLayoutEffect(() => {
      if (status === "idled") {
        void runtimeMachine.startJourney().catch((error) => {
          reportProviderError(error, { phase: "start" }, onErrorRef.current);
        });
      }
    }, [runtimeMachine, status]);

    useSafeLayoutEffect(() => {
      if (!disposeOnUnmount) {
        return;
      }

      return () => {
        scheduledDisposeRef.current = globalThis.setTimeout(() => {
          scheduledDisposeRef.current = null;
          runtimeMachine.dispose();
        }, 0);
      };
    }, [runtimeMachine, disposeOnUnmount]);

    return null;
  };

  const JourneyProvider = ({
    views,
    onError,
    disposeOnUnmount = false,
    children
  }: JourneyProviderProps<TStepId>) => {
    const runtimeMachine = machine;

    return (
      <ViewsContext.Provider value={views}>
        {children}
        <ProviderController
          runtimeMachine={runtimeMachine}
          onError={onError}
          disposeOnUnmount={disposeOnUnmount}
        />
      </ViewsContext.Provider>
    );
  };

  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const currentStepId = useJourneySelector((snapshot) => snapshot.currentStepId);
    const views = useJourneyViews("StepRenderer");
    const StepComponent = views[currentStepId];

    if (!StepComponent) {
      return <>{fallback}</>;
    }

    const StepView = StepComponent as React.ComponentType;

    return (
      <React.Fragment key={currentStepId}>
        <StepView />
      </React.Fragment>
    );
  };

  return {
    JourneyProvider,
    StepRenderer
  };
};

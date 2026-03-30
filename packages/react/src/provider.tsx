import React from "react";

import type {
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneySelector,
  JourneyMachineWithPlugins,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import type {
  JourneyProviderErrorContext,
  JourneyProviderProps,
  JourneyViews
} from "./types";

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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>,
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
    onStart,
    onComplete,
    onTerminate,
    onError,
    disposeOnUnmount
  }: {
    runtimeMachine: typeof machine;
    onStart: JourneyProviderProps<TStepId, TEventMap, TStepMeta>["onStart"] | undefined;
    onComplete: JourneyProviderProps<TStepId, TEventMap, TStepMeta>["onComplete"] | undefined;
    onTerminate: JourneyProviderProps<TStepId, TEventMap, TStepMeta>["onTerminate"] | undefined;
    onError: JourneyProviderProps<TStepId, TEventMap, TStepMeta>["onError"] | undefined;
    disposeOnUnmount: boolean;
  }) => {
    const onStartRef = React.useRef(onStart);
    const onCompleteRef = React.useRef(onComplete);
    const onTerminateRef = React.useRef(onTerminate);
    const onErrorRef = React.useRef(onError);
    const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
    const hasOnStart = onStart !== undefined;
    const hasOnComplete = onComplete !== undefined;
    const hasOnTerminate = onTerminate !== undefined;

    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
    onTerminateRef.current = onTerminate;
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
      if (!hasOnStart && !hasOnComplete && !hasOnTerminate) {
        return;
      }

      const unsubStart = hasOnStart
        ? runtimeMachine.subscribeStart((event) => {
            onStartRef.current?.(event);
          })
        : undefined;

      const unsubComplete = hasOnComplete
        ? runtimeMachine.subscribeComplete((event) => {
            onCompleteRef.current?.(event);
          })
        : undefined;

      const unsubTerminate = hasOnTerminate
        ? runtimeMachine.subscribeTerminate((event) => {
            onTerminateRef.current?.(event);
          })
        : undefined;

      return () => {
        unsubStart?.();
        unsubComplete?.();
        unsubTerminate?.();
      };
    }, [runtimeMachine, hasOnComplete, hasOnStart, hasOnTerminate]);

    useSafeLayoutEffect(() => {
      if (status === "idled") {
        void runtimeMachine.start().catch((error) => {
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
    onStart,
    onComplete,
    onTerminate,
    onError,
    disposeOnUnmount = false,
    children
  }: JourneyProviderProps<TStepId, TEventMap, TStepMeta>) => {
    const runtimeMachine = machine;

    return (
      <ViewsContext.Provider value={views}>
        {children}
        <ProviderController
          runtimeMachine={runtimeMachine}
          onStart={onStart}
          onComplete={onComplete}
          onTerminate={onTerminate}
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

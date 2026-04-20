import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { createJourneyBuilder } from "@rxova/journey-core";
import { createJourney, createJourneyFactory, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "review" | "confirmExit";
type EventMap = { requestClose: unknown };
type Context = {
  name: string;
  includeDetails: boolean;
  dirty: boolean;
};
type Meta = {
  label: string;
};

const createDefinition = (
  context: Partial<Context> = {}
): JourneyDefinition<Context, StepId, EventMap, Meta> => ({
  initial: "start",
  context: {
    name: "",
    includeDetails: true,
    dirty: false,
    ...context
  },
  steps: {
    start: { meta: { label: "Start" } },
    details: { meta: { label: "Details" } },
    review: { meta: { label: "Review" } },
    confirmExit: { meta: { label: "Confirm Exit" } }
  },
  transitions: {
    start: {
      goToNextStep: [
        {
          to: "details",
          when: ({ context: snapshotContext }) => snapshotContext.includeDetails
        },
        {
          to: "review",
          when: ({ context: snapshotContext }) => !snapshotContext.includeDetails
        }
      ],
      goToStepById: [{ to: "review" }]
    },
    details: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      completeJourney: [{}]
    },
    global: {
      requestClose: [
        {
          to: "confirmExit",
          when: ({ context: snapshotContext }) => snapshotContext.dirty
        }
      ],
      terminateJourney: [{}]
    }
  }
});

const createJourneyHarness = (context: Partial<Context> = {}) => {
  const journey = createJourney(createDefinition(context));
  let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;

  const ApiCapture = () => {
    latestApi = journey.useJourneyApi();
    return null;
  };

  const StartView = () => {
    const snapshot = journey.useJourneySnapshot();
    return (
      <div data-testid="step-view">
        Start
        <span data-testid="step-name">{snapshot.context.name || "Anonymous"}</span>
      </div>
    );
  };

  const DetailsView = () => <div data-testid="step-view">Details</div>;
  const ReviewView = () => <div data-testid="step-view">Review</div>;
  const ConfirmExitView = () => <div data-testid="step-view">Confirm Exit</div>;

  const views: JourneyViews<StepId> = {
    start: StartView,
    details: DetailsView,
    review: ReviewView,
    confirmExit: ConfirmExitView
  };

  return {
    journey,
    views,
    ApiCapture,
    getApi: () => latestApi
  };
};

const flushQueuedEffects = async (cycles = 2) => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

describe("createJourney", () => {
  it("provides step-scoped api for builder-authored journeys", async () => {
    type BuilderStepId = "emailCode" | "loggedIn";
    type BuilderEventMap = {
      verifyCodeSuccess: { code: string };
      submitLogin: { username: string; password: string };
    };
    type BuilderContext = { attempts: number };

    const { createStep, to, build } = createJourneyBuilder<
      BuilderContext,
      BuilderStepId,
      BuilderEventMap
    >();
    const emailCodeStep = createStep("emailCode", {
      on: {
        verifyCodeSuccess: [to("loggedIn")]
      }
    });
    const loggedInStep = createStep("loggedIn");
    const builderJourney = createJourney(
      build({
        initial: "emailCode",
        context: { attempts: 0 },
        steps: [emailCodeStep, loggedInStep]
      })
    );

    type BuilderStepApi = typeof builderJourney extends {
      useStepApi: (stepId: "emailCode") => infer TApi;
    }
      ? TApi
      : never;

    let latestApi: BuilderStepApi | null = null;

    const EmailCodeView = () => {
      const api = builderJourney.useStepApi("emailCode");

      React.useEffect(() => {
        latestApi = api;
      }, [api]);

      return <div data-testid="builder-step">Email Code</div>;
    };

    const views: JourneyViews<BuilderStepId> = {
      emailCode: EmailCodeView,
      loggedIn: () => <div data-testid="builder-step">Logged In</div>
    };

    render(
      <builderJourney.JourneyProvider views={views}>
        <builderJourney.StepRenderer />
      </builderJourney.JourneyProvider>
    );

    expect(screen.getByTestId("builder-step").textContent).toBe("Email Code");
    expect(latestApi).not.toBeNull();

    await act(async () => {
      await latestApi?.startJourney();
      await latestApi?.send({ type: "verifyCodeSuccess", payload: { code: "123456" } });
    });

    expect(screen.getByTestId("builder-step").textContent).toBe("Logged In");
    builderJourney.dispose();
  });

  it("provides step-scoped api for graph definitions keyed by step id", async () => {
    const graphJourney = createJourney({
      initial: "start",
      context: {
        name: "",
        includeDetails: true,
        dirty: false
      },
      steps: {
        start: { meta: { label: "Start" } },
        details: { meta: { label: "Details" } },
        review: { meta: { label: "Review" } },
        confirmExit: { meta: { label: "Confirm Exit" } }
      },
      transitions: {
        start: {
          requestClose: [{ to: "confirmExit" }]
        },
        review: {
          requestClose: [{ to: "confirmExit" }]
        }
      }
    } satisfies JourneyDefinition<Context, StepId, EventMap, Meta>);

    let latestApi: ReturnType<typeof graphJourney.useStepApi> | null = null;

    const StartView = () => {
      const api = graphJourney.useStepApi("start");

      React.useEffect(() => {
        latestApi = api;
      }, [api]);

      return <div data-testid="graph-step">Start</div>;
    };

    const views: JourneyViews<StepId> = {
      start: StartView,
      details: () => <div data-testid="graph-step">Details</div>,
      review: () => <div data-testid="graph-step">Review</div>,
      confirmExit: () => <div data-testid="graph-step">Confirm Exit</div>
    };

    render(
      <graphJourney.JourneyProvider views={views}>
        <graphJourney.StepRenderer />
      </graphJourney.JourneyProvider>
    );

    expect(screen.getByTestId("graph-step").textContent).toBe("Start");
    expect(latestApi).not.toBeNull();

    await act(async () => {
      await latestApi?.startJourney();
      await latestApi?.send({ type: "requestClose" });
    });

    expect(screen.getByTestId("graph-step").textContent).toBe("Confirm Exit");
    graphJourney.dispose();
  });

  it("useStepApi exposes resetJourney for provider-owned runtimes", async () => {
    const { journey, views } = createJourneyHarness({ includeDetails: true });
    let latestApi: ReturnType<typeof journey.useStepApi> | null = null;

    const StartView = () => {
      const api = journey.useStepApi("start");

      React.useEffect(() => {
        latestApi = api;
      }, [api]);

      return <div data-testid="step-view">Start</div>;
    };

    const resetViews: JourneyViews<StepId> = {
      ...views,
      start: StartView
    };

    render(
      <journey.JourneyProvider views={resetViews}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await latestApi?.goToNextStep();
    });

    expect(journey.machine.getSnapshot().currentStepId).toBe("details");

    await act(async () => {
      await latestApi?.resetJourney();
      await flushQueuedEffects();
    });

    expect(journey.machine.getSnapshot().status).toBe("running");
    expect(journey.machine.getSnapshot().currentStepId).toBe("start");
    expect(screen.getByTestId("step-view").textContent).toBe("Start");
  });

  it("creates an independent machine instance for each createJourney call", async () => {
    const firstJourney = createJourney(createDefinition());
    const secondJourney = createJourney(createDefinition());

    const FirstProbe = () => {
      const snapshot = firstJourney.useJourneySnapshot();
      return <span data-testid="first-step">{snapshot.currentStepId}</span>;
    };

    const SecondProbe = () => {
      const snapshot = secondJourney.useJourneySnapshot();
      return <span data-testid="second-step">{snapshot.currentStepId}</span>;
    };

    render(
      <>
        <FirstProbe />
        <SecondProbe />
      </>
    );

    expect(firstJourney.machine).not.toBe(secondJourney.machine);
    expect(screen.getByTestId("first-step").textContent).toBe("start");
    expect(screen.getByTestId("second-step").textContent).toBe("start");

    act(() => {
      firstJourney.machine.startJourney();
      secondJourney.machine.startJourney();
    });

    await act(async () => {
      await firstJourney.machine.goToNextStep();
    });

    expect(screen.getByTestId("first-step").textContent).toBe("details");
    expect(screen.getByTestId("second-step").textContent).toBe("start");
    expect(firstJourney.machine.getSnapshot().currentStepId).toBe("details");
    expect(secondJourney.machine.getSnapshot().currentStepId).toBe("start");

    firstJourney.dispose();
    secondJourney.dispose();
  });

  it("creates fresh runtimes from createJourneyFactory", async () => {
    const makeJourney = createJourneyFactory(createDefinition());
    const firstJourney = makeJourney();
    const secondJourney = makeJourney();

    expect(firstJourney.machine).not.toBe(secondJourney.machine);

    act(() => {
      firstJourney.machine.startJourney();
      secondJourney.machine.startJourney();
    });

    await act(async () => {
      await firstJourney.machine.goToNextStep();
    });

    expect(firstJourney.machine.getSnapshot().currentStepId).toBe("details");
    expect(secondJourney.machine.getSnapshot().currentStepId).toBe("start");

    firstJourney.dispose();
    secondJourney.dispose();
  });

  it("lets hooks read snapshot, computed state, api, selectors, and events without a provider", async () => {
    const { journey } = createJourneyHarness();
    const selectorRender = vi.fn();
    const observedEventTypes: string[] = [];

    const SnapshotProbe = () => {
      const snapshot = journey.useJourneySnapshot();

      journey.useJourneyEvent((event) => {
        observedEventTypes.push(event.type);
      });

      return (
        <div>
          <span data-testid="snapshot-step">{snapshot.currentStepId}</span>
          <span data-testid="snapshot-name">{snapshot.context.name}</span>
        </div>
      );
    };

    const ComputedProbe = () => {
      const computed = journey.useJourneyComputed();

      return (
        <div>
          <span data-testid="computed-mode">{computed.mode}</span>
          <span data-testid="computed-step">{computed.activeStepId}</span>
          <span data-testid="computed-index">{computed.activeStepIndex}</span>
        </div>
      );
    };

    const SelectorProbe = () => {
      const selected = journey.useJourneySelector(
        (snapshot) => ({ stepId: snapshot.currentStepId }),
        (previous, next) => previous.stepId === next.stepId
      );

      selectorRender(selected.stepId);
      return <span data-testid="selected-step">{selected.stepId}</span>;
    };

    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;
    const ApiProbe = () => {
      latestApi = journey.useJourneyApi();
      return null;
    };

    render(
      <>
        <ApiProbe />
        <SnapshotProbe />
        <ComputedProbe />
        <SelectorProbe />
      </>
    );

    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("computed-mode").textContent).toBe("graph");
    expect(screen.getByTestId("computed-step").textContent).toBe("start");
    expect(screen.getByTestId("computed-index").textContent).toBe("0");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(selectorRender).toHaveBeenCalledTimes(1);
    expect(observedEventTypes).toEqual([]);
    expect(journey.machine.getSnapshot().status).toBe("idled");
    expect(latestApi).not.toBeNull();

    await act(async () => {
      await latestApi?.updateContext((snapshotContext) => ({
        ...snapshotContext,
        name: "Grace Hopper",
        dirty: true
      }));
    });

    expect(screen.getByTestId("snapshot-name").textContent).toBe("Grace Hopper");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(selectorRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latestApi?.startJourney();
    });

    expect(observedEventTypes).toContain("journey.start");
    expect(journey.machine.getSnapshot().status).toBe("running");

    await act(async () => {
      await latestApi?.goToNextStep();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("details");
    expect(screen.getByTestId("computed-step").textContent).toBe("details");
    expect(screen.getByTestId("computed-index").textContent).toBe("1");
    expect(screen.getByTestId("selected-step").textContent).toBe("details");
    expect(selectorRender).toHaveBeenCalledTimes(2);
    expect(observedEventTypes).toContain("transition.start");
    expect(observedEventTypes).toContain("step.enter");

    await act(async () => {
      await latestApi?.resetJourney();
      await flushQueuedEffects();
    });

    expect(journey.machine.getSnapshot().status).toBe("idled");
    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("computed-step").textContent).toBe("start");
    expect(screen.getByTestId("computed-index").textContent).toBe("0");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(selectorRender).toHaveBeenCalledTimes(3);
  });

  it("useJourneyApi exposes updateContext as an ordered async context write", async () => {
    const definition = {
      initial: "start",
      context: { name: "", includeDetails: true, dirty: false },
      steps: {
        start: { meta: { label: "Start" } },
        details: { meta: { label: "Details" } },
        review: { meta: { label: "Review" } },
        confirmExit: { meta: { label: "Confirm Exit" } }
      },
      transitions: {
        start: {
          goToNextStep: [
            {
              to: "details",
              when: async () => {
                await new Promise((resolve) => {
                  setTimeout(resolve, 0);
                });
                return true;
              },
              updateContext: ({ context }) => {
                return { ...context, name: "From transition" };
              }
            }
          ]
        }
      }
    } satisfies JourneyDefinition<Context, StepId, EventMap, Meta>;
    const journey = createJourney(definition);

    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;
    const ApiProbe = () => {
      latestApi = journey.useJourneyApi();
      return null;
    };

    render(<ApiProbe />);

    act(() => {
      journey.machine.startJourney();
    });

    await act(async () => {
      const sendPromise = latestApi?.goToNextStep();
      await Promise.resolve();

      const queuedSnapshot = await latestApi?.updateContext((context) => ({
        ...context,
        name: `${context.name} + queued`
      }));

      await sendPromise;

      expect(queuedSnapshot?.currentStepId).toBe("details");
      expect(queuedSnapshot?.context.name).toBe("From transition + queued");
    });

    expect(journey.machine.getSnapshot().context.name).toBe("From transition + queued");
  });

  it("exposes linear computed state through useJourneyComputed", async () => {
    const journey = createJourney({
      context: {},
      steps: {
        start: {},
        review: {},
        done: {}
      },
      transitions: ["start", "review", "done"] as const
    });

    const ComputedProbe = () => {
      const computed = journey.useJourneyComputed();
      if (computed.mode !== "linear") {
        return <span data-testid="computed-mode">{computed.mode}</span>;
      }

      return (
        <div>
          <span data-testid="computed-mode">{computed.mode}</span>
          <span data-testid="linear-index">{computed.activeStepIndex}</span>
          <span data-testid="linear-count">{computed.stepCount}</span>
          <span data-testid="linear-first">{String(computed.isFirstStep)}</span>
          <span data-testid="linear-last">{String(computed.isLastStep)}</span>
        </div>
      );
    };

    render(<ComputedProbe />);

    expect(screen.getByTestId("computed-mode").textContent).toBe("linear");
    expect(screen.getByTestId("linear-index").textContent).toBe("0");
    expect(screen.getByTestId("linear-count").textContent).toBe("3");
    expect(screen.getByTestId("linear-first").textContent).toBe("true");
    expect(screen.getByTestId("linear-last").textContent).toBe("false");

    act(() => {
      journey.machine.startJourney();
    });

    await act(async () => {
      await journey.machine.goToNextStep();
    });

    expect(screen.getByTestId("linear-index").textContent).toBe("1");
    expect(screen.getByTestId("linear-first").textContent).toBe("false");
    expect(screen.getByTestId("linear-last").textContent).toBe("false");

    await act(async () => {
      await journey.machine.goToNextStep();
    });

    expect(screen.getByTestId("linear-index").textContent).toBe("2");
    expect(screen.getByTestId("linear-last").textContent).toBe("true");
  });

  it("reuses the cached selector result when a new snapshot is equal by equalityFn", () => {
    const { journey } = createJourneyHarness();
    const selectedValues: Array<{ stepId: StepId }> = [];
    const getLastSelectedValue = () => {
      const value = selectedValues[selectedValues.length - 1];
      if (value === undefined) {
        throw new Error("Expected the selector to have produced at least one value.");
      }
      return value;
    };

    const SelectorProbe = ({ tick }: { tick: number }) => {
      const selector = React.useCallback(
        (snapshot: ReturnType<typeof journey.useJourneySnapshot>) => ({
          stepId: snapshot.currentStepId
        }),
        []
      );
      const equalityFn = React.useCallback(
        (previous: { stepId: StepId }, next: { stepId: StepId }) => previous.stepId === next.stepId,
        []
      );
      const selected = journey.useJourneySelector(selector, equalityFn);

      selectedValues.push(selected);

      return (
        <div>
          <span data-testid="selected-step">{selected.stepId}</span>
          <span data-testid="tick">{tick}</span>
        </div>
      );
    };

    const { rerender } = render(<SelectorProbe tick={0} />);
    const initialSelection = getLastSelectedValue();

    expect(initialSelection).toEqual({ stepId: "start" });

    act(() => {
      journey.machine.updateContext((snapshotContext) => ({
        ...snapshotContext,
        name: "Grace Hopper"
      }));
    });

    rerender(<SelectorProbe tick={1} />);

    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(getLastSelectedValue()).toBe(initialSelection);
  });

  it("supports inline selectors with equality functions across unrelated updates and parent rerenders", async () => {
    const { journey } = createJourneyHarness();
    const selectorRender = vi.fn();
    const selectedValues: Array<{ stepId: StepId }> = [];

    const SelectorProbe = React.memo(() => {
      const selected = journey.useJourneySelector(
        (snapshot) => ({ stepId: snapshot.currentStepId }),
        (previous, next) => previous.stepId === next.stepId
      );

      React.useLayoutEffect(() => {
        selectorRender(selected.stepId);
        selectedValues.push(selected);
      });

      return <span data-testid="selected-step">{selected.stepId}</span>;
    });

    const Harness = () => {
      const [tick, setTick] = React.useState(0);

      return (
        <div>
          <button data-testid="rerender" onClick={() => setTick((value) => value + 1)}>
            rerender
          </button>
          <span data-testid="tick">{tick}</span>
          <SelectorProbe />
        </div>
      );
    };

    render(<Harness />);

    const initialSelection = selectedValues[selectedValues.length - 1];
    expect(initialSelection).toEqual({ stepId: "start" });
    expect(selectorRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await journey.machine.updateContext((snapshotContext) => ({
        ...snapshotContext,
        name: "Grace Hopper"
      }));
    });

    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(selectorRender).toHaveBeenCalledTimes(1);
    expect(selectedValues[selectedValues.length - 1]).toBe(initialSelection);

    fireEvent.click(screen.getByTestId("rerender"));

    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(selectorRender).toHaveBeenCalledTimes(1);
    expect(selectedValues[selectedValues.length - 1]).toBe(initialSelection);

    await act(async () => {
      await journey.machine.startJourney();
      await journey.machine.goToNextStep();
    });

    expect(screen.getByTestId("selected-step").textContent).toBe("details");
    expect(selectorRender).toHaveBeenCalledTimes(2);
  });

  it("reuses the cached selector result across unrelated async snapshot updates", async () => {
    const { journey } = createJourneyHarness();
    const selectedValues: Array<{ stepId: StepId }> = [];
    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;

    const Probe = () => {
      const api = journey.useJourneyApi();
      const selected = journey.useJourneySelector(
        (snapshot) => ({ stepId: snapshot.currentStepId }),
        (previous, next) => previous.stepId === next.stepId
      );

      React.useEffect(() => {
        latestApi = api;
      }, [api]);
      selectedValues.push(selected);

      return <span data-testid="selected-step">{selected.stepId}</span>;
    };

    render(<Probe />);

    const initialSelection = selectedValues[selectedValues.length - 1];
    if (!initialSelection) {
      throw new Error("expected an initial selector value");
    }

    await act(async () => {
      await latestApi?.startJourney();
      await latestApi?.updateContext((context) => ({
        ...context,
        name: "Grace Hopper"
      }));
    });

    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(selectedValues[selectedValues.length - 1]).toBe(initialSelection);
  });

  it("updates selector cache snapshot reference while preserving selected value when equality fn returns true", async () => {
    // This test targets runtime-hooks.tsx lines 90-97: the branch where the snapshot
    // reference has changed (Object.is(cached.snapshot, nextSnapshot) === false) but the
    // equality function returns true, so the cache is updated with the new snapshot pointer
    // while the previously-selected object reference is preserved.
    //
    // The scenario requires:
    // 1. async act() fully applies updateContext so the snapshot reference is new
    // 2. subscribeSelector short-circuits (equalityFn returns true for same stepId)
    //    so onStoreChange is never called — no React re-render, cache stays stale
    // 3. rerender() with a new tick prop forces a synchronous re-render
    // 4. useSyncExternalStore calls getSelectedSnapshot, which hits lines 90-97
    const { journey } = createJourneyHarness();

    const selector = (snapshot: ReturnType<typeof journey.useJourneySnapshot>) => ({
      stepId: snapshot.currentStepId
    });
    const equalityFn = vi.fn(
      (previous: { stepId: StepId }, next: { stepId: StepId }) => previous.stepId === next.stepId
    );

    const selectedValues: Array<{ stepId: StepId }> = [];

    const SelectorProbe = ({ tick }: { tick: number }) => {
      const selected = journey.useJourneySelector(selector, equalityFn);
      selectedValues.push(selected);
      return (
        <div>
          <span data-testid="selected-step">{selected.stepId}</span>
          <span data-testid="tick">{tick}</span>
        </div>
      );
    };

    const { rerender } = render(<SelectorProbe tick={0} />);
    const initialSelection = selectedValues[selectedValues.length - 1];
    if (!initialSelection) {
      throw new Error("expected an initial selector value");
    }

    // Apply both startJourney and updateContext fully (async act ensures microtasks resolve).
    // subscribeSelector fires for both snapshot changes, but equalityFn returns true each time
    // (currentStepId stays "start") so onStoreChange is never called — cache is now stale.
    await act(async () => {
      await journey.machine.startJourney();
      await journey.machine.updateContext((ctx) => ({ ...ctx, name: "Grace Hopper" }));
    });

    const equalityCallsBefore = equalityFn.mock.calls.length;

    // Forcing a re-render causes useSyncExternalStore to call getSelectedSnapshot.
    // cached.snapshot !== current machine snapshot → the selector runs → equalityFn is
    // called (lines 90-97) → cache pointer updated, selected value preserved.
    rerender(<SelectorProbe tick={1} />);

    expect(equalityFn.mock.calls.length).toBeGreaterThan(equalityCallsBefore);
    expect(selectedValues[selectedValues.length - 1]).toBe(initialSelection);
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(screen.getByTestId("tick").textContent).toBe("1");
  });

  it("keeps StepRenderer stable across context-only updates when the current step does not change", async () => {
    const { journey } = createJourneyHarness();
    const startRender = vi.fn();
    const detailsRender = vi.fn();
    const views: JourneyViews<StepId> = {
      start: () => {
        startRender();
        return <div data-testid="step-view">Start</div>;
      },
      details: () => {
        detailsRender();
        return <div data-testid="step-view">Details</div>;
      },
      review: () => <div data-testid="step-view">Review</div>,
      confirmExit: () => <div data-testid="step-view">Confirm Exit</div>
    };

    render(
      <journey.JourneyProvider views={views}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(startRender).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step-view").textContent).toBe("Start");

    await act(async () => {
      await journey.machine.updateContext((snapshotContext) => ({
        ...snapshotContext,
        name: "Grace Hopper"
      }));
    });

    expect(startRender).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step-view").textContent).toBe("Start");

    await act(async () => {
      await journey.machine.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");
    expect(detailsRender).toHaveBeenCalledTimes(1);
  });

  it("renders the current step through JourneyProvider and StepRenderer", async () => {
    const { journey, views, ApiCapture, getApi } = createJourneyHarness({ includeDetails: true });

    render(
      <journey.JourneyProvider views={views}>
        <ApiCapture />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("step-view").textContent).toContain("Start");

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Review");
  });

  it("goToStepById convenience method navigates via useJourneyApi", async () => {
    const { journey, views, ApiCapture, getApi } = createJourneyHarness({ includeDetails: true });

    render(
      <journey.JourneyProvider views={views}>
        <ApiCapture />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("step-view").textContent).toContain("Start");

    await act(async () => {
      const result = await getApi()?.goToStepById("review");
      expect(result?.transitioned).toBe(true);
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Review");
    expect(journey.machine.getSnapshot().currentStepId).toBe("review");
  });

  it("auto-starts before child mount effects send transitions", async () => {
    const { journey, views } = createJourneyHarness({ includeDetails: true });
    const transitionResults: boolean[] = [];

    const AutoAdvanceOnMount = () => {
      const api = journey.useJourneyApi();

      React.useEffect(() => {
        void api.goToNextStep().then((result) => {
          transitionResults.push(result.transitioned);
        });
      }, [api]);

      return null;
    };

    render(
      <journey.JourneyProvider views={views}>
        <AutoAdvanceOnMount />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(transitionResults).toEqual([true]);
    expect(journey.machine.getSnapshot().status).toBe("running");
    expect(screen.getByTestId("step-view").textContent).toBe("Details");
  });

  it("restarts a provider-owned machine after resetJourney", async () => {
    const { journey, views, ApiCapture, getApi } = createJourneyHarness({ includeDetails: true });

    render(
      <journey.JourneyProvider views={views}>
        <ApiCapture />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");

    await act(async () => {
      await getApi()?.resetJourney();
      await flushQueuedEffects();
    });

    expect(journey.machine.getSnapshot().status).toBe("running");
    expect(screen.getByTestId("step-view").textContent).toContain("Start");

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");
  });

  it("useJourneyEvent observes start, reset, complete, and terminate lifecycle events", async () => {
    const { journey, views, ApiCapture, getApi } = createJourneyHarness({ includeDetails: false });
    const observed: Array<{ type: string; stepId: StepId }> = [];

    const EventCapture = () => {
      journey.useJourneyEvent((event) => {
        if (
          event.type === "journey.start" ||
          event.type === "journey.reset" ||
          event.type === "journey.completed" ||
          event.type === "journey.terminated"
        ) {
          observed.push({ type: event.type, stepId: event.stepId });
        }
      });
      return null;
    };

    render(
      <journey.JourneyProvider views={views}>
        <ApiCapture />
        <EventCapture />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(observed).toEqual([{ type: "journey.start", stepId: "start" }]);

    await act(async () => {
      await getApi()?.goToNextStep();
      await getApi()?.completeJourney();
    });

    expect(observed).toContainEqual({ type: "journey.completed", stepId: "review" });

    await act(async () => {
      await getApi()?.resetJourney();
      await flushQueuedEffects();
    });

    expect(observed).toContainEqual({ type: "journey.reset", stepId: "start" });
    expect(observed.filter((event) => event.type === "journey.start")).toHaveLength(2);

    await act(async () => {
      await getApi()?.terminateJourney();
    });

    expect(observed).toContainEqual({ type: "journey.terminated", stepId: "start" });
  });

  it("does not auto-start again when the provider mounts an already running machine", async () => {
    const { journey, views } = createJourneyHarness();
    const startSpy = vi.spyOn(journey.machine, "startJourney");

    await journey.machine.startJourney();

    render(
      <journey.JourneyProvider views={views}>
        <div data-testid="mounted">Mounted</div>
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("mounted").textContent).toBe("Mounted");
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(journey.machine.getSnapshot().status).toBe("running");
  });

  it("reports provider auto-start failures through onError without leaking rejections", async () => {
    const onError = vi.fn();
    const unhandledRejections: PromiseRejectionEvent[] = [];
    const startupError = new Error("start rejected");
    const journey = createJourney(createDefinition(), {
      plugins: [
        {
          name: "start-guard",
          setup: () => ({
            onSnapshotChange: ({ reason }: { reason: string }) => {
              if (reason === "start") {
                throw startupError;
              }
            }
          })
        }
      ] as const
    });
    const views = {
      start: () => <div data-testid="step-view">Start</div>,
      details: () => <div data-testid="step-view">Details</div>,
      review: () => <div data-testid="step-view">Review</div>,
      confirmExit: () => <div data-testid="step-view">Confirm Exit</div>
    } satisfies JourneyViews<StepId>;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    try {
      render(
        <journey.JourneyProvider views={views} onError={onError}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );

      await act(async () => {
        await flushQueuedEffects();
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(startupError, { phase: "start" });
      expect(unhandledRejections).toEqual([]);
      expect(journey.machine.getSnapshot().status).toBe("idled");
      expect(screen.getByTestId("step-view").textContent).toBe("Start");
    } finally {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      journey.dispose();
    }
  });

  it("falls back to console.error when provider auto-start fails without onError", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unhandledRejections: PromiseRejectionEvent[] = [];
    const startupError = new Error("start rejected");
    const journey = createJourney(createDefinition());
    const views = {
      start: () => <div data-testid="step-view">Start</div>,
      details: () => <div data-testid="step-view">Details</div>,
      review: () => <div data-testid="step-view">Review</div>,
      confirmExit: () => <div data-testid="step-view">Confirm Exit</div>
    } satisfies JourneyViews<StepId>;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event);
    };
    const startSpy = vi.spyOn(journey.machine, "startJourney").mockRejectedValueOnce(startupError);

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    try {
      render(
        <journey.JourneyProvider views={views}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );

      await act(async () => {
        await flushQueuedEffects();
      });

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("JourneyProvider start failed.", startupError);
      expect(unhandledRejections).toEqual([]);
      expect(journey.machine.getSnapshot().status).toBe("idled");
      expect(screen.getByTestId("step-view").textContent).toBe("Start");
    } finally {
      consoleError.mockRestore();
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      journey.dispose();
    }
  });

  it("falls back to console.error when provider auto-start fails without onError", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unhandledRejections: PromiseRejectionEvent[] = [];
    const startupError = new Error("start rejected");
    const journey = createJourney(createDefinition(), {
      plugins: [
        {
          name: "start-guard",
          setup: () => ({
            onSnapshotChange: ({ reason }: { reason: string }) => {
              if (reason === "start") {
                throw startupError;
              }
            }
          })
        }
      ] as const
    });
    const views = {
      start: () => <div data-testid="step-view">Start</div>,
      details: () => <div data-testid="step-view">Details</div>,
      review: () => <div data-testid="step-view">Review</div>,
      confirmExit: () => <div data-testid="step-view">Confirm Exit</div>
    } satisfies JourneyViews<StepId>;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    try {
      render(
        <journey.JourneyProvider views={views}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );

      await act(async () => {
        await flushQueuedEffects();
      });

      expect(consoleError).toHaveBeenCalledWith("JourneyProvider start failed.", startupError);
      expect(unhandledRejections).toEqual([]);
      expect(journey.machine.getSnapshot().status).toBe("idled");
      expect(screen.getByTestId("step-view").textContent).toBe("Start");
    } finally {
      consoleError.mockRestore();
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      journey.dispose();
    }
  });

  it("starts a provider-owned machine during mount before an immediate unmount", async () => {
    const { journey, views } = createJourneyHarness();

    const { unmount } = render(
      <journey.JourneyProvider views={views}>
        <div data-testid="mounted">Mounted</div>
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(journey.machine.getSnapshot().status).toBe("running");

    unmount();
    expect(journey.machine.getSnapshot().status).toBe("running");
  });

  it("does not dispose a shared runtime when one provider unmounts", async () => {
    const { journey, views } = createJourneyHarness({ includeDetails: true });
    const disposeSpy = vi.spyOn(journey.machine, "dispose");
    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;

    const ApiCapture = () => {
      latestApi = journey.useJourneyApi();
      return null;
    };

    const Shell = ({ showAuxiliaryProvider }: { showAuxiliaryProvider: boolean }) => (
      <>
        {showAuxiliaryProvider ? (
          <journey.JourneyProvider views={views}>
            <div data-testid="aux-provider">Aux</div>
          </journey.JourneyProvider>
        ) : null}
        <journey.JourneyProvider views={views}>
          <ApiCapture />
          <journey.StepRenderer />
        </journey.JourneyProvider>
      </>
    );

    const { rerender, unmount } = render(<Shell showAuxiliaryProvider />);

    await act(async () => {
      await Promise.resolve();
    });

    rerender(<Shell showAuxiliaryProvider={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(disposeSpy).not.toHaveBeenCalled();

    await act(async () => {
      await latestApi?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");
    expect(journey.machine.getSnapshot().status).toBe("running");

    unmount();

    expect(disposeSpy).not.toHaveBeenCalled();
    journey.dispose();
  });

  it("disposes the runtime on unmount when disposeOnUnmount is enabled", async () => {
    vi.useFakeTimers();
    try {
      const { journey, views } = createJourneyHarness();
      const disposeSpy = vi.spyOn(journey.machine, "dispose");

      const { unmount } = render(
        <journey.JourneyProvider views={views} disposeOnUnmount>
          <div data-testid="mounted">Mounted</div>
        </journey.JourneyProvider>
      );

      await act(async () => {
        await Promise.resolve();
      });

      unmount();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rebinds hooks when a component switches to a different journey instance", async () => {
    const journeyA = createJourney(createDefinition({ name: "Journey A", includeDetails: true }));
    const journeyB = createJourney(createDefinition({ name: "Journey B", includeDetails: false }));
    const observedStepEntries: string[] = [];
    let latestApi: ReturnType<typeof journeyA.useJourneyApi> | null = null;

    const Probe = ({ journey }: { journey: typeof journeyA }) => {
      const snapshot = journey.useJourneySnapshot();
      const selectedStep = journey.useJourneySelector((nextSnapshot) => nextSnapshot.currentStepId);

      journey.useJourneyEvent((event) => {
        if (event.type === "step.enter") {
          observedStepEntries.push(event.stepId);
        }
      });

      latestApi = journey.useJourneyApi();

      return (
        <div>
          <span data-testid="snapshot-step">{snapshot.currentStepId}</span>
          <span data-testid="snapshot-name">{snapshot.context.name}</span>
          <span data-testid="selected-step">{selectedStep}</span>
        </div>
      );
    };

    const { rerender } = render(<Probe journey={journeyA} />);

    await act(async () => {
      await journeyA.machine.startJourney();
    });

    await act(async () => {
      await journeyA.machine.goToNextStep();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("details");
    expect(screen.getByTestId("snapshot-name").textContent).toBe("Journey A");
    expect(screen.getByTestId("selected-step").textContent).toBe("details");

    rerender(<Probe journey={journeyB} />);

    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("snapshot-name").textContent).toBe("Journey B");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");

    observedStepEntries.length = 0;

    await act(async () => {
      await journeyB.machine.startJourney();
    });

    await act(async () => {
      await journeyB.machine.goToNextStep();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("review");
    expect(screen.getByTestId("selected-step").textContent).toBe("review");
    expect(observedStepEntries).toContain("review");

    await act(async () => {
      await latestApi?.resetJourney();
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(journeyA.machine.getSnapshot().currentStepId).toBe("details");
    expect(journeyB.machine.getSnapshot().currentStepId).toBe("start");

    journeyA.dispose();
    journeyB.dispose();
  });

  it("renders the fallback when a view is missing", async () => {
    const { journey, ApiCapture, getApi } = createJourneyHarness({ includeDetails: false });

    render(
      <journey.JourneyProvider
        views={
          {
            start: () => <div data-testid="step-view">Start</div>
          } as unknown as JourneyViews<StepId>
        }
      >
        <ApiCapture />
        <journey.StepRenderer fallback={<div data-testid="fallback">Missing step view</div>} />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Start");

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("fallback").textContent).toBe("Missing step view");
  });

  it("throws when StepRenderer is rendered outside JourneyProvider", () => {
    const { journey } = createJourneyHarness();

    expect(() => render(<journey.StepRenderer />)).toThrow(/JourneyProvider/);
  });

  it("exposes dispose as a convenience alias for machine.dispose", () => {
    const { journey } = createJourneyHarness();
    const disposeSpy = vi.spyOn(journey.machine, "dispose");

    journey.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps snapshot, selector, and api hooks usable after the runtime is disposed", async () => {
    const { journey } = createJourneyHarness();
    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;
    let rerenderProbe: (() => void) | null = null;

    const Probe = () => {
      const [tick, setTick] = React.useState(0);
      const snapshot = journey.useJourneySnapshot();
      const selectedStep = journey.useJourneySelector((nextSnapshot) => nextSnapshot.currentStepId);
      const api = journey.useJourneyApi();

      React.useLayoutEffect(() => {
        latestApi = api;
        rerenderProbe = () => {
          setTick((value) => value + 1);
        };
      });

      return (
        <div>
          <span data-testid="snapshot-step">{snapshot.currentStepId}</span>
          <span data-testid="selected-step">{selectedStep}</span>
          <span data-testid="tick">{tick}</span>
        </div>
      );
    };

    render(<Probe />);

    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");

    act(() => {
      journey.dispose();
    });

    act(() => {
      rerenderProbe?.();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(journey.machine.getSnapshot().status).toBe("idled");

    await act(async () => {
      const snapshot = await latestApi?.startJourney();
      expect(snapshot?.currentStepId).toBe("start");
      expect(snapshot?.status).toBe("idled");
    });

    expect(journey.machine.getSnapshot().status).toBe("idled");
    expect(screen.getByTestId("snapshot-step").textContent).toBe("start");
    expect(screen.getByTestId("selected-step").textContent).toBe("start");
  });

  it("StepRenderer does not remount the step view when only context changes", async () => {
    const { journey, ApiCapture, getApi } = createJourneyHarness({ includeDetails: true });
    let mountCount = 0;
    let unmountCount = 0;

    const InstrumentedStartView = () => {
      React.useEffect(() => {
        mountCount += 1;
        return () => {
          unmountCount += 1;
        };
      }, []);
      return <div data-testid="step-view">Start</div>;
    };

    const views: JourneyViews<StepId> = {
      start: InstrumentedStartView,
      details: () => <div data-testid="step-view">Details</div>,
      review: () => <div data-testid="step-view">Review</div>,
      confirmExit: () => <div data-testid="step-view">Confirm Exit</div>
    };

    render(
      <journey.JourneyProvider views={views}>
        <ApiCapture />
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Start");
    expect(mountCount).toBe(1);
    expect(unmountCount).toBe(0);

    await act(async () => {
      await getApi()?.updateContext((ctx) => ({ ...ctx, name: "Grace" }));
    });

    expect(mountCount).toBe(1);
    expect(unmountCount).toBe(0);

    await act(async () => {
      await getApi()?.updateContext((ctx) => ({ ...ctx, dirty: true }));
    });

    expect(mountCount).toBe(1);
    expect(unmountCount).toBe(0);

    await act(async () => {
      await getApi()?.goToNextStep();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("Details");
    expect(unmountCount).toBe(1);
  });

  it("useJourneySelector with inline selectors does not cause infinite re-renders", async () => {
    const { journey } = createJourneyHarness();
    const renderCount = vi.fn();

    const InlineSelectorProbe = () => {
      const selected = journey.useJourneySelector((snapshot) => snapshot.currentStepId);
      renderCount();
      return <span data-testid="inline-step">{selected}</span>;
    };

    render(<InlineSelectorProbe />);

    expect(screen.getByTestId("inline-step").textContent).toBe("start");
    const rendersAfterMount = renderCount.mock.calls.length;

    await act(async () => {
      await journey.machine.startJourney();
    });

    await act(async () => {
      await journey.machine.updateContext((ctx) => ({ ...ctx, name: "Grace" }));
    });

    await act(async () => {
      await journey.machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
    });

    expect(screen.getByTestId("inline-step").textContent).toBe("start");
    expect(renderCount.mock.calls.length).toBe(rendersAfterMount);
  });
});

describe("useJourneyStepLifecycle", () => {
  const createSimpleJourney = () => createJourney(createDefinition({ includeDetails: true }));

  it("calls onEnter when the machine transitions into the watched step", async () => {
    const journey = createSimpleJourney();
    const onEnter = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("details", { onEnter });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details
    });

    expect(onEnter).toHaveBeenCalledTimes(1);
    journey.dispose();
  });

  it("calls onLeave when the machine transitions away from the watched step", async () => {
    const journey = createSimpleJourney();
    const onLeave = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("details", { onLeave });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // details → review
    });

    expect(onLeave).toHaveBeenCalledTimes(1);
    journey.dispose();
  });

  it("does not call onEnter or onLeave for a different stepId", async () => {
    const journey = createSimpleJourney();
    const onEnter = vi.fn();
    const onLeave = vi.fn();

    const Probe = () => {
      // Watch "review", but we only navigate to "details"
      journey.useJourneyStepLifecycle("review", { onEnter, onLeave });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details
    });

    expect(onEnter).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    journey.dispose();
  });

  it("passes the current context to onEnter", async () => {
    const journey = createSimpleJourney();
    const onEnter = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("details", { onEnter });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
      journey.machine.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
    });
    await act(async () => {
      await journey.machine.goToNextStep();
    });

    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ name: "Ada" }) })
    );
    journey.dispose();
  });

  it("passes the current context to onLeave", async () => {
    const journey = createSimpleJourney();
    const onLeave = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("details", { onLeave });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details
    });

    act(() => {
      journey.machine.updateContext((ctx) => ({ ...ctx, name: "Grace" }));
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // details → review
    });

    expect(onLeave).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ name: "Grace" }) })
    );
    journey.dispose();
  });

  it("works when only onLeave is provided (no onEnter)", async () => {
    const journey = createSimpleJourney();
    const onLeave = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("start", { onLeave });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details: fires step.exit for "start"
    });

    expect(onLeave).toHaveBeenCalledTimes(1);
    journey.dispose();
  });

  it("works when only onEnter is provided (no onLeave)", async () => {
    const journey = createSimpleJourney();
    const onEnter = vi.fn();

    const Probe = () => {
      journey.useJourneyStepLifecycle("details", { onEnter });
      return null;
    };

    render(<Probe />);

    act(() => {
      journey.machine.startJourney();
    });
    await act(async () => {
      await journey.machine.goToNextStep(); // start → details
    });
    // No goToNextStep here — onLeave for "details" should NOT be called
    expect(onEnter).toHaveBeenCalledTimes(1);
    journey.dispose();
  });
});

import React from "react";
import {
  createGraphJourneyBuilder,
  createLinearJourney,
  type LinearJourneyDefinition
} from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { createGraphJourney } from "@rxova/journey-react/graph";
import "./styles.css";

type ReactStepId = "start" | "details" | "review" | "confirmExit";
type ReactContext = { name: string; includeDetails: boolean; dirty: boolean };
type ReactEvent = { type: "next" } | { type: "requestClose" };

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: ReactContext;
  stepId: ReactStepId;
  events: ReactEvent;
  meta: { label: string };
}>();

const reactDefinition = build({
  initial: "start",
  context: { name: "", includeDetails: true, dirty: false },
  steps: [
    createStep("start", {
      metadata: { label: "Start" },
      on: {
        next: [
          to("details").when(({ context }) => context.includeDetails),
          to("review").when(({ context }) => !context.includeDetails)
        ],
        requestClose: [to("confirmExit").when(({ context }) => context.dirty)]
      }
    }),
    createStep("details", {
      metadata: { label: "Details" },
      on: { next: [to("review")], requestClose: [to("confirmExit")] }
    }),
    createStep("review", {
      metadata: { label: "Review" },
      on: { requestClose: [to("confirmExit")] }
    }),
    createStep("confirmExit", { metadata: { label: "Confirm Exit" } })
  ]
});

const reactJourney = createGraphJourney(reactDefinition);

const ReactBridge = () => {
  const machine = reactJourney.useMachine();
  React.useEffect(
    () =>
      attachJourneyDevtools(machine, {
        machineId: "react-flow",
        label: "React Flow",
        appName: "Journey Demo",
        enabled: true,
        mutationsEnabled: true
      }),
    [machine]
  );
  return null;
};

const useCloseReactJourney = () => {
  const snapshot = reactJourney.useSnapshot();
  return () => {
    if (snapshot.context.dirty) {
      return reactJourney.send("requestClose");
    }
    return reactJourney.machine.controls.terminate();
  };
};

const ReactStart = () => {
  const snapshot = reactJourney.useSnapshot();
  const close = useCloseReactJourney();
  return (
    <div className="step">
      <h3>Start</h3>
      <label className="field">
        Name
        <input
          value={snapshot.context.name}
          onChange={(event) =>
            reactJourney.updateContext((context) => ({
              ...context,
              name: event.target.value,
              dirty: true
            }))
          }
          placeholder="Ada Lovelace"
        />
      </label>
      <label className="field checkbox">
        <input
          checked={snapshot.context.includeDetails}
          onChange={(event) =>
            reactJourney.updateContext((context) => ({
              ...context,
              includeDetails: event.target.checked,
              dirty: true
            }))
          }
          type="checkbox"
        />
        Visit details step
      </label>
      <div className="actions">
        <button onClick={() => void reactJourney.send("next")}>Next</button>
        <button className="secondary" onClick={() => void close()}>
          Close
        </button>
      </div>
    </div>
  );
};

const ReactDetails = () => {
  return (
    <div className="step">
      <h3>Details</h3>
      <p>Example intermediate step to verify transitions and timeline behavior.</p>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => void reactJourney.machine.navigate.goToPreviousStep()}
        >
          Go to previous step
        </button>
        <button onClick={() => void reactJourney.send("next")}>Next</button>
      </div>
    </div>
  );
};

const ReactReview = () => {
  const snapshot = reactJourney.useSnapshot();
  const close = useCloseReactJourney();
  return (
    <div className="step">
      <h3>Review</h3>
      <p>
        Ready to submit for <strong>{snapshot.context.name || "Anonymous"}</strong>?
      </p>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => void reactJourney.machine.navigate.goToPreviousStep()}
        >
          Go to previous step
        </button>
        <button className="secondary" onClick={() => void close()}>
          Close
        </button>
        <button onClick={() => reactJourney.machine.controls.complete()}>Submit</button>
      </div>
    </div>
  );
};

const ReactConfirmExit = () => {
  return (
    <div className="step">
      <h3>Confirm Exit</h3>
      <p>You have unsaved changes. Confirm close?</p>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => void reactJourney.machine.navigate.goToPreviousStep()}
        >
          Keep editing
        </button>
        <button onClick={() => reactJourney.machine.controls.terminate()}>Confirm close</button>
      </div>
    </div>
  );
};

const reactViews: Record<ReactStepId, React.ReactNode> = {
  start: <ReactStart />,
  details: <ReactDetails />,
  review: <ReactReview />,
  confirmExit: <ReactConfirmExit />
};

const ReactMachinePanel = () => {
  const snapshot = reactJourney.useSnapshot();
  return (
    <section className="card">
      <div className="card-head">
        <h2>React graph machine</h2>
        <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
      </div>
      <reactJourney.StepRenderer fallback={<p>Missing step component.</p>} />
      <div className="actions card-actions">
        <button className="secondary" onClick={() => reactJourney.machine.controls.restart()}>
          Restart
        </button>
        <button
          className="secondary"
          onClick={() => void reactJourney.machine.navigate.goToLastVisitedStep()}
        >
          Go to last visited step
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

type CoreStepId = "one" | "two" | "three";
type CoreContext = { owner: string; dirty: boolean };

const coreDefinition: LinearJourneyDefinition<CoreStepId, CoreContext> = {
  context: { owner: "Core Tester", dirty: false },
  steps: [
    { id: "one", metadata: { label: "One" } },
    { id: "two", metadata: { label: "Two" } },
    { id: "three", metadata: { label: "Three" } }
  ]
};

const coreMachine = createLinearJourney(coreDefinition);
const subscribeToCoreSnapshot = (onStoreChange: () => void) =>
  coreMachine.subscriptions.subscribeSelector(
    (snapshot) => snapshot,
    () => onStoreChange()
  );
const useCoreSnapshot = () =>
  React.useSyncExternalStore(
    subscribeToCoreSnapshot,
    coreMachine.getSnapshot,
    coreMachine.getSnapshot
  );

const CoreMachinePanel = () => {
  const snapshot = useCoreSnapshot();
  const randomizeOwner = () => {
    const suffix = Math.floor(Math.random() * 900 + 100);
    coreMachine.context.update((context) => ({
      ...context,
      owner: `Core Tester ${suffix}`,
      dirty: true
    }));
  };
  return (
    <section className="card">
      <div className="card-head">
        <h2>Core linear machine</h2>
        <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
      </div>
      <div className="core-view">
        <p>
          Current step: <strong>{snapshot.currentStep?.id ?? "none"}</strong>
        </p>
        <p>
          Owner: <strong>{snapshot.context.owner}</strong>
        </p>
      </div>
      <div className="actions">
        <button onClick={() => void coreMachine.navigate.goToNextStep()}>Next</button>
        <button className="secondary" onClick={() => void coreMachine.navigate.goToPreviousStep()}>
          Previous
        </button>
        <button className="secondary" onClick={() => coreMachine.controls.complete()}>
          Complete
        </button>
        <button className="secondary" onClick={() => coreMachine.controls.terminate()}>
          Terminate
        </button>
      </div>
      <div className="actions card-actions">
        <button className="secondary" onClick={randomizeOwner}>
          Update context
        </button>
        <button className="secondary" onClick={() => coreMachine.controls.restart()}>
          Restart
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

export const App = () => {
  React.useEffect(
    () =>
      attachJourneyDevtools(coreMachine, {
        machineId: "core-flow",
        label: "Core Flow",
        appName: "Journey Demo",
        enabled: true,
        mutationsEnabled: true
      }),
    []
  );
  React.useEffect(() => {
    coreMachine.controls.start();
  }, []);

  return (
    <main className="layout">
      <header className="hero">
        <h1>Rxova Journey Demo</h1>
        <p>
          Open Chrome DevTools and select the <strong>Journey</strong> panel. You should see both
          machines.
        </p>
        <p className="hint">
          Expected machine ids: <code>react-flow</code> and <code>core-flow</code>.
        </p>
      </header>
      <reactJourney.Provider views={reactViews}>
        <ReactBridge />
        <ReactMachinePanel />
      </reactJourney.Provider>
      <CoreMachinePanel />
      <footer className="hint footer-note">
        Status values include <code>idle</code>, <code>running</code>, <code>completed</code>, and{" "}
        <code>terminated</code>.
      </footer>
    </main>
  );
};

export default App;

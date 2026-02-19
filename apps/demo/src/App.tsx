import React from "react";
import { createJourneyMachine, JOURNEY_STATUS, type JourneyDefinition } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import {
  createJourneyBindings,
  type JourneyBindings,
  type JourneyReactDefinition
} from "@rxova/journey-react";
import "./styles.css";

type ReactStepId = "start" | "details" | "review" | "confirmExit";
type ReactContext = {
  name: string;
  includeDetails: boolean;
  dirty: boolean;
};

type ReactEvent = "requestClose";

let reactBindings: JourneyBindings<ReactContext, ReactStepId, ReactEvent>;

const useReactJourneyApi = () => reactBindings.useJourneyApi();
const useReactJourneySnapshot = () => reactBindings.useJourneySnapshot();
const useReactJourneyMachine = () => reactBindings.useJourneyMachine();

const ReactBridge = () => {
  const machine = useReactJourneyMachine();

  React.useEffect(() => {
    return attachJourneyDevtools(machine, {
      machineId: "react-flow",
      label: "React Flow",
      appName: "Journey Demo",
      enabled: true,
      commandsEnabled: true
    });
  }, [machine]);

  return null;
};

const ReactStart = () => {
  const snapshot = useReactJourneySnapshot();
  const api = useReactJourneyApi();

  return (
    <div className="step">
      <h3>Start</h3>
      <label className="field">
        Name
        <input
          value={snapshot.context.name}
          onChange={(event) =>
            api.updateContext((context) => ({
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
            api.updateContext((context) => ({
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
        <button onClick={() => void api.goToNextStep()}>Next</button>
        <button
          className="secondary"
          onClick={() =>
            void (snapshot.context.dirty
              ? api.send({ type: "requestClose" })
              : api.terminateJourney())
          }
        >
          Close
        </button>
      </div>
    </div>
  );
};

const ReactDetails = () => {
  const api = useReactJourneyApi();

  return (
    <div className="step">
      <h3>Details</h3>
      <p>Example intermediate step to verify transitions and timeline behavior.</p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.goToPreviousStep()}>
          Go to previous step
        </button>
        <button onClick={() => void api.goToNextStep()}>Next</button>
      </div>
    </div>
  );
};

const ReactReview = () => {
  const snapshot = useReactJourneySnapshot();
  const api = useReactJourneyApi();

  return (
    <div className="step">
      <h3>Review</h3>
      <p>
        Ready to submit for <strong>{snapshot.context.name || "Anonymous"}</strong>?
      </p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.goToPreviousStep()}>
          Go to previous step
        </button>
        <button
          className="secondary"
          onClick={() =>
            void (snapshot.context.dirty
              ? api.send({ type: "requestClose" })
              : api.terminateJourney())
          }
        >
          Close
        </button>
        <button onClick={() => void api.completeJourney()}>Submit</button>
      </div>
    </div>
  );
};

const ReactConfirmExit = () => {
  const api = useReactJourneyApi();

  return (
    <div className="step">
      <h3>Confirm Exit</h3>
      <p>You have unsaved changes. Confirm close?</p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.goToPreviousStep()}>
          Keep editing
        </button>
        <button onClick={() => void api.terminateJourney()}>Confirm close</button>
      </div>
    </div>
  );
};

const reactJourney: JourneyReactDefinition<ReactContext, ReactStepId, ReactEvent> = {
  initial: "start",
  context: {
    name: "",
    includeDetails: true,
    dirty: false
  },
  steps: {
    start: { component: ReactStart, meta: { label: "Start" } },
    details: { component: ReactDetails, meta: { label: "Details" } },
    review: { component: ReactReview, meta: { label: "Review" } },
    confirmExit: { component: ReactConfirmExit, meta: { label: "Confirm Exit" } }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "details",
      when: ({ context }) => context.includeDetails
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeDetails
    },
    { from: "details", event: "goToNextStep", to: "review" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "review", event: "completeJourney" }
  ]
};

reactBindings = createJourneyBindings(reactJourney);

const ReactMachinePanel = () => {
  const snapshot = useReactJourneySnapshot();
  const api = useReactJourneyApi();
  const StepRenderer = reactBindings.StepRenderer;

  return (
    <section className="card">
      <div className="card-head">
        <h2>React Machine</h2>
        <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
      </div>
      <p className="hint">
        Powered by <code>@rxova/journey-react</code> and bridged as <code>react-flow</code>.
      </p>
      <StepRenderer fallback={<p>Missing step component.</p>} />
      <div className="actions card-actions">
        <button className="secondary" onClick={() => api.resetJourney()}>
          Reset
        </button>
        <button className="secondary" onClick={() => void api.goToLastVisitedStep()}>
          Go to last visited step
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

type CoreStepId = "one" | "two" | "three";
type CoreEvent = "goToNextStep" | "back" | "completeJourney" | "terminateJourney";
type CoreContext = {
  owner: string;
  dirty: boolean;
};

const coreJourney: JourneyDefinition<CoreContext, CoreStepId, CoreEvent> = {
  initial: "one",
  context: {
    owner: "Core Tester",
    dirty: false
  },
  steps: {
    one: { meta: { label: "One" } },
    two: { meta: { label: "Two" } },
    three: { meta: { label: "Three" } }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" },
    { from: "three", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

const coreMachine = createJourneyMachine(coreJourney);

const useCoreSnapshot = () =>
  React.useSyncExternalStore(
    coreMachine.subscribe,
    coreMachine.getSnapshot,
    coreMachine.getSnapshot
  );

const CoreMachinePanel = () => {
  const snapshot = useCoreSnapshot();

  const send = React.useCallback((type: CoreEvent) => {
    void coreMachine.send({ type });
  }, []);

  const randomizeOwner = React.useCallback(() => {
    const suffix = Math.floor(Math.random() * 900 + 100);
    coreMachine.updateContext((context) => ({
      ...context,
      owner: `Core Tester ${suffix}`,
      dirty: true
    }));
  }, []);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Core Machine</h2>
        <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
      </div>
      <p className="hint">
        Powered by <code>@rxova/journey-core</code> and bridged as <code>core-flow</code>.
      </p>
      <div className="core-view">
        <p>
          Current step: <strong>{snapshot.currentStepId}</strong>
        </p>
        <p>
          Owner: <strong>{snapshot.context.owner}</strong>
        </p>
      </div>
      <div className="actions">
        <button onClick={() => send("goToNextStep")}>Next</button>
        <button className="secondary" onClick={() => void coreMachine.goToPreviousStep()}>
          Go to previous step
        </button>
        <button className="secondary" onClick={() => send("completeJourney")}>
          Submit
        </button>
        <button className="secondary" onClick={() => send("terminateJourney")}>
          Close
        </button>
      </div>
      <div className="actions card-actions">
        <button className="secondary" onClick={randomizeOwner}>
          Update context
        </button>
        <button className="secondary" onClick={() => coreMachine.resetMachine()}>
          Reset
        </button>
        <button className="secondary" onClick={() => void coreMachine.goToLastVisitedStep()}>
          Go to last visited step
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

export const App = () => {
  const Provider = reactBindings.Provider;

  React.useEffect(() => {
    return attachJourneyDevtools(coreMachine, {
      machineId: "core-flow",
      label: "Core Flow",
      appName: "Journey Demo",
      enabled: true,
      commandsEnabled: true
    });
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

      <Provider>
        <ReactBridge />
        <ReactMachinePanel />
      </Provider>

      <CoreMachinePanel />

      <footer className="hint footer-note">
        React status values: <code>{JOURNEY_STATUS.RUNNING}</code>,{" "}
        <code>{JOURNEY_STATUS.COMPLETE}</code>, <code>{JOURNEY_STATUS.TERMINATED}</code>
      </footer>
    </main>
  );
};

export default App;

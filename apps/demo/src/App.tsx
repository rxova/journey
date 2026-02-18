import React from "react";
import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_STATUS,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import {
  JourneyProvider,
  JourneyStepRenderer,
  useJourney,
  useJourneyMachine,
  type JourneyReactDefinition
} from "@rxova/journey-react";
import "./styles.css";

type ReactStepId = "start" | "details" | "review" | "confirmExit";
type ReactContext = {
  name: string;
  includeDetails: boolean;
  dirty: boolean;
};

const ReactBridge = () => {
  const machine = useJourneyMachine<ReactContext, ReactStepId>();

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
  const { snapshot, api } = useJourney<ReactContext, ReactStepId>();

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
        <button onClick={() => void api.next()}>Next</button>
        <button className="secondary" onClick={() => void api.close()}>
          Close
        </button>
      </div>
    </div>
  );
};

const ReactDetails = () => {
  const { api } = useJourney<ReactContext, ReactStepId>();

  return (
    <div className="step">
      <h3>Details</h3>
      <p>Example intermediate step to verify transitions and history.</p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.back()}>
          Back
        </button>
        <button onClick={() => void api.next()}>Next</button>
      </div>
    </div>
  );
};

const ReactReview = () => {
  const { snapshot, api } = useJourney<ReactContext, ReactStepId>();

  return (
    <div className="step">
      <h3>Review</h3>
      <p>
        Ready to submit for <strong>{snapshot.context.name || "Anonymous"}</strong>?
      </p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.back()}>
          Back
        </button>
        <button className="secondary" onClick={() => void api.close()}>
          Close
        </button>
        <button onClick={() => void api.submit()}>Submit</button>
      </div>
    </div>
  );
};

const ReactConfirmExit = () => {
  const { api } = useJourney<ReactContext, ReactStepId>();

  return (
    <div className="step">
      <h3>Confirm Exit</h3>
      <p>You have unsaved changes. Confirm close?</p>
      <div className="actions">
        <button className="secondary" onClick={() => void api.back()}>
          Keep editing
        </button>
        <button onClick={() => void api.submit()}>Confirm close</button>
      </div>
    </div>
  );
};

const reactJourney: JourneyReactDefinition<ReactContext, ReactStepId> = {
  initial: "start",
  context: {
    name: "",
    includeDetails: true,
    dirty: false
  },
  steps: {
    start: { component: ReactStart },
    details: { component: ReactDetails },
    review: { component: ReactReview },
    confirmExit: { component: ReactConfirmExit }
  },
  transitions: [
    {
      from: "start",
      event: "next",
      to: "details",
      when: ({ context }) => context.includeDetails
    },
    {
      from: "start",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeDetails
    },
    { from: "details", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "confirmExit", event: "submit", to: JOURNEY_TERMINAL.CLOSE },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const ReactMachinePanel = () => {
  const { snapshot, api } = useJourney<ReactContext, ReactStepId>();

  return (
    <section className="card">
      <div className="card-head">
        <h2>React Machine</h2>
        <span className={`status status-${snapshot.status}`}>{snapshot.status}</span>
      </div>
      <p className="hint">
        Powered by <code>@rxova/journey-react</code> and bridged as <code>react-flow</code>.
      </p>
      <JourneyStepRenderer<ReactContext, ReactStepId> fallback={<p>Missing step component.</p>} />
      <div className="actions card-actions">
        <button className="secondary" onClick={() => api.reset()}>
          Reset
        </button>
        <button className="secondary" onClick={() => api.clearHistory()}>
          Clear history
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

type CoreStepId = "one" | "two" | "three";
type CoreEvent = "next" | "back" | "submit" | "close";
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
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
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
          Current step: <strong>{snapshot.current}</strong>
        </p>
        <p>
          Owner: <strong>{snapshot.context.owner}</strong>
        </p>
      </div>
      <div className="actions">
        <button onClick={() => send("next")}>Next</button>
        <button className="secondary" onClick={() => send("back")}>
          Back
        </button>
        <button className="secondary" onClick={() => send("submit")}>
          Submit
        </button>
        <button className="secondary" onClick={() => send("close")}>
          Close
        </button>
      </div>
      <div className="actions card-actions">
        <button className="secondary" onClick={randomizeOwner}>
          Update context
        </button>
        <button className="secondary" onClick={() => coreMachine.reset()}>
          Reset
        </button>
        <button className="secondary" onClick={() => coreMachine.clearHistory()}>
          Clear history
        </button>
      </div>
      <pre className="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
    </section>
  );
};

export const App = () => {
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

      <JourneyProvider journey={reactJourney}>
        <ReactBridge />
        <ReactMachinePanel />
      </JourneyProvider>

      <CoreMachinePanel />

      <footer className="hint footer-note">
        React status values: <code>{JOURNEY_STATUS.RUNNING}</code>,{" "}
        <code>{JOURNEY_STATUS.COMPLETE}</code>, <code>{JOURNEY_STATUS.CLOSED}</code>
      </footer>
    </main>
  );
};

export default App;

import React from "react";
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { createGraphJourney } from "@rxova/journey-react/graph";
import "./styles.css";

type ReactStepId = "start" | "details" | "review" | "confirmExit";
type ReactContext = {
  name: string;
  includeDetails: boolean;
  dirty: boolean;
};

type ReactEventMap = { type: "requestClose"; payload?: unknown };

const reactJourneyDefinition: JourneyDefinition<ReactContext, ReactStepId, ReactEventMap> = {
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
      goToNextStep: [
        {
          to: "details",
          when: ({ context }) => context.includeDetails
        },
        {
          to: "review",
          when: ({ context }) => !context.includeDetails
        }
      ]
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
          when: ({ context }) => context.dirty
        }
      ],
      terminateJourney: [{}]
    }
  }
};

const reactJourney = createGraphJourney(reactJourneyDefinition);

const useReactJourneyApi = () => reactJourney.useApi();
const useReactJourneySnapshot = () => reactJourney.useSnapshot();

const ReactBridge = () => {
  const machine = reactJourney.useMachine();
  React.useEffect(() => {
    return attachJourneyDevtools(machine as never, {
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

const reactViews: Record<ReactStepId, React.ComponentType> = {
  start: ReactStart,
  details: ReactDetails,
  review: ReactReview,
  confirmExit: ReactConfirmExit
};

const ReactMachinePanel = () => {
  const snapshot = useReactJourneySnapshot();
  const api = useReactJourneyApi();
  const StepRenderer = reactJourney.StepRenderer;

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
type CoreEvent = "goToNextStep" | "completeJourney" | "terminateJourney";
type CoreContext = {
  owner: string;
  dirty: boolean;
};

const coreJourney: JourneyDefinition<CoreContext, CoreStepId> = {
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
  transitions: {
    one: {
      goToNextStep: [{ to: "two" }]
    },
    two: {
      goToNextStep: [{ to: "three" }]
    },
    three: {
      completeJourney: [{}]
    },
    global: {
      terminateJourney: [{}]
    }
  }
};

const coreMachine = createJourneyMachine(coreJourney);

const useCoreSnapshot = () =>
  React.useSyncExternalStore(
    coreMachine.subscribe,
    coreMachine.getSnapshot,
    coreMachine.getSnapshot
  );

const useCoreStatus = () =>
  React.useSyncExternalStore(
    coreMachine.subscribe,
    () => coreMachine.getSnapshot().status,
    () => coreMachine.getSnapshot().status
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
        <button className="secondary" onClick={() => coreMachine.resetJourney()}>
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
  const JourneyProvider = reactJourney.Provider;
  const coreStatus = useCoreStatus();

  React.useEffect(() => {
    return attachJourneyDevtools(coreMachine, {
      machineId: "core-flow",
      label: "Core Flow",
      appName: "Journey Demo",
      enabled: true,
      commandsEnabled: true
    });
  }, []);

  React.useEffect(() => {
    if (coreStatus !== "idled") {
      return;
    }

    let canceled = false;
    queueMicrotask(() => {
      if (canceled || coreMachine.getSnapshot().status !== "idled") {
        return;
      }

      coreMachine.startJourney();
    });

    return () => {
      canceled = true;
    };
  }, [coreStatus]);

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

      <JourneyProvider views={reactViews}>
        <ReactBridge />
        <ReactMachinePanel />
      </JourneyProvider>

      <CoreMachinePanel />

      <footer className="hint footer-note">
        React status values: <code>running</code>, <code>complete</code>, <code>terminated</code>
      </footer>
    </main>
  );
};

export default App;

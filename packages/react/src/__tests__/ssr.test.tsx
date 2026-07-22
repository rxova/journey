// @vitest-environment node
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createLinearJourney } from "@rxova/journey-core";
import { createLinearJourney as createLinearJourneyBundle } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";

const Step = ({ label }: { label: string }) => <div>{`step:${label}`}</div>;
const A = () => <Step label="a" />;
const Form = () => <Step label="form" />;

describe("server-side rendering (no window)", () => {
  it("renders the linear bundle's active view to a string — the machine starts in the factory", () => {
    const journey = createLinearJourneyBundle({ context: {}, steps: ["a"] });
    const html = renderToString(
      <journey.Provider views={{ a: <A /> }}>
        <p>head</p>
        <journey.StepRenderer fallback={<p>loading</p>} />
        <p>foot</p>
      </journey.Provider>
    );
    expect(html).toContain("step:a");
  });

  it("renders the fallback for an autoStart: false linear bundle", () => {
    const journey = createLinearJourneyBundle({ context: {}, steps: ["a"] }, { autoStart: false });
    const html = renderToString(
      <journey.Provider views={{ a: <A /> }}>
        <journey.StepRenderer fallback={<p>loading</p>} />
      </journey.Provider>
    );
    expect(html).toContain("loading");
    expect(html).not.toContain("step:a");
  });

  it("renders a caller-owned core machine to a string via useSyncExternalStore", () => {
    // No headless tier: React's own primitive consumes any core machine.
    const machine = createLinearJourney(
      { steps: ["watching", "flagged"], context: {} },
      { autoStart: true }
    );
    const subscribe = (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);
    const Owned = () => {
      const snapshot = React.useSyncExternalStore(
        subscribe,
        machine.getSnapshot,
        machine.getSnapshot
      );
      return <div>{`phase:${snapshot.currentStep?.id}`}</div>;
    };
    expect(renderToString(<Owned />)).toContain("phase:watching");
  });

  it("renders a graph bundle's initial view to a string", () => {
    const bundle = createGraphJourney({
      steps: { form: {}, done: {} },
      transitions: { FINISH: { from: "form", to: "done" } },
      initial: "form",
      context: {}
    });
    const html = renderToString(
      <bundle.Provider views={{ form: <Form />, done: <Form /> }}>
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    expect(html).toContain("step:form");
  });
});

// @vitest-environment node
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createLinearJourney } from "@rxova/journey-core";
import { createLinearJourney as createLinearJourneyBundle } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";
import { useJourneySnapshot, useOwnedJourney } from "@rxova/journey-react/headless";

const Step = ({ label }: { label: string }) => <div>{`step:${label}`}</div>;
const A = () => <Step label="a" />;
const Form = () => <Step label="form" />;

describe("server-side rendering (no window)", () => {
  it("renders the linear journey's fallback to a string — the start is a client effect", () => {
    // Render is pure: the machine is created idle and started in a layout
    // effect, which never runs on the server. Deterministic on both sides —
    // the client's first frame is the same fallback, replaced before paint.
    const journey = createLinearJourneyBundle({ context: {}, steps: ["a"] });
    const html = renderToString(
      <journey.Provider header={<p>head</p>} footer={<p>foot</p>} fallback={<p>loading</p>}>
        <journey.Step id="a">
          <A />
        </journey.Step>
      </journey.Provider>
    );
    expect(html).toContain("loading");
    expect(html).not.toContain("step:a");
  });

  it("renders headless-owned machines to a string", () => {
    const Owned = () => {
      const machine = useOwnedJourney(() =>
        createLinearJourney({ steps: ["watching", "flagged"], context: {} }, { autoStart: true })
      );
      const snapshot = useJourneySnapshot(machine);
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
      <bundle.Provider views={{ form: Form, done: Form }}>
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    expect(html).toContain("step:form");
  });
});

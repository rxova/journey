import { describe, expect, it } from "vitest";

import React from "react";
import { renderToString } from "react-dom/server";

import { useWizard, Wizard } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";

type Ctx = { count: number };

describe("SSR/RSC compatibility", () => {
  it("renders <Wizard> with header/footer hooks on the server", () => {
    const Panel = (props: { label: string }) => <div>{`${props.label}-ssr`}</div>;
    const Footer = () => {
      const { activeStepId, stepCount } = useWizard<Ctx>();
      return <div>{`${activeStepId}/${stepCount}`}</div>;
    };

    const html = renderToString(
      <Wizard context={{ count: 0 }} footer={<Footer />}>
        <Panel id="start" label="start" />
        <Panel id="review" label="review" />
      </Wizard>
    );

    expect(html).toContain("start-ssr");
    expect(html).toContain("start/2");
  });

  it("renders the graph Provider and StepRenderer on the server without auto-starting", () => {
    const bundle = createGraphJourney({
      initial: "start",
      context: { count: 0 } as Ctx,
      steps: { start: {}, review: {} },
      transitions: { start: { goToNextStep: [{ to: "review" }] } }
    });

    const Status = () => {
      const snapshot = bundle.useSnapshot();
      return <div>{`status:${snapshot.status}`}</div>;
    };

    const html = renderToString(
      <bundle.Provider
        views={{ start: () => <div>start-ssr</div>, review: () => <div>review-ssr</div> }}
      >
        <Status />
        <bundle.StepRenderer />
      </bundle.Provider>
    );

    // Server render shows the pre-start snapshot; startJourney is a client-side layout effect.
    expect(html).toContain("start-ssr");
    expect(html).toContain("status:idled");
  });

  it("no module-scope machine: two server renders do not share state", () => {
    const Probe = () => {
      const { context } = useWizard<Ctx>();
      return <div>{`count:${context.count}`}</div>;
    };

    const renderOnce = () =>
      renderToString(
        <Wizard context={{ count: 0 }}>
          <Probe id="only" />
        </Wizard>
      );

    expect(renderOnce()).toContain("count:0");
    expect(renderOnce()).toContain("count:0");
  });
});
